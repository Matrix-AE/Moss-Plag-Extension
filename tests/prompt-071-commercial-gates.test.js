"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const gates = require(path.join(root, "apps/api/commerce/commercial-gates"));
const doc = fs.readFileSync(path.join(root, "docs/engineering/commercial-enable-checklist.md"), "utf8");

test("P071-T01 default production stays off without rights and TLS evidence", () => {
  const cfg = gates.createCommercialGateConfig();
  assert.equal(cfg.productionEnabled, false);
  assert.equal(cfg.decision, "hold");
  const check = gates.evaluateEnablement(cfg);
  assert.equal(check.ok, false);
  assert.ok(check.blockers.includes("rights-evidence"));
  assert.ok(check.blockers.includes("encrypted-transport"));
});

test("P071-T02 encodes paid automation account model quota TLS SLA brand termination", () => {
  const cfg = gates.createCommercialGateConfig({
    rightsEvidence: "owner-attested-written-permission",
    encryptedTransportApproved: true,
    encryptedUploadEndpoint: "https://api.mossworkflow.dev/v1/uploads",
    encryptedReportScheme: "https",
  });
  assert.equal(cfg.restrictions.paidAutomationRequiresWrittenRights, true);
  assert.equal(cfg.accountModel, "byo-moss-userid-after-purchase");
  assert.equal(cfg.providerPublicDailyLimitPerUser, 100);
  assert.equal(cfg.consumptionEvent, "provider-accepted-submission");
  assert.equal(cfg.resetSemantics, "customer-allowance-non-renewing; provider-day-limit-per-userid-unspecified-tz");
  assert.equal(cfg.restrictions.byoIsNotCommercialWorkaround, true);
  assert.equal(cfg.restrictions.poolingForbidden, true);
  assert.equal(cfg.restrictions.rotationForbidden, true);
  assert.equal(cfg.restrictions.rawTcpForbidden, true);
  assert.ok(cfg.sla.productSeparateFromProvider);
  assert.ok(cfg.brand.noUnofficialAffiliation);
  assert.ok(cfg.termination.triggersStopOrPivot);
  assert.ok(cfg.owners.product);
  assert.ok(cfg.owners.security);
  assert.ok(cfg.owners.legalPrivacy);
  assert.ok(cfg.owners.operations);
  assert.match(cfg.reviewBy, /^\d{4}-\d{2}-\d{2}$/);
});

test("P071-T03 enable checklist requires cross-functional sign-off", () => {
  const unsigned = gates.signEnableChecklist({
    product: false,
    legalPrivacy: true,
    security: true,
    operations: true,
  });
  assert.equal(unsigned.ok, false);
  assert.ok(unsigned.missing.includes("product"));

  const signed = gates.signEnableChecklist({
    product: true,
    legalPrivacy: true,
    security: true,
    operations: true,
    evidenceRefs: ["ADR-0005A", "ADR-0005B", "ops-tls-endpoint"],
  });
  assert.equal(signed.ok, true);
  assert.equal(signed.signatures.length, 4);
});

test("P071-T04 kill pivot stop drills are encoded and executable", () => {
  const drill = gates.drillOperationalControls({ scenario: "provider-terms-revoked" });
  assert.equal(drill.action, "stop");
  assert.equal(drill.productionEnabled, false);
  assert.ok(drill.preserveDrafts);

  const pivot = gates.drillOperationalControls({ scenario: "encrypted-route-unavailable" });
  assert.equal(pivot.action, "kill");
  assert.equal(pivot.blocksNewJobs, true);

  const maintenance = gates.drillOperationalControls({ scenario: "provider-overload" });
  assert.equal(maintenance.action, "pivot-or-disable");
  assert.ok(maintenance.killSwitchSet);
});

test("P071-T05 monitoring copy and config export are versioned", () => {
  const cfg = gates.createCommercialGateConfig({
    rightsEvidence: "owner-attested-written-permission",
    encryptedTransportApproved: true,
  });
  const snapshot = gates.exportGateSnapshot(cfg);
  assert.equal(snapshot.version, gates.COMMERCIAL_GATE_VERSION);
  assert.ok(Array.isArray(snapshot.monitoringAlerts));
  assert.ok(snapshot.monitoringAlerts.some((a) => /tls|encrypt/i.test(a)));
  assert.ok(snapshot.customerCopy.noPooling);
  assert.match(doc, /enable checklist/i);
  assert.match(doc, /kill switch/i);
  assert.match(doc, /100 submissions/i);
  assert.match(doc, /BYO/i);
  const pkg = JSON.parse(fs.readFileSync(path.join(root, "apps/api/package.json"), "utf8"));
  assert.equal(pkg.exports["./commerce/commercial-gates"], "./commerce/commercial-gates.js");
});
