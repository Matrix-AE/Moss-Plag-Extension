"use strict";

/**
 * BYO Moss userid onboarding helpers (ADR-0005B).
 * Registration email is always customer-sent — never automated from the product.
 */

const { maskProviderId } = require("../settings");

const REGISTRATION_ADDRESS = "moss@moss.stanford.edu";
const OFFICIAL_INFO_URL = "https://theory.stanford.edu/~aiken/moss/";

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || "").trim());
}

/**
 * Build the exact two-line body the customer must email to Moss.
 * Does not send mail — instructions only.
 */
function buildRegistrationInstructions(email) {
  const trimmed = String(email || "").trim();
  if (!isEmail(trimmed)) {
    return { ok: false, error: "invalid-email", address: REGISTRATION_ADDRESS, lines: [], body: "" };
  }
  const lines = ["registeruser", `mail ${trimmed}`];
  return {
    ok: true,
    address: REGISTRATION_ADDRESS,
    lines,
    body: lines.join("\n"),
    headline: `Email ${REGISTRATION_ADDRESS} - The text below (it should appear exactly as follows)`,
    officialInfoUrl: OFFICIAL_INFO_URL,
    email: trimmed,
  };
}

/**
 * Acknowledgement gate: valid registration email + explicit user ack required
 * before the numeric userid field is usable.
 */
function canEnterMossUserId({ email, acknowledged }) {
  return Boolean(acknowledged === true && isEmail(String(email || "").trim()));
}

/**
 * Validate numeric Moss userid (same shape as assertNumericUserId / vault).
 * Rejects passwords, purchase-looking tokens, and non-numeric input.
 */
function validateMossUserId(value) {
  const raw = String(value || "").trim();
  if (!raw) return { ok: false, error: "empty-userid", digits: "" };
  if (/password|passwd|secret/i.test(raw)) {
    return { ok: false, error: "password-forbidden", digits: "" };
  }
  // Purchase / payment IDs are never auth and never Moss userids.
  if (/^(pi_|ch_|cs_|price_|prod_|sku_|sk_)/i.test(raw) || /[a-zA-Z]/.test(raw)) {
    return { ok: false, error: "not-numeric-userid", digits: "" };
  }
  const digits = raw.replace(/\D/g, "");
  if (!/^[0-9]{3,12}$/.test(digits)) {
    return { ok: false, error: "userid-format", digits };
  }
  return { ok: true, digits };
}

function maskMossUserId(value) {
  const validated = validateMossUserId(value);
  if (!validated.ok) {
    return { ok: false, error: validated.error, masked: "", digits: validated.digits || "" };
  }
  return maskProviderId(validated.digits);
}

/**
 * Product gate after login. Purchase IDs never authenticate.
 * Portal requires an entitled account AND a connected Moss userid.
 */
function resolveOnboardingGate({ account, entitled, mossConnected }) {
  if (!account) return "auth";
  if (!entitled) return "paywall";
  if (!mossConnected) return "moss-id";
  return "portal";
}

function isPortalUnlocked({ entitled, mossConnected }) {
  return Boolean(entitled && mossConnected);
}

function validateMossIdModule() {
  const errors = [];
  const badEmail = buildRegistrationInstructions("not-an-email");
  if (badEmail.ok) errors.push("email-reject");

  const good = buildRegistrationInstructions("test123@hotmail.com");
  if (!good.ok) errors.push("email-accept");
  if (good.body !== "registeruser\nmail test123@hotmail.com") errors.push("body-template");
  if (good.address !== REGISTRATION_ADDRESS) errors.push("address");
  if (!/exactly as follows/i.test(good.headline)) errors.push("headline");

  if (canEnterMossUserId({ email: "a@b.co", acknowledged: false })) errors.push("ack-required");
  if (!canEnterMossUserId({ email: "a@b.co", acknowledged: true })) errors.push("ack-pass");

  if (validateMossUserId("12").ok) errors.push("short-id");
  if (validateMossUserId("DemoTest1!").ok) errors.push("password-as-id");
  if (validateMossUserId("pi_abc123").ok) errors.push("purchase-id");
  if (!validateMossUserId("936770554").ok) errors.push("example-id");

  const masked = maskMossUserId("936770554");
  if (!masked.ok || !masked.masked.endsWith("0554")) errors.push("mask");

  if (resolveOnboardingGate({ account: { email: "a@b.co" }, entitled: true, mossConnected: false }) !== "moss-id") {
    errors.push("gate-moss");
  }
  if (resolveOnboardingGate({ account: { email: "a@b.co" }, entitled: true, mossConnected: true }) !== "portal") {
    errors.push("gate-portal");
  }
  if (isPortalUnlocked({ entitled: true, mossConnected: false })) errors.push("portal-lock");

  return { ok: errors.length === 0, errors };
}

module.exports = {
  REGISTRATION_ADDRESS,
  OFFICIAL_INFO_URL,
  isEmail,
  buildRegistrationInstructions,
  canEnterMossUserId,
  validateMossUserId,
  maskMossUserId,
  resolveOnboardingGate,
  isPortalUnlocked,
  validateMossIdModule,
};
