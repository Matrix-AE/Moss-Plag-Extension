# Consent, Retention, and Deletion Requirements

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 008 — Consent, Retention, and Deletion Requirements |
| Status | Accepted requirements for implementation |
| Effective date | 2026-08-03 |
| Data map | [`data-flow.md`](./data-flow.md) |
| Charter copy | [`../product/product-charter.md`](../product/product-charter.md) |
| Offer | [`../product/offer-and-unit-economics.md`](../product/offer-and-unit-economics.md) |
| Policy version field | `consentPolicyVersion` (semver string on each job) |

## Consent Requirements

| ID | Requirement | UI / API location | Owner |
| --- | --- | --- | --- |
| C-01 | Show processing disclosure before the first external transfer and after material policy changes. | Extension review step; hosted legal pages | Product |
| C-02 | Require corpus-specific affirmative authority confirmation before every submission. | Review checkbox bound to charter `authorityNotice` meaning | Product |
| C-03 | Require corpus-specific affirmative external-processing confirmation before every submission. | Review checkbox bound to `processingNotice` | Product |
| C-04 | Reset C-02/C-03 whenever files, groups, language, provider, or processing details change. | Extension draft controller | Engineering |
| C-05 | Do not infer consent from install, purchase, file pick, or a prior job’s checkbox. | Extension + API validation | Engineering |
| C-06 | Persist `consentPolicyVersion` and timestamps on the job record. | `POST /v1/jobs` | API |
| C-07 | Block submit when offline-before-send or when either consent flag is false. | Review actions + API | Engineering |
| C-08 | State that provider-side report deletion/revocation is outside direct product control. | Result + privacy pages | Product |

Approved baseline strings remain those in the charter JSON inventory; provider-specific brand lines still require legal approval.

## Retention Schedule

Default rule: shortest viable window. Hours-scale backstops beat day-scale where operationally possible.

| Data | Retain | Backstop / legal exception | Owner |
| --- | --- | --- | --- |
| Source objects (D-06) | Delete immediately on success/failure/cancel after cleanup worker runs | Lifecycle ≤ **24 hours** if cleanup fails; alert on breach | Worker/ops |
| Draft shell (D-04) | ≤ **24 hours** in `chrome.storage.local` | Purge on upload start, logout, discard | Extension |
| Active job id local cache | Until terminal, then ≤ **24 hours** | Purge | Extension |
| Job metadata (D-08) | Default **90 days** after terminal | Longer only for disputes/fraud/legal hold | API |
| Encrypted result URL (D-09) | Until user forgets/deletes or job metadata purge | Cannot erase provider copy | API |
| Account/entitlement (D-01/D-02) | Account life + tax/commercial retention | Payment processor independent retention | Product/finance |
| Support tickets (D-10) | **24 months** unless shorter by policy | Legal hold exception | Support |
| Observability (D-11) | **30 days** detailed; longer aggregates without forbidden fields | Security investigation hold | Ops |
| Optional telemetry (D-12) | ≤ **30 days** identifiable; aggregates thereafter | User opt-out | Product |

## Deletion and User Controls

| ID | Control | Behavior | Audit evidence |
| --- | --- | --- | --- |
| DEL-01 | Cancel eligible job | Allowed only before provider acceptance; after acceptance show “too late to cancel,” allowance consumed | Job event log |
| DEL-02 | Terminal source delete | Cleanup worker deletes P-STORE objects on all terminal paths | Deletion receipt / empty listing check |
| DEL-03 | Forget saved link | Removes product-stored D-09 only; copy warns it does not revoke provider report or external copies | Job/history mutation |
| DEL-04 | Delete terminal job history | Removes D-08/D-09 from product history views | DB delete + audit |
| DEL-05 | Account export | JSON/CSV of account, entitlement, job metadata — **no source bytes** | Export artifact id |
| DEL-06 | Account deletion | Deletes/anonymizes product personal data subject to payment/tax exceptions; revokes sessions/devices | Deletion ticket |
| DEL-07 | Log redaction | Strip D-06/D-07/full D-09/filenames/paths from ordinary logs and support tools | Log schema tests |
| DEL-08 | Incident response | Suspected leak of D-06/D-07/D-09 triggers revoke sessions, rotate secrets, user notice per policy | Incident record |

### Processor caveats (must appear in privacy UI)

1. Provider may retain report copies on its schedule; product deletion does not guarantee provider deletion.
2. Opening/copying a bearer link may leave it in browser history/sync or clipboard outside product control.
3. Payment processor retains records under its own legal duties.
4. Availability estimates are not guarantees.

## Incident Response Skeleton

1. Detect → classify severity (source/credential/URL exposure = high).
2. Contain → revoke sessions, rotate D-07, disable affected upload paths if needed.
3. Erase product copies where possible; document provider limitations.
4. Notify affected users and required authorities per applicable law.
5. Postmortem with ADR/policy version updates if processing changes.

## Traceability to UI Copy

| Requirement | Charter / product copy key |
| --- | --- |
| C-02 | `authorityNotice` |
| C-03 | `processingNotice` |
| C-08 / DEL-03 | `linkWarning`, `forgetLinkNotice`, `availabilityNotice` |
| Result interpretation | `resultGuidance` |

## Verification Record

| Test | Coverage |
| --- | --- |
| P008-T01–T08 | Consent, retention table, deletion controls, caveats (`tests/prompt-008-consent-retention.test.js`) |
| P008-V01 | Conceptual consent gating against research prototype consent scenario |
| P008-V02 | Trace success/failure deletion requirements against data-flow P-STORE/P-WORKER |

P008-V01/V02 completed 2026-08-03 using the Prompt 003 consent scenario model and the Prompt 007 path map.
