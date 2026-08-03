# Consent and Data-Rights Copy

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 078 |
| Consent copy version | **1.1.0** |
| Module | `apps/api/legal/consent-copy.js` |
| Locale | en-US baseline; localized-ready structure |
| Surfaces | preview, checkout, review, settings |

## Layered Copy

**Short:** Your files leave this device for encrypted product upload and external similarity processing. Report links are bearer secrets.

**Detailed:** Adults **18+** only. Backend and provider process source temporarily. Browser/clipboard copies of report URLs are outside our control. Legal retention exceptions may apply to payment records. Institutional/minor datasets are outside this personal MVP.

## Defaults and Gating

All consent checkboxes are **unselected** by default and cannot waive product duties. Submit requires ownership, sensitive-link acknowledgment, 18+ confirmation, and matching policy version.

## Reset Triggers

Files, groups, language, provider, settings, or policy version changes reset consent.

## Data-Rights Instructions

- Export: account/entitlement/job metadata — no source bytes
- Delete: account deletion subject to payment/tax holds
- Forget link: removes product-stored URLs only — not provider or browser copies

## Evidence

Auditable consent evidence stores version and timestamps without source content.

## Verification

`tests/prompt-078-consent-copy.test.js`
