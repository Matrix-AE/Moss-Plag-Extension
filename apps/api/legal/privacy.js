"use strict";

/**
 * Privacy policy and data inventory (Prompt 077).
 */

const PRIVACY_VERSION = "1.0.0";

const INVENTORY = Object.freeze({
  version: PRIVACY_VERSION,
  changeNotice: "Material inventory changes require policy version bump and user notice.",
  owner: "legal-privacy-reviewer",
  categories: Object.freeze([
    Object.freeze({
      id: "account",
      purpose: "authenticate and support the buyer",
      basis: "contract",
      owner: "api",
      retention: "account-life-plus-tax",
    }),
    Object.freeze({
      id: "payment-metadata",
      purpose: "fulfill purchase, refunds, disputes",
      basis: "contract/legal-obligation",
      owner: "finance",
      retention: "processor-and-tax-rules",
    }),
    Object.freeze({
      id: "source-code",
      purpose: "perform similarity comparison",
      basis: "consent-and-contract",
      owner: "worker",
      retention: "temporary-hours-scale",
    }),
    Object.freeze({
      id: "provider-userid",
      purpose: "submit via BYO Moss userid",
      basis: "contract",
      owner: "credential-vault",
      retention: "until-user-deletes-or-account-closed",
    }),
    Object.freeze({
      id: "result-bearer-url",
      purpose: "show similarity report link",
      basis: "contract",
      owner: "results",
      retention: "until-forget-or-history-purge",
    }),
    Object.freeze({
      id: "diagnostics",
      purpose: "security and reliability",
      basis: "legitimate-interest",
      owner: "ops",
      retention: "30-days-detailed",
    }),
  ]),
  subprocessors: Object.freeze([
    Object.freeze({ name: "Stripe", role: "payment-processor", data: "payment-metadata" }),
    Object.freeze({ name: "Hosting provider", role: "infrastructure", data: "account-jobs-encrypted-blobs" }),
    Object.freeze({
      name: "Similarity provider (Moss path)",
      role: "comparison-processor",
      data: "source-and-result-urls",
    }),
  ]),
});

function getPrivacyPolicy() {
  return Object.freeze({
    version: PRIVACY_VERSION,
    sections: Object.freeze({
      purposeBasis:
        "We process account, payment metadata, source (temporarily), provider userid, result URLs, and diagnostics to provide the purchased workflow under contract and consent where required.",
      recipients: "Subprocessors listed in the inventory: payment, hosting, similarity provider.",
      transfers: "Data may be transferred to subprocessors in other regions under appropriate safeguards.",
      retention: "Source is temporary; account/payment follow legal and tax rules; result URLs until forget/purge.",
      safeguards: "TLS in transit for product paths; encryption at rest for secrets and result metadata; access controls.",
      choices: "Forget link, delete history, export/delete account subject to legal retention exceptions.",
      rights: "Access, export, deletion, and correction requests via support contacts, subject to law.",
      minors: "Service is for adults 18+ only. Institutional/minor datasets are outside the personal MVP.",
      subprocessors: "Maintained in machine-readable inventory with change notice.",
      contacts: "privacy@mossworkflow.dev (placeholder) and product support channel.",
    }),
    claims: Object.freeze({
      localOnly: false,
      privateReports: false,
      providerDeletionGuaranteed: false,
      endToEndEncryption: false,
    }),
  });
}

function getDataInventory() {
  return INVENTORY;
}

module.exports = {
  PRIVACY_VERSION,
  getPrivacyPolicy,
  getDataInventory,
};
