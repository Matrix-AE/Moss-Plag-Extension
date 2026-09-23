"use strict";

/*
 * PairProof / Matrix-AE — PDF invoice generator.
 *
 * buildInvoicePdf(invoice, opts) -> Promise<Buffer>
 *
 * Pure pdfkit (no headless browser) so it runs anywhere the API runs.
 * The same module produces the customer's invoice at runtime and the
 * sample we review, so what we review is exactly what ships.
 */

const PDFDocument = require("pdfkit");
const path = require("path");

const DEFAULT_LOGO = path.join(__dirname, "assets", "matrix-ae-logo.png");

const C = {
  ink: "#0F172A",
  sub: "#475569",
  muted: "#64748B",
  faint: "#94A3B8",
  accent: "#4F46E5",
  accentDeep: "#4338CA",
  accentSoft: "#EEF2FF",
  line: "#E5E7EB",
  panel: "#F8FAFC",
  green: "#047857",
  greenSoft: "#ECFDF5",
  greenLine: "#A7F3D0",
  white: "#FFFFFF",
};

function money(amount, currency) {
  const n = Number(amount || 0).toFixed(2);
  const withCommas = n.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (currency === "USD") return "$" + withCommas;
  return (currency || "") + " " + withCommas;
}

function computeTotals(invoice) {
  const items = invoice.items || [];
  const subtotal = items.reduce((s, it) => s + Number(it.qty || 1) * Number(it.unitPrice || 0), 0);
  const taxRate = Number(invoice.taxRate || 0);
  const tax = +(subtotal * taxRate).toFixed(2);
  const total = +(subtotal + tax).toFixed(2);
  return { subtotal, tax, taxRate, total };
}

function buildInvoicePdf(invoice, opts = {}) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 48,
        info: {
          Title: `Invoice ${invoice.invoiceNumber || ""}`,
          Author: (invoice.seller && invoice.seller.name) || "Matrix-AE",
          Subject: "Payment receipt / tax invoice",
        },
      });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);
      render(doc, invoice, opts);
      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

