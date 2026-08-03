# Provider Capacity Configuration

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 072 — Finalize Provider Capacity Configuration |
| Module | `apps/api/commerce/provider-capacity.js` |
| Status | Accepted versioned capabilities (conservative) |
| Evidence | [`../compliance/moss-service-research.md`](../compliance/moss-service-research.md) |

## Evidence Reconciliation

| Value | Source | Notes |
| --- | --- | --- |
| 100 submissions/day/userid | Public Moss materials | Enforced as provider ceiling awareness |
| Reset timezone | **Not published** | `resetTimezone: null` — do not invent |
| Public SLA | **No published SLA** | `publicSlaFound: false`; do not promise availability % |
| Overload warnings | Public materials warn of overload | Escalation disables new submissions |

## Versioned Capabilities (`CAPACITY_VERSION = 1`)

| Category | Limit |
| --- | --- |
| Credential quota | 1 active BYO userid per tenant |
| Concurrency | 2 in-flight/tenant; 20 global |
| Files / groups / bytes | 100 / 50 / 32 MiB per submission |
| Timeouts | submit 120s; result poll 300s; idle 600s |
| Consumption event | Provider-accepted submission |
| Customer allowance | Non-renewing purchased allowance (Prompt 073) |

## Operational Plan Scenarios

Launch peak, outage, exhaustion, growth, contract change, and termination are encoded in `operationalCapacityPlan()`. Stress coverage includes conservative high-use validation and provider-outage degraded mode (`disable-new-submissions`).

## Constraints

- Never invent reset timezone.
- Never promise greater availability, retention, capacity, or support than written/public terms provide.
- Forecasts are planning-only, not customer SLA.

## Verification

`tests/prompt-072-provider-capacity.test.js`
