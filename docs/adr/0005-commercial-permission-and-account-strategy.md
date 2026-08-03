# ADR 0005 — Commercial Permission and Account Strategy Gate

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 005 — Commercial Permission and Account Strategy Gate |
| ADR ID | ADR-0005 |
| Status | Accepted decision: **stop** |
| Decision date | 2026-08-03 |
| Review-by date | 2026-09-03 or upon receipt of written commercial terms, whichever is earlier |
| Evidence inputs | [`../compliance/moss-service-research.md`](../compliance/moss-service-research.md), [`../product/mvp-prd.md`](../product/mvp-prd.md), [`../product/product-charter.md`](../product/product-charter.md), [`../product/research/prompt-003-market-scan.md`](../product/research/prompt-003-market-scan.md) |
| Supersedes | None |
| Soft-gate note | Prompt 006+ hosted-MOSS backlog execution is halted by this decision |

## Context

The product hypothesis is a USD $15 one-time Chrome extension that submits authorized code to an external similarity provider and returns a provider-hosted report link. Prompt 004 confirmed from primary sources that:

- public Moss is explicitly **non-commercial**;
- commercial use is directed to Similix Corporation;
- the public service enforces **100 submissions/day/user**;
- the published submission client uses **raw TCP** to `moss.stanford.edu:7690` with no TLS;
- result URLs are bearer secrets typically retained about 14 days and may disappear earlier;
- no public SLA, reseller terms, brand license, or encrypted commercial endpoint was found.

Prompt 003 market research also showed strong free alternatives and did not validate willingness to pay. No written commercial authorization package is present in this repository.

## Decision Drivers

1. Lawful commercial rights must exist before any paid automation, managed account, or store sale.
2. Account pooling or rotation would evade the enforced per-user limit and is permanently rejected.
3. Free or BYO Moss accounts cannot be used for a paid wrapper without express written approval.
4. Self-serve handling of confidential source without an approved encrypted provider route is a no-launch condition.
5. Absence of rights is not cured by technical cleverness, hidden throttling, or “fair use” wording.

## Options Considered

| Option | Summary | Result |
| --- | --- | --- |
| A. Go — commercially licensed managed Moss credentials | Purchase grants seamless submission through an approved managed identity | Rejected: no written license, fees, quotas, TLS, brand, or DPA evidence |
| B. Go — customer BYO numeric Moss userid inside a paid wrapper | Customer supplies their own public Moss id | Rejected: public Moss is non-commercial; no written wrapper authorization |
| C. Go — shared/rotated developer Moss accounts | Hide quota behind multiple free accounts | Permanently rejected: limit evasion and identity risk |
| D. Pivot — licensed/self-hosted alternative provider behind the same adapter | For example local JPlag or another authorized engine; regenerate architecture prompts | Deferred candidate only: requires a new architecture ADR and regenerated backlog before continuing |
| E. Pivot — native companion with direct licensed submission | Reduce hosted retention; still needs lawful provider path | Deferred candidate only: same rights/transport prerequisites |
| F. Stop — do not sell a Moss-backed commercial product on current evidence | Halt provider-dependent commercial implementation | **Selected** |

## Decision

**Stop.**

Matrix-AE will not implement, market, or sell a Moss-backed commercial product on the evidence available on 2026-08-03.

This stop applies to:

- checkout, paid beta, presale, and “buy now” store copy;
- live commercial Moss traffic;
- managed or BYO Moss credential collection in product flows;
- provider-branded paid listing claims;
- Prompts 006–100 work that assumes a hosted Moss entitlement, managed Moss quota, or Moss result-host product promise.

Work that remains allowed after this ADR is documentation, compliance research, non-provider scaffolding that does not claim Moss commercial readiness, and an explicit future ADR that changes this decision after written rights arrive or a pivot architecture is approved.

## Rights Evidence

| Required term | Evidence status on 2026-08-03 | Notes |
| --- | --- | --- |
| Paid automation / SaaS / reseller rights | **Missing** | Official Moss page allows non-commercial use only; Similix public site published no usable terms |
| Account / end-user model | **Missing** | No written managed or BYO-wrapper approval |
| Quota definition and reset window | **Partial public only** | Public enforcement is 100 submissions/day/user; commercial quota unknown |
| Data processing / retention / deletion | **Missing commercially** | Public page states bearer URLs and ~14-day typical deletion only |
| TLS / encrypted submission and report transport | **Missing / not approved** | Public client is raw TCP; commercial encrypted route unknown |
| SLA and support | **Missing** | Public page warns of overload and asks users to retry later |
| Brand / naming permission | **Missing** | No public license to use Moss/Stanford marks in a paid listing |
| Termination and audit rights | **Missing** | Not published |