function render(doc, invoice, opts) {
  const currency = invoice.currency || "USD";
  const { subtotal, tax, taxRate, total } = computeTotals(invoice);
  const seller = invoice.seller || {};
  const customer = invoice.customer || {};
  const support = invoice.support || {};
  const refund = invoice.refund || {};

  const M = 48;
  const pageW = doc.page.width;
  const right = pageW - M;
  const contentW = pageW - M * 2;

  // ---- Header band -------------------------------------------------------
  let y = M;

  // Logo (left)
  const logoPath = opts.logoPath === undefined ? DEFAULT_LOGO : opts.logoPath;
  let textX = M;
  if (logoPath) {
    try {
      doc.image(logoPath, M, y - 2, { height: 44 });
      textX = M + 58;
    } catch (_) {
      textX = M;
    }
  }
  doc.font("Helvetica-Bold").fontSize(16).fillColor(C.ink).text(seller.name || "Matrix-AE", textX, y + 2);
  doc.font("Helvetica").fontSize(8.5).fillColor(C.muted).text(seller.brandLine || "PairProof · Code similarity, verified", textX, y + 22);

  // INVOICE title (right)
  doc.font("Helvetica-Bold").fontSize(26).fillColor(C.accent).text("INVOICE", right - 240, y - 2, { width: 240, align: "right" });
  doc.font("Helvetica").fontSize(9).fillColor(C.muted).text(invoice.invoiceNumber || "", right - 240, y + 30, { width: 240, align: "right" });

  y += 62;

  // Accent rule
  doc.save().rect(M, y, contentW, 3).fill(C.accent).restore();
  y += 22;

  // ---- Parties + details -------------------------------------------------
  const colGap = 24;
  const colW = (contentW - colGap) / 2;
  const leftX = M;
  const rightX = M + colW + colGap;
  const blockTop = y;

  // Left: Billed to
  doc.font("Helvetica-Bold").fontSize(8).fillColor(C.faint).text("BILLED TO", leftX, y, { characterSpacing: 0.8 });
  doc.font("Helvetica-Bold").fontSize(11).fillColor(C.ink).text(customer.name || customer.email || "Customer", leftX, y + 13);
  let ly = y + 13 + 15;
  if (customer.name && customer.email) {
    doc.font("Helvetica").fontSize(9.5).fillColor(C.sub).text(customer.email, leftX, ly);
    ly += 14;
  }
  if (customer.userId) {
    doc.font("Helvetica").fontSize(8.5).fillColor(C.muted).text("Account: " + customer.userId, leftX, ly);
    ly += 13;
  }

  // Left: From (below billed-to)
  ly += 8;
  doc.font("Helvetica-Bold").fontSize(8).fillColor(C.faint).text("FROM", leftX, ly, { characterSpacing: 0.8 });
  ly += 13;
  doc.font("Helvetica-Bold").fontSize(9.5).fillColor(C.ink).text(seller.name || "Matrix-AE", leftX, ly);
  ly += 13;
  const fromLines = [seller.email, seller.website].concat(seller.addressLines || []).filter(Boolean);
  doc.font("Helvetica").fontSize(9).fillColor(C.sub);
  fromLines.forEach((line) => {
    doc.text(line, leftX, ly);
    ly += 13;
  });

  // Right: details panel
  const rows = [
    ["Invoice number", invoice.invoiceNumber],
    ["Transaction ID", invoice.orderId],
    ["Invoice date", invoice.invoiceDate],
    ["Payment date", invoice.paymentDate || invoice.invoiceDate],
    ["Payment method", invoice.paymentMethod || "Safepay"],
  ].filter((r) => r[1]);

  const panelPadX = 16;
  const panelPadY = 14;
  const rowH = 22;
  const statusRowH = 30;
  const dValX = rightX + panelPadX + colW * 0.42;
  const dValW = colW - panelPadX * 2 - colW * 0.42;
  doc.font("Helvetica-Bold").fontSize(8.5);
  const rowHeights = rows.map(([, val]) => Math.max(rowH, doc.heightOfString(String(val), { width: dValW, align: "right" }) + 9));
  const panelH = panelPadY * 2 + rowHeights.reduce((a, b) => a + b, 0) + statusRowH;
  doc.save().roundedRect(rightX, blockTop, colW, panelH, 8).fill(C.panel).restore();
  doc.save().roundedRect(rightX, blockTop, colW, panelH, 8).lineWidth(1).stroke(C.line).restore();

  let py = blockTop + panelPadY;
  rows.forEach(([label, val], i) => {
    doc.font("Helvetica").fontSize(8.5).fillColor(C.muted).text(label, rightX + panelPadX, py + 3, { width: colW * 0.40 });
    doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.ink).text(String(val), dValX, py + 2.5, { width: dValW, align: "right" });
    py += rowHeights[i];
  });
  // Status row with PAID pill
  doc.save().moveTo(rightX + panelPadX, py + 2).lineTo(rightX + colW - panelPadX, py + 2).lineWidth(0.75).stroke(C.line).restore();
  doc.font("Helvetica").fontSize(8.5).fillColor(C.muted).text("Status", rightX + panelPadX, py + 11);
  const pillW = 64;
  const pillH = 20;
  const pillX = rightX + colW - panelPadX - pillW;
  const pillY = py + 6;
  doc.save().roundedRect(pillX, pillY, pillW, pillH, 10).fill(C.greenSoft).restore();
  doc.save().roundedRect(pillX, pillY, pillW, pillH, 10).lineWidth(1).stroke(C.greenLine).restore();
  doc.circle(pillX + 15, pillY + pillH / 2, 3).fill(C.green);
  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.green).text("PAID", pillX + 24, pillY + 6);

  y = Math.max(ly, blockTop + panelH) + 26;

  // ---- Line items table --------------------------------------------------
  const cols = {
    desc: leftX,
    qty: leftX + contentW * 0.60,
    unit: leftX + contentW * 0.72,
    amount: leftX + contentW * 0.86,
  };
  const tableRight = leftX + contentW;

  // Header
  doc.save().rect(leftX, y, contentW, 26).fill(C.ink).restore();
  doc.font("Helvetica-Bold").fontSize(8.5).fillColor(C.white);
  doc.text("DESCRIPTION", cols.desc + 12, y + 9, { characterSpacing: 0.5 });
  doc.text("QTY", cols.qty, y + 9, { width: contentW * 0.10, align: "center" });
  doc.text("UNIT PRICE", cols.unit - 6, y + 9, { width: contentW * 0.14, align: "right" });
  doc.text("AMOUNT", cols.amount - 6, y + 9, { width: tableRight - cols.amount, align: "right" });
  y += 26;

  // Rows
  const items = invoice.items || [];
  items.forEach((it, i) => {
    const hasDetail = !!it.detail;
    const rowHeight = hasDetail ? 42 : 30;
    if (i % 2 === 1) {
      doc.save().rect(leftX, y, contentW, rowHeight).fill(C.panel).restore();
    }
    doc.font("Helvetica-Bold").fontSize(10).fillColor(C.ink).text(it.description || "", cols.desc + 12, y + 8, { width: contentW * 0.56 });
    if (hasDetail) {
      doc.font("Helvetica").fontSize(8.5).fillColor(C.muted).text(it.detail, cols.desc + 12, y + 23, { width: contentW * 0.56 });
    }
    doc.font("Helvetica").fontSize(10).fillColor(C.sub).text(String(it.qty || 1), cols.qty, y + 8, { width: contentW * 0.10, align: "center" });
    doc.text(money(it.unitPrice, currency), cols.unit - 6, y + 8, { width: contentW * 0.14, align: "right" });
    doc.font("Helvetica-Bold").fillColor(C.ink).text(money(Number(it.qty || 1) * Number(it.unitPrice || 0), currency), cols.amount - 6, y + 8, { width: tableRight - cols.amount, align: "right" });
    y += rowHeight;
    doc.save().moveTo(leftX, y).lineTo(tableRight, y).lineWidth(0.75).stroke(C.line).restore();
  });

  // ---- Totals ------------------------------------------------------------
  y += 14;
  const totalsX = leftX + contentW * 0.56;
  const totalsW = contentW * 0.44;
  const labelW = totalsW * 0.55;
  const valW = totalsW * 0.45;

  function totalRow(label, val, bold, accent) {
    doc.font(bold ? "Helvetica-Bold" : "Helvetica").fontSize(bold ? 10 : 9.5).fillColor(bold ? C.ink : C.muted)
      .text(label, totalsX, y, { width: labelW, align: "right" });
    doc.font("Helvetica-Bold").fontSize(bold ? 11 : 9.5).fillColor(accent ? C.accent : (bold ? C.ink : C.sub))
      .text(val, totalsX + labelW, y - (bold ? 1 : 0), { width: valW, align: "right" });
    y += bold ? 20 : 17;
  }
  totalRow("Subtotal", money(subtotal, currency));
  totalRow(taxRate ? `Tax (${(taxRate * 100).toFixed(0)}%)` : "Tax", money(tax, currency));
  // divider above grand total
  doc.save().moveTo(totalsX, y + 2).lineTo(totalsX + totalsW, y + 2).lineWidth(1).stroke(C.line).restore();
  y += 10;
  // grand total band
  doc.save().roundedRect(totalsX, y - 4, totalsW, 30, 6).fill(C.accentSoft).restore();
  doc.font("Helvetica-Bold").fontSize(11).fillColor(C.accentDeep).text("Total paid", totalsX + 12, y + 4, { width: labelW });
  doc.font("Helvetica-Bold").fontSize(14).fillColor(C.accentDeep).text(money(total, currency), totalsX + labelW - 12, y + 2, { width: valW, align: "right" });
  y += 40;

  // Payment confirmation line
  doc.font("Helvetica").fontSize(9).fillColor(C.green)
    .text(`Paid in full on ${invoice.paymentDate || invoice.invoiceDate} via ${invoice.paymentMethod || "Safepay"}${invoice.orderId ? " · Transaction " + invoice.orderId : ""}.`, leftX, y, { width: contentW });
  y += 28;

  // ---- Included with plan ------------------------------------------------
  const inc = invoice.includes || [];
  if (inc.length) {
    const incTop = y;
    const rowsN = Math.ceil(inc.length / 2);
    const incH = 30 + rowsN * 19;
    doc.save().roundedRect(leftX, incTop, contentW, incH, 8).fill(C.panel).restore();
    doc.save().roundedRect(leftX, incTop, contentW, incH, 8).lineWidth(1).stroke(C.line).restore();
    doc.font("Helvetica-Bold").fontSize(8).fillColor(C.faint)
      .text(`INCLUDED WITH YOUR ${(invoice.planLabel || "PLAN").toUpperCase()}`, leftX + 16, incTop + 12, { characterSpacing: 0.8 });
    const listTop = incTop + 30;
    const col2 = (contentW - 32) / 2;
    inc.forEach((t, i) => {
      const cx = leftX + 16 + (i % 2) * col2;
      const cy = listTop + Math.floor(i / 2) * 19;
      doc.save().lineWidth(1.5).strokeColor(C.green).lineJoin("round")
        .moveTo(cx, cy + 6).lineTo(cx + 3.5, cy + 9.5).lineTo(cx + 9, cy + 2).stroke().restore();
      doc.font("Helvetica").fontSize(9.5).fillColor(C.sub).text(t, cx + 16, cy + 1, { width: col2 - 24 });
    });
    y = incTop + incH + 8;
  }

  // ---- Footer ------------------------------------------------------------
  const footerTop = Math.max(y, doc.page.height - 150);
  doc.save().moveTo(M, footerTop).lineTo(right, footerTop).lineWidth(1).stroke(C.line).restore();
  let fy = footerTop + 14;

  doc.font("Helvetica-Bold").fontSize(9).fillColor(C.ink).text("Need help with this invoice?", M, fy);
  fy += 14;
  const supportEmail = support.email || seller.email || "support@matrix-ae.com";
  doc.font("Helvetica").fontSize(9).fillColor(C.sub)
    .text(`Contact ${supportEmail}` + (support.hours ? ` · ${support.hours}` : ""), M, fy);
  fy += 15;

  if (refund.line) {
    doc.font("Helvetica-Bold").fontSize(9).fillColor(C.ink).text("Refund & returns", M, fy);
    fy += 13;
    doc.font("Helvetica").fontSize(8.5).fillColor(C.muted).text(refund.line + (refund.url ? ` Full policy: ${refund.url}` : ""), M, fy, { width: contentW });
    fy += 24;
  }

  doc.font("Helvetica").fontSize(8).fillColor(C.faint)
    .text(`${seller.legalName || seller.name || "Matrix-AE"} · ${seller.email || "team@matrix-ae.com"} — Thank you for choosing ${seller.brand || "PairProof"}.`, M, doc.page.height - 60, { width: contentW, align: "center" });
}

module.exports = { buildInvoicePdf, computeTotals, money };
