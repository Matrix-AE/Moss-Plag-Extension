# Security Threat Model and Control Backlog

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 009 — Security Threat Model and Control Backlog |
| Status | Accepted for launch-blocking control planning |
| Effective date | 2026-08-03 |
| Privacy inputs | [`../privacy/data-flow.md`](../privacy/data-flow.md), [`../privacy/consent-retention-deletion.md`](../privacy/consent-retention-deletion.md) |
| Commercial gates | ADR-0005A go; Prompt 006 economics |

## Trust Boundaries

| Boundary | Untrusted side | Trusted side |
| --- | --- | --- |
| B1 | Extension UI / user files / messages | Extension service worker with least privilege |
| B2 | Internet clients | HTTPS API |
| B3 | API | Object storage, queue, DB |
| B4 | Worker | Provider encrypted endpoint; KMS |
| B5 | Payment webhooks | Entitlement service |
| B6 | Support operators | Production data (need break-glass controls) |

All client input and provider responses are untrusted. Client-selected provider hosts/ports are forbidden. Control characters in protocol fields are rejected.

## Ranked Threats

Severity: **H** launch-blocking, **M** must schedule before GA, **L** backlog.

| ID | Threat | Sev | Prevention | Detection | Tests | Milestone | Residual-risk owner |
| --- | --- | --- | --- | --- | --- | --- | --- |
| T-01 | Protocol injection via userid/comment/filename | H | Reject control chars; immutable field encoders | WAF/log anomalies on reject counts | Unit protocol fuzz | Provider adapter | Engineering |
| T-02 | SSRF / client-selected provider host | H | Hardcoded allowlisted egress only | Egress deny alerts | Negative config tests | Worker hardening | Engineering |
| T-03 | Archive zip-slip / bombs | H | Path normalize, depth/ratio/count/byte caps | Quarantine metrics | Malicious archive fixtures | Upload validation | Engineering |
| T-04 | Malware execution in worker | H | Never execute uploads; non-root short-lived containers | Runtime alerts | Container policy tests | Worker runtime | Ops |
| T-05 | IDOR on jobs/report URLs | H | AuthZ on every route; encrypted URL storage | Auth failure dashboards | Integration IDOR suite | API authz | Engineering |
| T-06 | Webhook replay / entitlement fraud | H | Signed webhooks, replay nonce window, audit log | Replay rejects | Webhook fixture tests | Payments | Engineering |
| T-07 | XSS in extension/hosted pages | H | Strict CSP, escape, no remote code | CSP reports | UI security tests | Extension/UI | Engineering |
| T-08 | Secret leakage (D-07/D-09/source) in logs/telemetry | H | Redaction schema; secret scanning | Secret scan CI + log asserts | P007/P008 suites + CI scanners | Observability | Ops |
| T-09 | Supply-chain compromise | H | Lockfiles, SAST, signed artifacts | Dependency alerts | CI gate | Release | Engineering |
| T-10 | Insider misuse of support tools | M | Least privilege, redacted defaults, audit | Access reviews | Access-policy tests | Support | Compliance |
| T-11 | Licensing fraud / device cloning | M | Device limit 2, revoke-all, anomaly rates | Entitlement audit | Device/limit tests | Licensing | Product |
| T-12 | DoS / quota exhaustion | M | Rate limits, backpressure, reserved quota | Queue age / 429 metrics | Load tests | API/worker | Ops |
| T-13 | Ambiguous provider completion leading to double spend | H | Idempotency keys; no blind retry after send | Ambiguous-state alarms | Protocol timeout fixtures | Provider adapter | Engineering |
| T-14 | Bearer URL leakage via referrer/clipboard | M | noopener, copy warnings, forget-link | Support reports | Result UX tests | Extension | Product |

## Launch-Blocking Set

Must be mitigated before paid launch: **T-01, T-02, T-03, T-04, T-05, T-06, T-07, T-08, T-09, T-13**.

## Control Backlog Snapshot

1. Immutable provider request builder with charset allowlists.
2. Egress proxy/allowlist for approved encrypted provider endpoint only.
3. Archive safety pipeline before storage acceptance.
4. Ownership checks on all job/result endpoints.
5. Payment webhook verifier with replay cache.
6. CSP + dependency/secret scanning in CI.
7. Idempotent submission state machine matching charter recovery copy.

## Verification Record

| Test | Coverage |
| --- | --- |
| P009-T01–T06 | Boundaries, high threats, launch-blocking set, forbids (`tests/prompt-009-threat-model.test.js`) |
| P009-V01 | Review that each H threat has prevention, detection, tests, owner |
