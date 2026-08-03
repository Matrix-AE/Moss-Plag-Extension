"use strict";

/**
 * Secure provider credential vault (Prompt 063).
 * Envelope encryption, tenant binding, masked display, per-job decrypt for submission workers only.
 */

const crypto = require("node:crypto");

const VAULT_VERSION = 1;
const ALLOWED_WORKER = "submission-worker";

function createCredentialVault({
  masterKey,
  now = () => Date.now(),
} = {}) {
  if (!Buffer.isBuffer(masterKey) || masterKey.length < 32) {
    throw new Error("master-key-required");
  }

  let keyVersion = 1;
  const keys = new Map([[1, Buffer.from(masterKey)]]);
  const credentials = new Map();
  const audits = [];

  function store({ tenantId, mossUserId, actor }) {
    if (!tenantId || !isNumericId(mossUserId)) return { ok: false, error: "invalid-input" };
    const id = `cred_${crypto.randomBytes(6).toString("hex")}`;
    const dek = crypto.randomBytes(32);
    const wrappedDek = wrapDek(dek, keys.get(keyVersion), keyVersion);
    const ciphertext = encryptId(mossUserId, dek);
    const record = {
      id,
      tenantId,
      wrappedDek,
      ciphertext,
      keyVersion,
      display: maskId(mossUserId),
      createdAt: now(),
      revoked: false,
    };
    credentials.set(id, record);
    audit({ action: "store", tenantId, credentialId: id, actor });
    return { ok: true, id, display: record.display, wrappedDek, keyVersion };
  }

  function replace({ tenantId, credentialId, mossUserId, actor }) {
    const existing = credentials.get(credentialId);
    if (!existing || existing.tenantId !== tenantId) return { ok: false, error: "not-found" };
    existing.revoked = true;
    audit({ action: "revoke-for-replace", tenantId, credentialId, actor });
    return store({ tenantId, mossUserId, actor });
  }

  function deleteCredential({ tenantId, credentialId, actor }) {
    const existing = credentials.get(credentialId);
    if (!existing || existing.tenantId !== tenantId) return { ok: false, error: "not-found" };
    existing.revoked = true;
    existing.ciphertext = null;
    existing.wrappedDek = null;
    audit({ action: "delete", tenantId, credentialId, actor });
    return { ok: true };
  }

  function decryptForSubmission({ credentialId, tenantId, workerIdentity, jobLease }) {
    if (workerIdentity !== ALLOWED_WORKER) {
      audit({ action: "decrypt-denied", tenantId, credentialId, reason: "worker-identity" });
      return { ok: false, error: "worker-identity" };
    }
    if (!jobLease?.valid || jobLease.tenantId !== tenantId) {
      audit({ action: "decrypt-denied", tenantId, credentialId, reason: "invalid-lease" });
      return { ok: false, error: "invalid-lease" };
    }
    const record = credentials.get(credentialId);
    if (!record || record.revoked || !record.ciphertext) {
      audit({ action: "decrypt-denied", tenantId, credentialId, reason: "revoked-or-missing" });
      return { ok: false, error: "revoked-or-missing" };
    }
    if (record.tenantId !== tenantId) {
      audit({ action: "decrypt-denied", tenantId, credentialId, reason: "cross-tenant" });
      return { ok: false, error: "cross-tenant" };
    }
    const kek = keys.get(record.keyVersion);
    if (!kek) return { ok: false, error: "key-missing" };
    const dek = unwrapDek(record.wrappedDek, kek);
    const mossUserId = decryptId(record.ciphertext, dek);
    audit({
      action: "decrypt-for-job",
      tenantId,
      credentialId,
      jobId: jobLease.jobId,
      workerIdentity,
    });
    return {
      ok: true,
      mossUserId,
      credentialRef: credentialId,
      jobId: jobLease.jobId,
    };
  }

  function rotateKeys() {
    const next = keyVersion + 1;
    const newKey = crypto.randomBytes(32);
    keys.set(next, newKey);
    for (const record of credentials.values()) {
      if (record.revoked || !record.wrappedDek) continue;
      const oldKek = keys.get(record.keyVersion);
      const dek = unwrapDek(record.wrappedDek, oldKek);
      record.wrappedDek = wrapDek(dek, newKey, next);
      record.keyVersion = next;
    }
    keyVersion = next;
    audit({ action: "rotate-keys", keyVersion: next, tenantId: "*", credentialId: null });
    return { ok: true, keyVersion };
  }

  function getMasked({ tenantId, credentialId }) {
    const record = credentials.get(credentialId);
    if (!record || record.tenantId !== tenantId || record.revoked) return { ok: false, error: "not-found" };
    return { ok: true, id: record.id, display: record.display };
  }

  function listAudits({ tenantId }) {
    return audits
      .filter((a) => a.tenantId === tenantId || a.tenantId === "*")
      .map((a) => ({ ...a }));
  }

  function exportEncryptedBackup() {
    const portable = [];
    for (const c of credentials.values()) {
      if (c.revoked || !c.wrappedDek || !c.ciphertext) continue;
      const kek = keys.get(c.keyVersion);
      if (!kek) continue;
      const dek = unwrapDek(c.wrappedDek, kek);
      portable.push({
        id: c.id,
        tenantId: c.tenantId,
        wrappedDek: wrapDek(dek, keys.get(1), 1),
        ciphertext: c.ciphertext,
        keyVersion: 1,
        display: c.display,
        revoked: false,
        createdAt: c.createdAt,
      });
    }
    const payload = {
      version: VAULT_VERSION,
      keyVersion: 1,
      credentials: portable,
    };
    // Always wrap backup with master (key version 1) so restore works after rotation.
    const backupKek = keys.get(1);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", backupKek, iv);
    const enc = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return {
      blob: Buffer.concat([Buffer.from([1]), iv, tag, enc]).toString("base64"),
      keyVersion: 1,
    };
  }

  function importEncryptedBackup(backup) {
    const buf = Buffer.from(backup.blob, "base64");
    const ver = buf[0];
    const kek = keys.get(ver);
    if (!kek) return { ok: false, error: "key-missing" };
    const iv = buf.subarray(1, 13);
    const tag = buf.subarray(13, 29);
    const enc = buf.subarray(29);
    const decipher = crypto.createDecipheriv("aes-256-gcm", kek, iv);
    decipher.setAuthTag(tag);
    const json = Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
    const payload = JSON.parse(json);
    let count = 0;
    for (const c of payload.credentials) {
      if (c.revoked || !c.wrappedDek || !c.ciphertext) continue;
      const sourceKek = keys.get(c.keyVersion);
      if (!sourceKek) continue;
      const dek = unwrapDek(c.wrappedDek, sourceKek);
      const current = keyVersion;
      credentials.set(c.id, {
        ...c,
        wrappedDek: wrapDek(dek, keys.get(current), current),
        keyVersion: current,
        revoked: false,
      });
      count += 1;
    }
    audit({ action: "import-backup", tenantId: "*", credentialId: null });
    return { ok: true, count };
  }

  function audit(entry) {
    const safe = {
      at: now(),
      action: entry.action,
      tenantId: entry.tenantId,
      credentialId: entry.credentialId,
      jobId: entry.jobId || null,
      workerIdentity: entry.workerIdentity || null,
      actor: entry.actor || null,
      reason: entry.reason || null,
      keyVersion: entry.keyVersion || null,
    };
    // Never persist numeric IDs in audit
    audits.push(safe);
  }

  return {
    store,
    replace,
    delete: deleteCredential,
    decryptForSubmission,
    rotateKeys,
    getMasked,
    listAudits,
    exportEncryptedBackup,
    importEncryptedBackup,
    VAULT_VERSION,
  };
}

