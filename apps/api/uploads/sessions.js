"use strict";

/**
 * Temporary upload sessions (Prompt 049).
 */

const crypto = require("node:crypto");

const UPLOAD_SESSION_VERSION = 1;
const DEFAULT_TTL_MS = 15 * 60 * 1000;
const LIFECYCLE_BACKSTOP_MS = 24 * 60 * 60 * 1000;

function createUploadSessionService({
  now = () => Date.now(),
  allowedOrigin = "https://upload.example",
  authorize,
} = {}) {
  const sessions = new Map();
  const objects = new Map();

  function createSession({
    accessToken,
    jobId,
    ownerUserId,
    expected,
    multipart = false,
  }) {
    const auth = authorize({ accessToken, jobOwnerUserId: ownerUserId });
    if (!auth.ok) return { ok: false, error: auth.error || "unauthorized" };
    const sessionId = crypto.randomBytes(16).toString("hex");
    const session = {
      sessionId,
      jobId,
      ownerUserId: auth.userId,
      expiresAt: now() + DEFAULT_TTL_MS,
      lifecycleExpiresAt: now() + LIFECYCLE_BACKSTOP_MS,
      expected: {
        count: expected.count,
        maxBytes: expected.maxBytes,
        contentTypes: expected.contentTypes || ["application/octet-stream"],
        checksums: expected.checksums || [],
      },
      multipart: Boolean(multipart),
      completed: [],
      publicAccess: false,
      clientKeys: false,
      origin: allowedOrigin,
    };
    sessions.set(sessionId, session);
    return {
      ok: true,
      sessionId,
      uploadOrigin: allowedOrigin,
      opaqueKeys: Array.from({ length: expected.count }, (_, i) => opaqueKey(sessionId, i)),
      expiresAt: session.expiresAt,
    };
  }

  function putObject({
    sessionId,
    key,
    bytes,
    contentType,
    checksum,
    origin,
    accessToken,
    ownerUserId,
  }) {
    const session = sessions.get(sessionId);
    if (!session) return { ok: false, error: "unknown-session" };
    const auth = authorize({ accessToken, jobOwnerUserId: ownerUserId || session.ownerUserId });
    if (!auth.ok) return { ok: false, error: auth.error };
    if (auth.userId !== session.ownerUserId) return { ok: false, error: "cross-tenant" };
    if (origin !== session.origin) return { ok: false, error: "origin" };
    if (session.expiresAt < now()) return { ok: false, error: "expired" };
    if (session.lifecycleExpiresAt < now()) return { ok: false, error: "lifecycle" };
    if (!key.startsWith(`obj_${sessionId}_`)) return { ok: false, error: "wrong-key" };
    if (bytes > session.expected.maxBytes) return { ok: false, error: "oversized" };
    if (!session.expected.contentTypes.includes(contentType)) return { ok: false, error: "type" };
    if (session.expected.checksums.length && !session.expected.checksums.includes(checksum)) {
      return { ok: false, error: "hash" };
    }
    if (objects.has(key)) return { ok: false, error: "replay" };
    if (session.completed.length >= session.expected.count) return { ok: false, error: "count" };

    objects.set(key, {
      sessionId,
      bytes,
      contentType,
      checksum,
      deletionTag: `delete_after_${session.lifecycleExpiresAt}`,
      private: true,
    });
    session.completed.push(key);
    return { ok: true, key, remaining: session.expected.count - session.completed.length };
  }

  function completeSession({ sessionId, accessToken }) {
    const session = sessions.get(sessionId);
    if (!session) return { ok: false, error: "unknown-session" };
    const auth = authorize({ accessToken, jobOwnerUserId: session.ownerUserId });
    if (!auth.ok) return { ok: false, error: "unauthorized" };
    if (session.completed.length !== session.expected.count) {
      return { ok: false, error: "incomplete" };
    }
    return {
      ok: true,
      record: {
        sessionId,
        jobId: session.jobId,
        keys: [...session.completed],
        deletionTags: session.completed.map((k) => objects.get(k).deletionTag),
      },
    };
  }

  function failMultipart({ sessionId }) {
    const session = sessions.get(sessionId);
    if (!session || !session.multipart) return { ok: false, error: "not-multipart" };
    for (const key of session.completed) objects.delete(key);
    session.completed = [];
    return { ok: true, cleaned: true };
  }

  return {
    createSession,
    putObject,
    completeSession,
    failMultipart,
    DEFAULT_TTL_MS,
    LIFECYCLE_BACKSTOP_MS,
    _sessions: sessions,
    _objects: objects,
  };
}

function opaqueKey(sessionId, index) {
  return `obj_${sessionId}_${index}_${crypto.randomBytes(4).toString("hex")}`;
}

