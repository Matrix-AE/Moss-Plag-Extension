# Nonfunctional Requirements and Launch Gates

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 012 — Nonfunctional Requirements and Launch Gates |
| Status | Accepted provisional NFRs for hosted BYO architecture |
| Effective date | 2026-08-03 |
| Allowance source | Prompt 006 — 40 hosted checks / 2 devices / 36-month hosted window |
| Account model | ADR-0005B BYO Moss userid after purchase |
| Architecture | ADR-0010 hosted encrypted relay |

Performance targets below are **provisional** until load/beta evidence. Do not promise permanent reports or unsupported availability.

## SLIs / SLOs (user-visible)

| ID | SLI | Initial SLO | Owner | Evidence |
| --- | --- | --- | --- | --- |
| NFR-S01 | API availability (product, excluding provider outages) | 99.5% monthly | Ops | Uptime monitor |
| NFR-S02 | Successful report rate among accepted jobs | ≥ 95% excluding upstream-attributed failures | Engineering | Job metrics |
| NFR-S03 | p95 time draft→report URL when provider healthy | ≤ 180s provisional | Engineering | Tracing |
| NFR-S04 | Source object retained past deletion backstop | **0** acknowledged breaches / month | Ops | Deletion audit |
| NFR-S05 | Consent-blocked illegal submit attempts rejected | 100% of unconfirmed submits | Engineering | API tests |

## Limits (launch gates)

| ID | Limit | Value | Gate |
| --- | --- | --- | --- |
| NFR-L01 | Hosted checks per purchase | **40** | Launch-blocking |
| NFR-L02 | Active devices | **2** | Launch-blocking |
| NFR-L03 | Hosted operability | **36 months** then EOL remedy | Launch-blocking |
| NFR-L04 | Max logical groups / job | **50** provisional | Launch-blocking |
| NFR-L05 | Max source files / job | **200** provisional | Launch-blocking |
| NFR-L06 | Max bytes / file | **2 MiB** provisional | Launch-blocking |
| NFR-L07 | Max expanded archive bytes / job | **32 MiB** provisional | Launch-blocking |
| NFR-L08 | Concurrent jobs / user | **1** provisional | Launch-blocking |
| NFR-L09 | Provider submit timeout | **120s** provisional | Launch-blocking |
| NFR-L10 | Upload session TTL | **15 minutes** | Launch-blocking |

## Compatibility

| ID | Requirement | Value | Evidence |
| --- | --- | --- | --- |
| NFR-C01 | Launch browser | Latest 2 stable Chrome major versions on desktop | Packaged E2E |
| NFR-C02 | Manifest | MV3 only | Extension package test |
| NFR-C03 | Edge/Firefox | Post-MVP | Deferred decision |

## Accessibility

| ID | Requirement | Value | Evidence |
| --- | --- | --- | --- |
| NFR-A01 | WCAG target | **2.2 AA** on extension + hosted account pages | Automated + manual a11y audit |
| NFR-A02 | Keyboard / screen reader / contrast / zoom / reduced-motion | Blocking findings = **0** | Release checklist |

## Security & privacy

| ID | Requirement | Gate | Evidence |
| --- | --- | --- | --- |
| NFR-P01 | Encrypted provider transport only | Launch-blocking | Deploy policy + ADR-0005B |
| NFR-P02 | Prompt 009 high threats mitigated | Launch-blocking | Security suite |
| NFR-P03 | Source deleted on terminal + ≤24h backstop | Launch-blocking | Deletion drill |
| NFR-P04 | No D-06/D-07/full D-09 in analytics/logs | Launch-blocking | Log schema tests |
| NFR-P05 | BYO userid numeric validation; no password collection | Launch-blocking | Settings/API tests |
| NFR-P06 | RPO / RTO (entitlement DB) | RPO ≤ 24h; RTO ≤ 8h provisional | Backup drill |

## Support expectations

| ID | Expectation | Value |
| --- | --- | --- |
| NFR-U01 | Support channel | Email within 2 business days provisional |
| NFR-U02 | Moss registration help | In-product ADR-0005B copy + official Moss link |
| NFR-U03 | Refund window | 14 days if no hosted check consumed |

## Launch-blocking checklist

All of NFR-L01–L03, NFR-L04–L10 provisional limits configured, NFR-A01/A02, NFR-P01–P05, and Prompt 009 launch-blocking threats must pass before paid launch.

## Verification Record

| Test | Coverage |
| --- | --- |
| P012-T01–T06 | Structure, allowance wiring, limits, a11y/security gates (`tests/prompt-012-nfr.test.js`) |
| Mapping | Each NFR lists evidence column above |
