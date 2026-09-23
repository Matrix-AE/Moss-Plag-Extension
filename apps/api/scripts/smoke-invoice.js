"use strict";

/**
 * Smoke-test the invoice-on-payment flow from apps/api/.env.
 * Builds a real Pair-plan invoice PDF and emails it via Resend (with the
 * PDF attached), exercising the exact createInvoiceService.sendForPurchase
 * path that fires on a successful purchase.
 *
 * Usage (PowerShell):
 *   $env:RESEND_TEST_TO = "you@example.com"   # defaults to RESEND_FROM_EMAIL
 *   node apps/api/scripts/smoke-invoice.js
 *   node apps/api/scripts/smoke-invoice.js you@example.com batch --pdf-only
 */

const fs = require("node:fs");
const path = require("node:path");
const offer = require("../commerce/customer-offer");
const { createInvoiceService } = require("../invoice/invoice-service");
const { buildInvoicePdf } = require("../invoice/generate-invoice");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
  return true;
}

async function main() {
  const apiDir = path.resolve(__dirname, "..");
  const loaded = loadEnvFile(path.join(apiDir, ".env")) || loadEnvFile(path.join(apiDir, ".env.local"));
  if (!loaded) {
    console.error("No apps/api/.env or .env.local found (need RESEND_API_KEY, RESEND_FROM_EMAIL).");
    process.exit(1);
  }

  const args = process.argv.slice(2).filter((a) => a);
  const pdfOnly = args.includes("--pdf-only");
  const planId = (args.find((a) => a === "pair" || a === "batch")) || "pair";
  const to = process.env.RESEND_TEST_TO || args.find((a) => a.includes("@")) || process.env.RESEND_FROM_EMAIL;
  if (!to && !pdfOnly) {
    console.error("Set RESEND_TEST_TO or pass an email address, or use --pdf-only.");
    process.exit(1);
  }

  const selectedOffer = offer.getPaidOfferOrThrow(planId);
  const stamp = Date.now();
  const sessionId = `cs_smoke${stamp.toString(16)}`;
  const ctx = {
    event: {
      userId: "smoke-user",
      email: to,
      sessionId,
      planId,
      paymentProvider: "mock",
    },
    record: {
      userId: "smoke-user",
      planId,
      planName: selectedOffer.name,
      priceUsd: selectedOffer.priceUsd,
      currency: selectedOffer.currency,
      total: selectedOffer.runsIncluded,
      maxFilesPerRun: selectedOffer.maxFilesPerRun,
      purchasedAt: stamp,
    },
    selectedOffer,
    paymentReference: `mock_${sessionId}`,
    purchasedAt: new Date(stamp).toISOString(),
  };

  const invoice = createInvoiceService({ findUserById: async () => ({ email: to }) });

  // Always write a local copy for inspection.
  const model = invoice.buildInvoiceModel({ ...ctx, customerEmail: to });
  const pdf = await buildInvoicePdf(model);
  const outFile = path.join(apiDir, "invoice", `sample-${planId}-invoice.pdf`);
  fs.writeFileSync(outFile, pdf);
  console.log("PDF written:", outFile, `(${pdf.length} bytes)`, "invoice:", model.invoiceNumber);

  if (pdfOnly) return;

  const key = process.env.RESEND_API_KEY || "";
  console.log("from:", process.env.RESEND_FROM_EMAIL, "| to:", to, "| key:", key ? `${key.slice(0, 5)}… (len ${key.length})` : "(missing)");

  const result = await invoice.sendForPurchase(ctx);
  if (!result.ok) {
    console.error("FAIL", JSON.stringify(result));
    process.exit(1);
  }
  console.log("OK invoice email sent:", JSON.stringify({ invoiceNumber: result.invoiceNumber, to: result.email, resendId: result.resend && result.resend.id }));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