function validateUploadSessionModule() {
  const errors = [];
  const tokens = new Map();
  const authorize = ({ accessToken, jobOwnerUserId }) => {
    const session = tokens.get(accessToken);
    if (!session) return { ok: false, error: "unauthorized" };
    if (jobOwnerUserId && session.userId !== jobOwnerUserId) return { ok: false, error: "idor" };
    return { ok: true, userId: session.userId };
  };
  tokens.set("tok-u1", { userId: "u1" });
  tokens.set("tok-u2", { userId: "u2" });

  let t = 1000;
  const svc = createUploadSessionService({ now: () => t, authorize });

  const created = svc.createSession({
    accessToken: "tok-u1",
    jobId: "job1",
    ownerUserId: "u1",
    expected: { count: 2, maxBytes: 100, contentTypes: ["application/octet-stream"], checksums: ["h1", "h2"] },
  });
  if (!created.ok) errors.push("create");

  if (
    svc.putObject({
      sessionId: created.sessionId,
      key: created.opaqueKeys[0],
      bytes: 10,
      contentType: "application/octet-stream",
      checksum: "h1",
      origin: "https://evil",
      accessToken: "tok-u1",
    }).ok
  ) {
    errors.push("origin");
  }

  const put = svc.putObject({
    sessionId: created.sessionId,
    key: created.opaqueKeys[0],
    bytes: 10,
    contentType: "application/octet-stream",
    checksum: "h1",
    origin: "https://upload.example",
    accessToken: "tok-u1",
  });
  if (!put.ok) errors.push("put");

  if (
    svc.putObject({
      sessionId: created.sessionId,
      key: created.opaqueKeys[0],
      bytes: 10,
      contentType: "application/octet-stream",
      checksum: "h1",
      origin: "https://upload.example",
      accessToken: "tok-u1",
    }).ok
  ) {
    errors.push("replay");
  }

  if (
    svc.putObject({
      sessionId: created.sessionId,
      key: "wrong",
      bytes: 10,
      contentType: "application/octet-stream",
      checksum: "h2",
      origin: "https://upload.example",
      accessToken: "tok-u1",
    }).ok
  ) {
    errors.push("key");
  }

  if (
    svc.putObject({
      sessionId: created.sessionId,
      key: created.opaqueKeys[1],
      bytes: 1000,
      contentType: "application/octet-stream",
      checksum: "h2",
      origin: "https://upload.example",
      accessToken: "tok-u1",
    }).ok
  ) {
    errors.push("size");
  }

  if (
    svc.createSession({
      accessToken: "tok-u2",
      jobId: "job1",
      ownerUserId: "u1",
      expected: { count: 1, maxBytes: 10 },
    }).ok
  ) {
    errors.push("ownership");
  }

  svc.putObject({
    sessionId: created.sessionId,
    key: created.opaqueKeys[1],
    bytes: 10,
    contentType: "application/octet-stream",
    checksum: "h2",
    origin: "https://upload.example",
    accessToken: "tok-u1",
  });
  if (!svc.completeSession({ sessionId: created.sessionId, accessToken: "tok-u1" }).ok) errors.push("complete");

  t += DEFAULT_TTL_MS + 1;
  const expired = svc.createSession({
    accessToken: "tok-u1",
    jobId: "job2",
    ownerUserId: "u1",
    expected: { count: 1, maxBytes: 10, checksums: ["hx"] },
  });
  t += DEFAULT_TTL_MS + 1;
  if (
    svc.putObject({
      sessionId: expired.sessionId,
      key: expired.opaqueKeys[0],
      bytes: 1,
      contentType: "application/octet-stream",
      checksum: "hx",
      origin: "https://upload.example",
      accessToken: "tok-u1",
    }).ok
  ) {
    errors.push("expiry");
  }

  const mp = svc.createSession({
    accessToken: "tok-u1",
    jobId: "job3",
    ownerUserId: "u1",
    expected: { count: 1, maxBytes: 10, checksums: ["hm"] },
    multipart: true,
  });
  svc.putObject({
    sessionId: mp.sessionId,
    key: mp.opaqueKeys[0],
    bytes: 1,
    contentType: "application/octet-stream",
    checksum: "hm",
    origin: "https://upload.example",
    accessToken: "tok-u1",
  });
  if (!svc.failMultipart({ sessionId: mp.sessionId }).cleaned) errors.push("multipart");

  return { ok: errors.length === 0, errors };
}

module.exports = {
  UPLOAD_SESSION_VERSION,
  DEFAULT_TTL_MS,
  LIFECYCLE_BACKSTOP_MS,
  createUploadSessionService,
  validateUploadSessionModule,
};
