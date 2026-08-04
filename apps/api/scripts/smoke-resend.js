"use strict";

/**
 * Smoke-test Resend from apps/api/.env
 * Usage (PowerShell):
 *   $env:RESEND_TEST_TO = "you@example.com"
 *   node apps/api/scripts/smoke-resend.js
 */

const fs = require("node:fs");
const path = require("node:path");
const { sendMagicCodeEmail, sendResendEmail } = require("../auth/resend-mail");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const text = fs.readFileSync(filePath, "utf8");
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
  return true;
}

async function main() {
  const apiDir = path.resolve(__dirname, "..");
  const loaded =
    loadEnvFile(path.join(apiDir, ".env")) ||
    loadEnvFile(path.join(apiDir, ".env.local"));
  if (!loaded) {
    console.error("No apps/api/.env or .env.local found.");
    console.error("Create apps/api/.env with RESEND_API_KEY and RESEND_FROM_EMAIL.");
    process.exit(1);
  }

  const to = process.env.RESEND_TEST_TO || process.argv[2];
  if (!to) {
    console.error("Set RESEND_TEST_TO or pass an email: node apps/api/scripts/smoke-resend.js you@example.com");
    process.exit(1);
  }

  const key = process.env.RESEND_API_KEY || "";
  console.log("from:", process.env.RESEND_FROM_EMAIL || "(missing)");
  console.log("to:", to);
  console.log("key:", key ? `${key.slice(0, 5)}… (len ${key.length})` : "(missing)");

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const result = await sendMagicCodeEmail({ to, code });
  if (!result.ok) {
    console.error("FAIL", result);
    // Also probe account with a raw call for clearer errors
    const probe = await sendResendEmail({
      to,
      subject: "Moss Resend probe",
      text: "probe",
    });
    if (!probe.ok) console.error("PROBE", probe);
    process.exit(1);
  }
  console.log("OK sent magic-code email id=", result.id, "code=", code);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
