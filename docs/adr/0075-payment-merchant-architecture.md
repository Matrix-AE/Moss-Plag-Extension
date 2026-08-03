# ADR 0075 — Payment and Merchant Architecture

## Document Control

| Field | Value |
| --- | --- |
| ADR ID | ADR-0075 |
| Delivery prompt | Prompt 075 — Select Payment and Merchant Architecture |
| Status | Accepted |
| Decision date | 2026-08-03 |
| Offer | Customer offer v2 ($15 / 15 runs / max 2 files) |
| Module | `apps/api/commerce/payment-architecture.js` |
| Compliance owner | legal-privacy-reviewer |

## Context

Hosted checkout must handle tax, receipts, refunds, disputes, signed webhooks, reliable events, and global data handling for a one-time personal purchase. Payment SDKs must not ship inside the Chrome extension. PCI scope must be minimized. Store/processor rules must be verified from primary sources before launch.

## Decision

**Select Stripe Checkout (hosted) with Stripe as merchant/payment processor path for MVP.**

| Attribute | Choice |
| --- | --- |
| Provider | `stripe-checkout` |
| Checkout mode | Hosted Checkout Session (no embedded card fields in extension) |
| PCI scope | SAQ-A minimized |
| Extension payment SDK | **Forbidden** |
| Price binding | Server-side price/SKU tied to offer version `2.0.0` |

## Alternatives Considered

| Candidate | Pros | Cons | Outcome |
| --- | --- | --- | --- |
| Stripe Checkout | Strong APIs/webhooks, Radar/3DS, tax add-on, sandbox | Not full MoR tax in all regions without Stripe Tax config | **Selected** |
| Paddle | MoR VAT/sales tax built-in | Higher all-in fees; catalog migration cost | Deferred alternative |
| Lemon Squeezy | MoR simplicity for digital goods | Less control for custom entitlement mapping | Deferred alternative |

## Cost and Data Flow

1. Extension opens allowlisted hosted checkout URL (no card UI in MV3).
2. Customer pays $15 USD one-time on Stripe-hosted page.
3. Signed webhook → entitlement service (Prompt 079).
4. No card numbers, bank data, or checkout secrets in extension telemetry or general API logs.

## Failure Modes

- Checkout abandon / session expiry
- Payment decline
- Webhook delay or duplicate delivery
- Refund after run consumption
- Dispute / chargeback

## Sandbox Plan

Validate at minimum: `checkout.sessions.create/retrieve`, `checkout.session.completed`, `checkout.session.expired`, `payment_intent.payment_failed`, `charge.refunded`, `charge.dispute.created`.

## Exit Strategy

Export customer entitlement ledger; introduce replacement MoR/SKU; rotate/revoke webhook signing secret; keep historical purchase references for tax/support.

## Approvals Required

Legal/privacy, finance, security, and engineering must sign before live keys are enabled (`recordApprovals()`).

## Consequences

- Prompt 076–078 publish terms/privacy/consent before checkout UI (Prompt 080).
- Prompt 079 implements webhook verification and entitlement tokens against this architecture.
- Primary-source Stripe/Chrome Web Store rules must be re-checked at launch.

## Verification

`tests/prompt-075-payment-architecture.test.js`
