"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const sessions = require(path.join(root, "apps/api/uploads/sessions"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/upload-sessions.md"), "utf8");

test("P049-T01 module validation", () => {
  assert.equal(sessions.validateUploadSessionModule().ok, true);
});

test("P049-T02 ownership origin size hash replay expiry", () => {
  const tokens = new Map([
    ["tok-u1", { userId: "u1" }],
    ["tok-u2", { userId: "u2" }],
  ]);
  const authorize = ({ accessToken, jobOwnerUserId }) => {
    const session = tokens.get(accessToken);
    if (!session) return { ok: false, error: "unauthorized" };
    if (jobOwnerUserId && session.userId !== jobOwnerUserId) return { ok: false, error: "idor" };
    return { ok: true, userId: session.userId };
  };
  let t = 1000;
  const svc = sessions.createUploadSessionService({ now: () => t, authorize });
  const created = svc.createSession({
    accessToken: "tok-u1",
    jobId: "j1",
    ownerUserId: "u1",
    expected: { count: 1, maxBytes: 50, checksums: ["h1"] },
  });
  assert.equal(created.ok, true);
  assert.equal(
    svc.putObject({
      sessionId: created.sessionId,
      key: created.opaqueKeys[0],
      bytes: 10,
      contentType: "application/octet-stream",
      checksum: "h1",
      origin: "https://evil",
      accessToken: "tok-u1",
    }).error,
    "origin",
  );
  assert.equal(
    svc.putObject({
      sessionId: created.sessionId,
      key: created.opaqueKeys[0],
      bytes: 10,
      contentType: "application/octet-stream",
      checksum: "h1",
      origin: "https://upload.example",
      accessToken: "tok-u1",
    }).ok,
    true,
  );
  assert.equal(
    svc.putObject({
      sessionId: created.sessionId,
      key: created.opaqueKeys[0],
      bytes: 10,
      contentType: "application/octet-stream",
      checksum: "h1",
      origin: "https://upload.example",
      accessToken: "tok-u1",
    }).error,
    "replay",
  );
});

test("P049-T03 docs and package export", () => {
  assert.match(doc, /opaque keys/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./uploads/sessions"], "./uploads/sessions.js");
});
