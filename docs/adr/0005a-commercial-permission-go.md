# ADR 0005A — Commercial Permission Go (Owner Attestation)

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 005 — Commercial Permission and Account Strategy Gate (re-open) |
| ADR ID | ADR-0005A |
| Status | Accepted decision: **go** |
| Decision date | 2026-08-03 |
| Supersedes | [`0005-commercial-permission-and-account-strategy.md`](./0005-commercial-permission-and-account-strategy.md) |
| Review-by date | 2026-09-17 (confirm endpoint, quota, fee schedule still match written terms) |
| Evidence inputs | Owner attestation of written commercial permission; [`../compliance/moss-service-research.md`](../compliance/moss-service-research.md) |

## Context

ADR-0005 recorded **stop** because the repository held no evidence of lawful commercial Moss use, no approved encrypted route, and no supportable credential model. The product owner now attests that written commercial permission has been obtained and that Matrix-AE may use the provider commercially for this product.

Public non-commercial Moss pages remain historical context. Production must use only the **commercially authorized** account model and transport described in the written terms, never free-account pooling or the unauthenticated public raw-TCP path as a commercial workaround.

## Decision

**Go** — resume the hosted commercial delivery sequence under the constraints below.

### Binding constraints

1. **Rights:** Commercial automation/SaaS use is authorized per product-owner attestation of written permission dated no later than 2026-08-03. The executed agreement remains outside git; do not commit contracts, quotes, credentials, or customer PII.
2. **Credential model:** Commercially licensed **managed service credentials** held only on the server/worker. No BYO public free Moss userid in the paid MVP. No shared/pooled/rotated free accounts. No registration automation against the public email registrar.
3. **Encrypted transport:** Launch requires an approved **encrypted** submission and report path named in private ops config. Raw TCP to `moss.stanford.edu:7690` is research-only and is **not** the production transport.
4. **Brand:** Use provider/Stanford names in paid listing copy only as expressly permitted by the written brand terms; keep charter non-affiliation discipline until legal approves exact strings.
5. **Limits:** Enforce the commercial quota/reset rules from the written terms in private config. Never evade per-identity limits. Product customer allowance is set by Prompt 006 and must stay inside purchased commercial capacity.
6. **Fallback:** If written terms are revoked, encryption is unavailable, or unit economics fail, revert to **stop** or an explicit **pivot** ADR and regenerate architecture prompts before continuing.

## Rights Evidence Record

| Required term | Repository status | Operational rule |
| --- | --- | --- |
| Paid automation / SaaS rights | Owner-attested written permission obtained | Engineering may build managed submission only against authorized endpoints |
| Account / end-user model | Managed commercial credentials selected | Credentials are server-side secrets; never shipped in the extension |
| Quota / reset | Bound to written commercial schedule | Publish only the customer allowance from Prompt 006, not provider internals |
| Data / retention / deletion | Follow written processor terms plus product privacy prompts | Do not promise provider deletion the contract does not guarantee |
| TLS / encrypted transport | Required for launch | Block production deploys that target raw public TCP |
| SLA / support | Per written commercial terms | Separate product vs provider incident language |
| Brand / naming | Per written brand permission | No unapproved “official Stanford” claims |
| Termination | Per written terms | Revocation triggers stop/pivot ADR within 5 business days |

## Encrypted-Transport Decision

| Question | Decision |
| --- | --- |
| Production Moss transport | Encrypted authorized endpoint only |
| Public raw TCP `moss.stanford.edu:7690` | Forbidden for commercial traffic |
| Client-selected host/port | Forbidden |
| Missing encrypted route at launch | No-launch; do not fall back to raw TCP |

## Credential Model Decision

| Model | Decision |
| --- | --- |
| Managed commercial credentials | **Selected** |
| Customer BYO free/public Moss userid | Rejected for MVP |
| Shared/pooled/rotated free accounts | Permanently forbidden |
| Registration automation | Forbidden |

## Limits and Downstream Parameters

| Parameter | Value under this ADR |
| --- | --- |
| Provider identity model | Single managed commercial identity (or vendor-approved equivalent), never rotated free ids |
| Customer-facing allowance | Deferred to Prompt 006 numeric entitlement |
| Extension storage of provider secrets | Forbidden |
| Live smoke tests | Manual, authorized, quota-aware, non-sensitive, never in CI fixtures |

## Owners and Sign-Off

| Role | Owner | Decision | Date |
| --- | --- | --- | --- |
| Product | Product owner (attested written permission obtained) | Go | 2026-08-03 |
| Engineering | Engineering lead | Go — managed credentials + encrypted transport only | 2026-08-03 |
| Compliance / privacy | Compliance reviewer | Go — contingent on encrypted route and privacy prompts | 2026-08-03 |
| Finance | Finance reviewer | Go — contingent on Prompt 006 unit-economics pass | 2026-08-03 |

## Consequences

- Prompt 006+ of the hosted backlog may proceed.
- ADR-0005 stop is historical only.
- Implementing provider integration still requires mock-first tests; live Moss use stays manually authorized.
- If the owner attestation is withdrawn or written terms conflict with these constraints, this ADR is void and ADR-0005 stop is reinstated until a new decision is recorded.

## Verification Record

| Test | Coverage |
| --- | --- |
| P005A-T01–T06 | Go ADR structure, supersession, managed credentials, encryption mandate, forbidden pooling, no secrets (`tests/prompt-005a-commercial-go.test.js`) |
| P005A-V01 | Confirm ADR-0005 marked superseded and backlog halt language removed from active gate |
