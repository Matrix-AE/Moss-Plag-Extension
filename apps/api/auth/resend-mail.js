"use strict";

/**
 * Thin Resend email sender for magic-link OTPs.
 * Secrets come from env only — never hardcode API keys.
 */

async function sendResendEmail({
  apiKey = process.env.RESEND_API_KEY,
  from = process.env.RESEND_FROM_EMAIL,
  to,
  subject,
  text,
  html,
} = {}) {
  if (!apiKey || apiKey === "re_your_new_rotated_key" || apiKey.length < 20) {
    return { ok: false, error: "resend-key-missing-or-placeholder" };
  }
  if (!from) return { ok: false, error: "resend-from-missing" };
  if (!to) return { ok: false, error: "resend-to-missing" };

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject,
      text,
      html: html || undefined,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return {
      ok: false,
      error: "resend-http",
      status: response.status,
      detail: data?.message || data?.name || "unknown",
    };
  }
  return { ok: true, id: data.id || null };
}

async function sendMagicCodeEmail({ to, code, expiresInMinutes = 10 }) {
  const subject = "Your Moss Workflow sign-in code";
  const text = `Your sign-in code is ${code}. It expires in ${expiresInMinutes} minutes. If you did not request this, ignore this email.`;
  const html = `<p>Your sign-in code is <strong style="font-size:1.25rem;letter-spacing:0.08em">${code}</strong>.</p><p>It expires in ${expiresInMinutes} minutes. If you did not request this, ignore this email.</p>`;
  return sendResendEmail({ to, subject, text, html });
}

module.exports = { sendResendEmail, sendMagicCodeEmail };
