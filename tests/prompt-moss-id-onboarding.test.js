"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "..");
const mossId = require(path.join(root, "packages/ui/moss-id"));
const { assertNumericUserId } = require(path.join(root, "packages/provider-adapter"));
const workflow = fs.readFileSync(
  path.join(root, "apps/extension/src/shared/workflow/WorkflowApp.tsx"),
  "utf8",
);
const entitlementSrc = fs.readFileSync(
  path.join(root, "apps/extension/src/shared/entitlement-demo.ts"),
  "utf8",
);
const localDoc = fs.readFileSync(
  path.join(root, "docs/engineering/extension-local-testing.md"),
  "utf8",
);
const shellDoc = fs.readFileSync(path.join(root, "docs/engineering/extension-shell.md"), "utf8");

test("P-MOSS-ID-T01 registration instruction template matches legacy UX", () => {
  const help = mossId.buildRegistrationInstructions("test123@hotmail.com");
  assert.equal(help.ok, true);
  assert.deepEqual(help.lines, ["registeruser", "mail test123@hotmail.com"]);
  assert.equal(help.body, "registeruser\nmail test123@hotmail.com");
  assert.equal(help.address, "moss@moss.stanford.edu");
  assert.match(help.headline, /Email moss@moss\.stanford\.edu/);
  assert.match(help.headline, /exactly as follows/);
  assert.equal(mossId.buildRegistrationInstructions("bad").ok, false);
});

test("P-MOSS-ID-T02 acknowledgment gate blocks userid entry until checked", () => {
  assert.equal(mossId.canEnterMossUserId({ email: "a@b.co", acknowledged: false }), false);
  assert.equal(mossId.canEnterMossUserId({ email: "a@b.co", acknowledged: true }), true);
  assert.equal(mossId.canEnterMossUserId({ email: "bad", acknowledged: true }), false);
  assert.match(workflow, /I sent the email \/ I already received my numeric Moss User ID/);
  assert.match(workflow, /canEnterId/);
});

test("P-MOSS-ID-T03 numeric userid validation aligns with assertNumericUserId and rejects purchase IDs", () => {
  assert.equal(mossId.validateMossUserId("936770554").ok, true);
  assert.doesNotThrow(() => assertNumericUserId("936770554"));
  assert.equal(mossId.validateMossUserId("12").ok, false);
  assert.equal(mossId.validateMossUserId("DemoTest1!").ok, false);
  assert.equal(mossId.validateMossUserId("pi_abc123purchase").ok, false);
  assert.equal(mossId.validateMossUserId("sk_live_notanid").ok, false);
  assert.throws(() => assertNumericUserId("abc"), /numeric/i);
});

test("P-MOSS-ID-T04 masking never exposes full userid", () => {
  const masked = mossId.maskMossUserId("936770554");
  assert.equal(masked.ok, true);
  assert.equal(masked.digits, "936770554");
  assert.match(masked.masked, /\*+0554$/);
  assert.doesNotMatch(masked.masked, /^936770554$/);
  assert.match(entitlementSrc, /localCipher/);
  assert.match(entitlementSrc, /obfuscateMossUserId/);
  assert.doesNotMatch(entitlementSrc, /storage\.sync/);
});

test("P-MOSS-ID-T05 portal stays gated until Moss ID is connected", () => {
  assert.equal(
    mossId.resolveOnboardingGate({ account: { email: "a@b.co" }, entitled: true, mossConnected: false }),
    "moss-id",
  );
  assert.equal(
    mossId.resolveOnboardingGate({ account: { email: "a@b.co" }, entitled: true, mossConnected: true }),
    "portal",
  );
  assert.equal(mossId.isPortalUnlocked({ entitled: true, mossConnected: false }), false);
  assert.equal(mossId.isPortalUnlocked({ entitled: true, mossConnected: true }), true);
  assert.match(workflow, /gate === "moss-id"/);
  assert.match(workflow, /Connect Moss (User )?ID|Save Moss User ID/);
  assert.match(workflow, /!mossConnected/);
  assert.match(workflow, /does not send the message|never send that email/i);
});

test("P-MOSS-ID-T06 production account auth is server-backed and OTP verified", () => {
  assert.match(workflow, /registerAccount/);
  assert.match(workflow, /loginAccount/);
  assert.match(workflow, /verifyAccountOtp/);
  assert.match(workflow, /GoogleIcon|loginWithSocialProvider|"Google"/);
  assert.match(workflow, /MicrosoftIcon|Outlook|loginWithSocialProvider/);
  assert.match(localDoc, /email|OTP|verification/i);
});

test("P-MOSS-ID-T07 no auto-send and no raw MOSS TCP in extension", () => {
  assert.doesNotMatch(workflow, /mailto:moss@moss\.stanford\.edu/);
  assert.doesNotMatch(workflow, /fetch\(.*moss@moss/);
  assert.doesNotMatch(workflow, /:7690/);
  assert.doesNotMatch(workflow, /node:net|createConnection/);
  assert.match(workflow, /REGISTRATION_ADDRESS|does not send the message|never send that email/i);
  assert.match(shellDoc, /Moss User ID|moss-id|Connect Moss/i);
  assert.equal(mossId.validateMossIdModule().ok, true);
  assert.equal(mossId.REGISTRATION_ADDRESS, "moss@moss.stanford.edu");
});
