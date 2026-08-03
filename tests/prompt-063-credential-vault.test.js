"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const root = path.resolve(__dirname, "..");
const vault = require(path.join(root, "apps/api/credentials/vault"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/credential-vault.md"), "utf8");

test("P063-T01 module validation", () => assert.equal(vault.validateCredentialVaultModule().ok, true));

test("P063-T02 envelope encrypt mask tenant binding", () => {
  const v = vault.createCredentialVault({ masterKey: Buffer.alloc(32, 7) });
  const stored = v.store({ tenantId: "t1", mossUserId: "12345", actor: "user:t1" });
  assert.equal(stored.ok, true);
  assert.equal(stored.display, "***45");
  assert.equal(stored.plaintext, undefined);
  assert.notEqual(stored.wrappedDek, "12345");

  const denied = v.decryptForSubmission({
    credentialId: stored.id,
    tenantId: "t2",
    workerIdentity: "submission-worker",
    jobLease: { jobId: "j1", tenantId: "t2", valid: true },
  });
  assert.equal(denied.ok, false);
  assert.equal(denied.error, "cross-tenant");

  const allowed = v.decryptForSubmission({
    credentialId: stored.id,
    tenantId: "t1",
    workerIdentity: "submission-worker",
    jobLease: { jobId: "j1", tenantId: "t1", valid: true },
  });
  assert.equal(allowed.ok, true);
  assert.equal(allowed.mossUserId, "12345");

  const nonWorker = v.decryptForSubmission({
    credentialId: stored.id,
    tenantId: "t1",
    workerIdentity: "api-handler",
    jobLease: { jobId: "j1", tenantId: "t1", valid: true },
  });
  assert.equal(nonWorker.ok, false);
  assert.equal(nonWorker.error, "worker-identity");
});

test("P063-T03 rotate revoke audit backup", () => {
  const v = vault.createCredentialVault({ masterKey: Buffer.alloc(32, 9) });
  const a = v.store({ tenantId: "t1", mossUserId: "11111", actor: "user:t1" });
  const rotated = v.rotateKeys();
  assert.equal(rotated.ok, true);
  assert.ok(rotated.keyVersion > 1);

  const still = v.decryptForSubmission({
    credentialId: a.id,
    tenantId: "t1",
    workerIdentity: "submission-worker",
    jobLease: { jobId: "j2", tenantId: "t1", valid: true },
  });
  assert.equal(still.ok, true);

  const replaced = v.replace({ tenantId: "t1", credentialId: a.id, mossUserId: "22222", actor: "user:t1" });
  assert.equal(replaced.ok, true);
  assert.equal(replaced.display, "***22");

  const del = v.delete({ tenantId: "t1", credentialId: replaced.id, actor: "user:t1" });
  assert.equal(del.ok, true);
  const gone = v.decryptForSubmission({
    credentialId: replaced.id,
    tenantId: "t1",
    workerIdentity: "submission-worker",
    jobLease: { jobId: "j3", tenantId: "t1", valid: true },
  });
  assert.equal(gone.ok, false);

  const audits = v.listAudits({ tenantId: "t1" });
  assert.ok(audits.every((e) => !/11111|22222/.test(JSON.stringify(e))));

  const backup = v.exportEncryptedBackup();
  assert.ok(backup.blob);
  assert.equal(JSON.stringify(backup).includes("11111"), false);

  const restored = vault.createCredentialVault({ masterKey: Buffer.alloc(32, 9) });
  const imp = restored.importEncryptedBackup(backup);
  assert.equal(imp.ok, true);

  assert.match(doc, /envelope encryption/i);
  assert.match(doc, /never embed/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./credentials/vault"], "./credentials/vault.js");
});