### Outreach package required before any future “go”

Any future attempt to reverse this stop for Moss must obtain **written** answers to Prompt 004 questions Q-01–Q-12 and archive the executed terms outside ordinary git history if they contain confidential commercial content. Public homepage text alone is insufficient.

No authorization email reply, contract, quote, or brand permission is stored in this repository.

## Encrypted-Transport Decision

| Question | Decision |
| --- | --- |
| Is an approved encrypted Moss submission/report route available today? | **No** |
| May the product accept sensitive source for Moss transfer on raw TCP? | **No** |
| Launch condition if rights appear but TLS still missing? | Remain **no-launch** for self-serve confidential code until an approved encrypted route is documented |

## Credential Model Decision

| Model | Decision |
| --- | --- |
| Managed commercial Moss credentials | Not authorized |
| Customer BYO public Moss userid in a paid wrapper | Not authorized |
| Shared, pooled, or rotated free accounts | Permanently forbidden |
| Automating Moss registration email | Forbidden |
| No Moss credentials in product until a later ADR | **Required** |

## Limits Decision

| Limit topic | Decision under this ADR |
| --- | --- |
| Public 100/day/user | Not a sellable product allowance |
| Product numeric hosted allowance | Unset; Prompt 006 must not invent Moss-backed allowances while this stop stands |
| Concurrency / file / byte commercial caps | Unknown; do not publish |

## Fallback and Pivot Path

If product work resumes, choose one explicitly recorded path:

1. **Written Moss commercial agreement** that satisfies rights, account model, quotas, encrypted transport, data/SLA/support/brand terms → new ADR superseding ADR-0005 with decision **go**.
2. **Architecture pivot** to a properly licensed or local alternative provider → regenerate `100-prompts.md` architecture-specific prompts and write a new architecture ADR before Prompt 010-equivalent work.
3. **Native companion pivot** under lawful provider terms → same regeneration requirement.
4. **Remain stopped** and do not sell the Moss-backed offer.

Market-scan fallback candidates (not authorized by this ADR): local JPlag, self-hosted/local Dolos-style workflows. Adopting either is a pivot, not a silent implementation under the current hosted-Moss backlog.

## Owners and Sign-Off

| Role | Owner | Decision | Date |
| --- | --- | --- | --- |
| Product | Matrix-AE product owner | Stop | 2026-08-03 |
| Engineering | Matrix-AE engineering lead | Stop — no Moss credential/transport implementation | 2026-08-03 |
| Compliance / privacy | Matrix-AE compliance reviewer | Stop — no sensitive Moss transfer without rights and encryption | 2026-08-03 |
| Finance | Matrix-AE finance reviewer | Stop — no $15 Moss-hosted sale under unknown provider liability | 2026-08-03 |

Human reconfirmation is required if written Similix/Stanford commercial terms arrive or if a pivot ADR is proposed. Fabricated signatures are not permitted; this table records the repository decision state for Prompt 005 acceptance.

## Consequences

### Allowed now

- Keep Prompt 001–004 research artifacts and tests.
- Continue pure documentation or non-Moss scaffolding only when it does not imply commercial Moss readiness.
- Draft pivot research as a separate ADR when product chooses that path.

### Forbidden now

- Implementing Moss submission workers, managed IDs, BYO ID onboarding, or result-host allowlists as a shippable commercial feature.
- Publishing checkout copy, entitlement allowances, or store claims for a Moss-backed $15 offer.
- Executing Prompt 006 as if a Moss-hosted unit-economics model were approved.
- Regenerating nothing and continuing the hosted-Moss backlog after a silent pivot.

### Hard-branch effect

Per `100-prompts.md` global execution contract: **`stop` ends execution** of the current Moss-hosted commercial delivery sequence. A later **pivot** or **native companion** decision requires regenerating architecture-specific prompts before continuing.

## Verification Record

| Test | Coverage |
| --- | --- |
| P005-T01–T08 | ADR structure, stop decision, rejected models, missing rights matrix, transport/credential forbids, owners, halt wiring (`tests/prompt-005-commercial-gate.test.js`) |
| P005-V01 | Cross-check against Prompt 004 verified non-commercial, quota, raw-TCP, and bearer-URL facts |
| P005-V02 | Confirm no provider secrets, contracts, or live Moss traffic were introduced by this change |
