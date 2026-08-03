# Privacy Data Inventory and Flow Map

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 007 — Privacy Data Inventory and Flow Map |
| Status | Accepted inventory for engineering; retention numbers refined by Prompt 008 |
| Effective date | 2026-08-03 |
| Commercial gate | [`../adr/0005a-commercial-permission-go.md`](../adr/0005a-commercial-permission-go.md) |
| Offer terms | [`../product/offer-and-unit-economics.md`](../product/offer-and-unit-economics.md) |
| Next | Prompt 008 consent, retention, and deletion requirements |

Roles: **Controller** = Matrix-AE for product account/entitlement data. **Processor** = infrastructure vendors acting on Matrix-AE instructions. **Independent provider** = commercial similarity provider processing source under its written terms. **Payment processor** = PCI merchant-of-record / payment stack (selected later by ADR).

## Data Categories

| ID | Category | Classification | Examples |
| --- | --- | --- | --- |
| D-01 | Account identity | Personal data | Email, account id, device ids, session tokens |
| D-02 | Entitlement / purchase | Commercial personal data | License id, device activations (≤2), allowance remaining, refund state |
| D-03 | Payment artifacts | Highly restricted | Processor customer/payment intent ids only — **never** card PAN/CVV in product systems |
| D-04 | Draft shell metadata | Low/moderate | Mode, language, settings flags, group count, random draft id |
| D-05 | Group/file metadata | Sensitive | Display labels, filenames, safe virtual paths, byte counts |
| D-06 | Source code | Highly sensitive | File bytes, archive members |
| D-07 | Provider credentials | Secret | Managed commercial provider credentials |
| D-08 | Job metadata | Sensitive usage | Job id, status, language, counts, coarse errors, timestamps, consent version |
| D-09 | Result link | Bearer secret | Provider-hosted report URL |
| D-10 | Support records | Personal / sensitive | Ticket text, redacted diagnostics |
| D-11 | Observability | Low-sensitivity only | Aggregated latency, error codes, capacity metrics |
| D-12 | Telemetry (optional) | Low-sensitivity only | Opt-in product analytics events without source/filenames/URLs/credentials |

## Path Coverage Map

Every path below must remain data-minimized. Source (D-06), credentials (D-07), and complete result URLs (D-09) are forbidden in analytics, ordinary logs, screenshots, marketing demos, and support forms.

### P-LOCAL — User device before upload

| Field | Owner | Purpose | Storage | Encryption | Retention | Deletion / user control |
| --- | --- | --- | --- | --- | --- | --- |
| Selected `File` objects | User / browser | Local draft only | Memory only | N/A | Session | Discard on navigate/close; never written by MVP draft recovery |
| D-04 draft shell | Product | Resume empty structure | `chrome.storage.local` ≤ 24h | OS/profile protected | ≤ 24h | Purge on upload start, logout, discard, TTL |
| Session/refresh tokens | Product | Auth | `chrome.storage.local` (never sync) | OS/profile protected | Access 15m; refresh ≤ 30d rotating | Logout / logout-all / revoke |
| Cached D-09 URL | Product | Re-open report | Encrypted-at-rest preference via server; local reveal only | Transport TLS | Until forget/delete/policy | Forget-link removes product copy only |

### P-EXT — Extension UI / messaging

| Field | Owner | Purpose | Storage | Encryption | Retention | Deletion / user control |
| --- | --- | --- | --- | --- | --- | --- |
| On-screen D-05/D-06 previews | Product | Review & consent | Ephemeral DOM/memory | TLS for any remote call | In-memory | Cleared on navigation |
| Extension messages | Product | Orchestration | Transient | Same-origin extension channels | Transient | No durable log of source |

### P-API — HTTPS API

| Field | Owner | Purpose | Storage | Encryption | Retention | Deletion / user control |
| --- | --- | --- | --- | --- | --- | --- |
| Auth headers / cookies | Product | Session | Server session store | TLS 1.2+ in transit | Per session policy | Logout-all |
| Job create payload (D-04/D-05/D-08, consent version) | Product | Create draft/job | DB | TLS + at-rest DB encryption | See Prompt 008 | Account/job delete |
| Signed upload instructions | Product | Direct-to-storage put | Ephemeral | TLS | Minutes | Expire signed URL |
| Entitlement checks | Product | Authorize hosted check | DB | TLS + at-rest | Account life + legal | Account deletion |

### P-STORE — Object storage (temporary source)

| Field | Owner | Purpose | Storage | Encryption | Retention | Deletion / user control |
| --- | --- | --- | --- | --- | --- | --- |
| D-06 source objects | Product (processor: cloud storage) | Hold bytes until worker finishes | Encrypted temporary objects | SSE + TLS | Immediate delete on terminal state; hours-scale lifecycle backstop | Guaranteed delete job; user cancel before provider send where eligible |

### P-QUEUE — Job queue

| Field | Owner | Purpose | Storage | Encryption | Retention | Deletion / user control |
| --- | --- | --- | --- | --- | --- | --- |
| Job id, stage, attempt counters | Product | Orchestration | Queue + DB pointers | TLS + provider encryption | Until terminal + short retry window | Drop after terminal; no source payloads in queue body |