function isNumericId(id) {
  return /^\d{1,12}$/.test(String(id || ""));
}

function maskId(id) {
  const s = String(id);
  if (s.length <= 2) return "***";
  return `***${s.slice(-2)}`;
}

function wrapDek(dek, kek, version) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", kek, iv);
  const enc = Buffer.concat([cipher.update(dek), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([Buffer.from([version]), iv, tag, enc]).toString("base64");
}

function unwrapDek(wrapped, kek) {
  const buf = Buffer.from(wrapped, "base64");
  const iv = buf.subarray(1, 13);
  const tag = buf.subarray(13, 29);
  const enc = buf.subarray(29);
  const decipher = crypto.createDecipheriv("aes-256-gcm", kek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]);
}

function encryptId(mossUserId, dek) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", dek, iv);
  const enc = Buffer.concat([cipher.update(String(mossUserId), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64");
}

function decryptId(ciphertext, dek) {
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const enc = buf.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", dek, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
}

function validateCredentialVaultModule() {
  const errors = [];
  const v = createCredentialVault({ masterKey: Buffer.alloc(32, 3) });
  const s = v.store({ tenantId: "ten", mossUserId: "42424", actor: "u" });
  if (!s.ok || s.display !== "***24" || s.plaintext) errors.push("store");

  const cross = v.decryptForSubmission({
    credentialId: s.id,
    tenantId: "other",
    workerIdentity: ALLOWED_WORKER,
    jobLease: { jobId: "j", tenantId: "other", valid: true },
  });
  if (cross.ok || cross.error !== "cross-tenant") errors.push("cross");

  const badWorker = v.decryptForSubmission({
    credentialId: s.id,
    tenantId: "ten",
    workerIdentity: "browser",
    jobLease: { jobId: "j", tenantId: "ten", valid: true },
  });
  if (badWorker.error !== "worker-identity") errors.push("worker");

  const ok = v.decryptForSubmission({
    credentialId: s.id,
    tenantId: "ten",
    workerIdentity: ALLOWED_WORKER,
    jobLease: { jobId: "j", tenantId: "ten", valid: true },
  });
  if (!ok.ok || ok.mossUserId !== "42424") errors.push("decrypt");

  v.rotateKeys();
  const after = v.decryptForSubmission({
    credentialId: s.id,
    tenantId: "ten",
    workerIdentity: ALLOWED_WORKER,
    jobLease: { jobId: "j2", tenantId: "ten", valid: true },
  });
  if (!after.ok) errors.push("rotate");

  v.delete({ tenantId: "ten", credentialId: s.id, actor: "u" });
  const del = v.decryptForSubmission({
    credentialId: s.id,
    tenantId: "ten",
    workerIdentity: ALLOWED_WORKER,
    jobLease: { jobId: "j3", tenantId: "ten", valid: true },
  });
  if (del.ok) errors.push("deleted");

  const audits = v.listAudits({ tenantId: "ten" });
  if (audits.some((a) => /42424/.test(JSON.stringify(a)))) errors.push("audit");

  const backup = v.exportEncryptedBackup();
  if (/42424/.test(backup.blob)) errors.push("backup-plain");

  return { ok: errors.length === 0, errors, version: VAULT_VERSION };
}

module.exports = {
  VAULT_VERSION,
  ALLOWED_WORKER,
  createCredentialVault,
  validateCredentialVaultModule,
  maskId: maskId,
  isNumericId,
};
