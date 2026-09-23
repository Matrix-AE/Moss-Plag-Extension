"use strict";

/**
 * Invoice service — on a successful payment, build a PDF invoice and email it
 * to the customer via Resend. Provider-agnostic: driven by the entitlement
 * service's applyPurchase() success, so it works for the mock flow today and
 * any real gateway (Safepay/Stripe) that posts a signed webhook later.
 *
 * All methods are best-effort and never throw; sendForPurchase returns a
 * result object so the caller can log without affecting the payment result.
 */

const { buildInvoicePdf } = require("./generate-invoice");
const { sendResendEmail } = require("../auth/resend-mail");
const offer = require("../commerce/customer-offer");

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function fmtDate(value) {
  const d = value instanceof Date ? value : new Date(typeof value === "number" ? value : String(value || ""));
  if (isNaN(d.getTime())) return String(value || "");
  return `${String(d.getUTCDate()).padStart(2, "0")} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

function yearOf(value) {
  const d = value instanceof Date ? value : new Date(typeof value === "number" ? value : String(value || ""));
  return isNaN(d.getTime()) ? new Date().getUTCFullYear() : d.getUTCFullYear();
}

function invoiceNumber(paymentReference, when) {
  const suffix = String(paymentReference || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(-10) || "00000000";
  return `INV-${yearOf(when)}-${suffix}`;
}

function money(n) {
  return "$" + Number(n || 0).toFixed(2);
}

function createInvoiceService(opts = {}) {
  const sendEmail = opts.sendEmail || sendResendEmail;
  const findUserById = opts.findUserById || null;
  const getOffer =
    opts.getOffer ||
    ((id) => {
      try {
        return offer.getPaidOfferOrThrow(id);
      } catch {
        return null;
      }
    });
  const apiKey = opts.apiKey || process.env.RESEND_API_KEY;
  const from = opts.from || process.env.RESEND_FROM_EMAIL || "team@matrix-ae.com";
  const supportEmail = opts.supportEmail || process.env.PUBLIC_SUPPORT_EMAIL || from;
  const legalName = opts.legalName || "Matrix-AE";
  const brand = opts.brand || "PairProof";
  const website = opts.website || "matrix-ae.com";
  const refundUrl = opts.refundUrl || null;
  const paymentMethodLabel = opts.paymentMethodLabel || "Safepay";
  const logoPath = opts.logoPath; // undefined -> generator default asset
  const log = opts.log || ((...a) => console.error(...a));

  function buildInvoiceModel(ctx) {
    const { record = {}, event = {}, paymentReference, purchasedAt, customerEmail } = ctx;
    const selectedOffer = ctx.selectedOffer || getOffer(record.planId || event.planId) || {};

    const planName = selectedOffer.name || record.planName || "PairProof";
    const price = selectedOffer.priceUsd != null ? selectedOffer.priceUsd : record.priceUsd || 0;
    const currency = selectedOffer.currency || record.currency || "USD";
    const runs = selectedOffer.runsIncluded != null ? selectedOffer.runsIncluded : record.total;
    const maxFiles = selectedOffer.maxFilesPerRun != null ? selectedOffer.maxFilesPerRun : record.maxFilesPerRun;
    const deviceLimit = selectedOffer.deviceLimit;
    const months = selectedOffer.hostedOperabilityMonths;
    const refundDays = selectedOffer.refundDaysUnused != null ? selectedOffer.refundDaysUnused : 14;

    const whenIso = purchasedAt || record.purchasedAt || Date.now();
    const dateStr = fmtDate(whenIso);
    const orderId = event.sessionId || paymentReference;
    const provider = event.paymentProvider;
    const paymentMethod =
      provider && provider !== "mock"
        ? provider.charAt(0).toUpperCase() + provider.slice(1)
        : paymentMethodLabel;

    const includes = [];
    if (runs != null) includes.push(`${runs} hosted similarity runs`);
    if (maxFiles != null) includes.push(`Up to ${maxFiles} file${maxFiles === 1 ? "" : "s"} per run`);
    if (deviceLimit != null) includes.push(`${deviceLimit} activated device${deviceLimit === 1 ? "" : "s"}`);
    if (months != null) includes.push(`${months} months hosted availability`);

    const detailBits = [];
    if (runs != null) detailBits.push(`${runs} hosted similarity runs`);
    if (maxFiles != null) detailBits.push(`up to ${maxFiles} files per run`);
    detailBits.push("one-time purchase");

    return {
      invoiceNumber: invoiceNumber(paymentReference, whenIso),
      orderId,
      invoiceDate: dateStr,
      paymentDate: dateStr,
      paymentMethod,
      status: "PAID",
      currency,
      seller: {
        name: legalName,
        legalName,
        brand,
        brandLine: `${brand} · Code similarity, verified`,
        email: from,
        website,
      },
      customer: { email: customerEmail || event.email || "", userId: record.userId || event.userId },
      items: [
        {
          description: `${brand} — ${planName} plan`,
          detail: detailBits.join(" · "),
          qty: 1,
          unitPrice: price,
        },
      ],
      planLabel: `${planName} plan`,
      includes,
      taxRate: 0,
      support: { email: supportEmail },
      refund: { line: `${refundDays}-day refund if hosted runs remain unused.`, url: refundUrl },
    };
  }

  function buildEmail(inv) {
    const total = inv.items.reduce((s, it) => s + it.qty * it.unitPrice, 0);
    const subject = `Your ${inv.seller.brand} invoice — ${inv.planLabel} (${money(total)}) · ${inv.invoiceNumber}`;
    const text = [
      `${inv.seller.legalName} / ${inv.seller.brand} — Payment received`,
      ``,
      `Your ${inv.planLabel} is active. Invoice attached (PDF).`,
      ``,
      `Invoice: ${inv.invoiceNumber}`,
      `Transaction ID: ${inv.orderId}`,
      `Date: ${inv.paymentDate}`,
      `Item: ${inv.items[0].description}`,
      `Payment method: ${inv.paymentMethod}`,
      `Amount paid: ${money(total)} ${inv.currency}`,
      ``,
      `Billed to: ${inv.customer.email}`,
      `Support: ${inv.support.email}`,
      `Refunds: ${inv.refund.line}${inv.refund.url ? " (" + inv.refund.url + ")" : ""}`,
      ``,
      `${inv.seller.legalName} · ${inv.seller.email}`,
    ].join("\n");

    const refundHtml = `${inv.refund.line}${inv.refund.url ? " Full policy: " + inv.refund.url : ""}`;
    const html = `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,Helvetica,sans-serif;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;padding:28px 20px">
    <div style="background:#ffffff;border:1px solid #e5e7eb;border-radius:14px;overflow:hidden">
      <div style="background:#4f46e5;padding:22px 26px;color:#fff">
        <div style="font-size:13px;letter-spacing:.12em;opacity:.85">${inv.seller.legalName.toUpperCase()} · ${inv.seller.brand.toUpperCase()}</div>
        <div style="font-size:21px;font-weight:700;margin-top:4px">Payment received — thank you!</div>
      </div>
      <div style="padding:24px 26px">
        <p style="margin:0 0 14px;font-size:15px;line-height:1.5">Your payment was successful and your <strong>${inv.planLabel}</strong> is now active. Your invoice is attached as a PDF.</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin:8px 0 4px">
          <tr><td style="padding:7px 0;color:#64748b">Invoice</td><td style="padding:7px 0;text-align:right;font-weight:700">${inv.invoiceNumber}</td></tr>
          <tr><td style="padding:7px 0;color:#64748b">Transaction ID</td><td style="padding:7px 0;text-align:right;font-weight:700;word-break:break-all">${inv.orderId}</td></tr>
          <tr><td style="padding:7px 0;color:#64748b">Date</td><td style="padding:7px 0;text-align:right;font-weight:700">${inv.paymentDate}</td></tr>
          <tr><td style="padding:7px 0;color:#64748b">Item</td><td style="padding:7px 0;text-align:right;font-weight:700">${inv.items[0].description}</td></tr>
          <tr><td style="padding:7px 0;color:#64748b">Payment method</td><td style="padding:7px 0;text-align:right;font-weight:700">${inv.paymentMethod}</td></tr>
          <tr><td style="padding:10px 0 4px;border-top:1px solid #e5e7eb;color:#4f46e5;font-weight:700">Amount paid</td><td style="padding:10px 0 4px;border-top:1px solid #e5e7eb;text-align:right;color:#4f46e5;font-weight:800;font-size:17px">${money(total)} ${inv.currency}</td></tr>
        </table>
        <div style="margin:18px 0 6px;padding:14px 16px;background:#f8fafc;border:1px solid #e5e7eb;border-radius:10px;font-size:13px;color:#475569;line-height:1.55">
          <strong style="color:#0f172a">Need help?</strong> Contact ${inv.support.email}.<br/>
          <strong style="color:#0f172a">Refunds:</strong> ${refundHtml}
        </div>
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8">Billed to ${inv.customer.email} · ${inv.seller.legalName} · ${inv.seller.email}</p>
      </div>
    </div>
    <p style="text-align:center;color:#94a3b8;font-size:12px;margin:16px 0 0">Thank you for choosing ${inv.seller.brand}.</p>
  </div></body></html>`;

    return { subject, text, html };
  }

  async function resolveEmail(ctx) {
    if (ctx.customerEmail) return ctx.customerEmail;
    if (ctx.event && ctx.event.email) return ctx.event.email;
    const userId = ctx.event && ctx.event.userId;
    if (userId && findUserById) {
      try {
        const user = await findUserById(userId);
        if (user && user.email) return user.email;
      } catch (error) {
        log("[invoice] findUserById failed", error?.message || String(error));
      }
    }
    return null;
  }

  async function sendForPurchase(ctx = {}) {
    try {
      const customerEmail = await resolveEmail(ctx);
      if (!customerEmail) return { ok: false, error: "customer-email-unresolved" };

      const inv = buildInvoiceModel({ ...ctx, customerEmail });
      const pdf = await buildInvoicePdf(inv, logoPath === undefined ? {} : { logoPath });
      const { subject, text, html } = buildEmail(inv);
      const filename = `${inv.seller.brand}-invoice-${inv.invoiceNumber}.pdf`;

      const res = await sendEmail({
        apiKey,
        from,
        to: customerEmail,
        subject,
        text,
        html,
        attachments: [{ filename, content: Buffer.from(pdf).toString("base64") }],
      });

      if (!res || !res.ok) {
        log("[invoice] resend send failed", JSON.stringify(res || {}));
      }
      return { ok: !!(res && res.ok), email: customerEmail, invoiceNumber: inv.invoiceNumber, resend: res };
    } catch (error) {
      log("[invoice] sendForPurchase failed", error?.message || String(error));
      return { ok: false, error: "invoice-send-failed", detail: error?.message || String(error) };
    }
  }

  return { buildInvoiceModel, buildEmail, sendForPurchase };
}

module.exports = { createInvoiceService };