### P-WORKER — Submission / cleanup workers

| Field | Owner | Purpose | Storage | Encryption | Retention | Deletion / user control |
| --- | --- | --- | --- | --- | --- | --- |
| D-06 read from storage | Product | Validate & submit | Worker memory / ephemeral disk | Encrypted volume where used | Seconds–minutes | Wipe after attempt |
| D-07 provider credentials | Product | Authenticate to provider | KMS-backed secret store | Envelope encryption; decrypt only in worker | Rotation per ops policy | Rotate/revoke; never in extension |
| Normalized protocol fields | Product | Provider request | Memory | Encrypted egress only | Transient | No durable source retention |

### P-PROVIDER — Commercial similarity provider

| Field | Owner | Purpose | Storage | Encryption | Retention | Deletion / user control |
| --- | --- | --- | --- | --- | --- | --- |
| D-06 source + safe names | Provider under written terms | Similarity analysis | Provider systems | Approved encrypted commercial route only | Per provider terms (public Moss historically ~14 days typical; commercial schedule may differ) | Product cannot directly delete provider copies; disclose this |
| D-09 report URL | Provider issues; product stores encrypted for owner | Human review | Provider + product | Encrypted route + product at-rest encryption | Provider schedule; product until forget/delete | Forget-link / history delete ≠ provider revocation |

### P-PAY — Payment / entitlement

| Field | Owner | Purpose | Storage | Encryption | Retention | Deletion / user control |
| --- | --- | --- | --- | --- | --- | --- |
| Checkout on hosted payment page | Payment processor | Collect funds | Processor vault | PCI / TLS | Processor legal | Processor tools |
| D-03 processor ids + D-02 entitlement | Product | License & allowance (40 checks / 2 devices / 36 months hosted window) | DB | TLS + at-rest | Account + legal/tax | Export/delete with commercial exceptions |

### P-SUPPORT — Support tooling

| Field | Owner | Purpose | Storage | Encryption | Retention | Deletion / user control |
| --- | --- | --- | --- | --- | --- | --- |
| D-10 tickets | Product | Help users | Support system | TLS + access control | Support policy | User request / retention schedule |
| Diagnostics | Product | Debug | Redacted only | TLS | Short | No D-06/D-07/full D-09 |

### P-OBS — Observability

| Field | Owner | Purpose | Storage | Encryption | Retention | Deletion / user control |
| --- | --- | --- | --- | --- | --- | --- |
| D-11 metrics/logs | Product | Reliability | Metrics/log backend | TLS + access control | Ops retention | N/A aggregate |
| Forbidden fields | — | — | — | — | — | D-06, D-07, full D-09, raw filenames/paths, comments with source |

## Representative Job Traces

### Trace T-PAIR — Pair Check (two files)

1. Extension loads D-04 shell locally; user selects two files (D-06 in memory only).
2. User reviews D-05 counts/paths, confirms authority + processing (consent version recorded on job).
3. API creates D-08 job; entitlement reserves one of 40 hosted checks.
4. Source uploaded via signed TLS path to P-STORE (encrypted object).
5. Queue message carries job id only → worker reads source → submits over approved encrypted provider route using D-07.
6. Provider returns D-09; product stores encrypted for owner; source objects deleted.
7. User opens/copies link deliberately; forget-link removes product URL only.

Fields transmitted externally: D-06/D-05 to provider; D-03 only to payment processor during purchase (not per job). No analytics event may include D-06/D-07/D-09.

### Trace T-BATCH — Batch Check (multi-file projects)

Same as T-PAIR with multiple logical groups. Group membership is explicit product structure (not inferred solely from user paths). Byte/file counts become D-08 metadata; source still ephemeral in P-STORE/P-WORKER; still one entitlement consumption per successful provider submission per product accounting rules.

## Minimization and Prohibitions

1. No source, credentials, or complete report URLs in analytics, ordinary logs, crash dumps, or marketing.
2. No card data in extension or API databases.
3. No provider secrets in the extension bundle or repository.
4. No raw public TCP commercial submissions.
5. Draft recovery never stores filenames, labels, paths, hashes, or source.
6. Support sees redacted metadata only by default.

## Owner Index

| Category | Primary owner | Downstream prompts |
| --- | --- | --- |
| D-01–D-03 | Product + payment ADR | 008, payment prompts |
| D-04–D-06 | Product engineering | 008, 009, 011, extension/API |
| D-07–D-09 | Product + provider adapter | 008, 009, 010 |
| D-10–D-12 | Product ops | 008, observability prompts |

## Verification Record

| Test | Coverage |
| --- | --- |
| P007-T01–T08 | Paths, categories, traces, prohibitions, links (`tests/prompt-007-data-flow.test.js`) |
| P007-V01 | Manual trace of T-PAIR and T-BATCH against this inventory |

P007-V01 completed 2026-08-03: every field in T-PAIR/T-BATCH maps to a category with owner, purpose, and retention rule above.
