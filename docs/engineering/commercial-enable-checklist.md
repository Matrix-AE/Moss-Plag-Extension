# Commercial and Encrypted-Transport Enable Checklist

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 071 — Reconfirm Commercial and Encrypted-Transport Gates |
| Module | `apps/api/commerce/commercial-gates.js` |
| Status | Accepted gate config (production held by default) |
| Review-by | 2026-09-17 |
| Upstream ADRs | [`../adr/0005a-commercial-permission-go.md`](../adr/0005a-commercial-permission-go.md), [`../adr/0005b-byo-moss-after-purchase.md`](../adr/0005b-byo-moss-after-purchase.md) |

## Purpose

Reconfirm Prompt 005 commercial and encrypted-transport gates before any live environment or paid provider feature is enabled. Scope, volume, architecture, terms, or endpoint security may have changed during implementation.

## Encoded Restrictions

| Topic | Current encoding |
| --- | --- |
| Paid automation | Requires written rights evidence; production stays off when absent/ambiguous |
| Account model | BYO Moss userid after purchase (ADR-0005B) |
| Provider public limit | 100 submissions/day/userid (public Moss); reset timezone **not invented** |
| Consumption event | Provider-accepted submission |
| Customer allowance reset | Non-renewing purchased allowance (see Prompt 073 offer) |
| Data | Temporary source; bearer report URLs sensitive; no local-only claim |
| TLS upload/report | Approved encrypted HTTPS only; raw TCP forbidden |
| SLA | Product SLA separate from provider; do not invent public provider SLA |
| Brand | No unofficial Stanford/Moss affiliation claims |
| Termination | Rights revocation triggers stop/pivot within 5 business days |

## Non-workarounds

- BYO is the approved credential model, **not** a substitute for missing commercial rights.
- Pooling or rotating free/public accounts is permanently forbidden.
- Missing encrypted transport does **not** authorize raw TCP fallback.

## Enable Checklist (cross-functional sign-off)

Production enablement requires signatures from **product**, **legal/privacy**, **security**, and **operations**, plus evidence refs (ADRs + ops TLS endpoint record).

Default `productionEnabled` is `false`. Module `evaluateEnablement()` blocks until rights evidence and encrypted-transport approval are present.

## Kill / Pivot / Stop Drills

| Scenario | Action | Behavior |
| --- | --- | --- |
| Provider terms revoked | `stop` | Production off; preserve drafts and existing links; regenerate ADR |
| Encrypted route unavailable | `kill` | Kill switch trips; block new jobs; no raw-TCP fallback |
| Provider overload / outage | `pivot-or-disable` | Disable new work; surface maintenance copy; preserve drafts |

## Monitoring Alerts

- `production-enable-without-rights`
- `encrypted-transport-missing`
- `raw-tcp-egress-attempt`
- `provider-daily-limit-exhaustion`
- `kill-switch-tripped`

## Owners

| Role | Owner key |
| --- | --- |
| Product | `product-owner` |
| Legal / privacy | `legal-privacy-reviewer` |
| Security | `security-reviewer` |
| Operations | `operations-lead` |

## Verification

`tests/prompt-071-commercial-gates.test.js` exercises hold-by-default, restriction encoding, sign-off, and operational drills.
