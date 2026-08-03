# ADR 0010 — Product Architecture Decision

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 010 — Product Architecture Decision |
| ADR ID | ADR-0010 |
| Status | Accepted: **hosted encrypted relay** |
| Decision date | 2026-08-03 |
| Depends on | ADR-0005A go; Prompt 006 economics; Prompt 007–009 docs |
| Review-by | 2026-09-17 |

## Context

Manifest V3 extensions cannot use Node `net`, `fs`, or `glob`, so direct raw-TCP Moss submission from extension code is not viable. ADR-0005A authorizes managed commercial credentials with encrypted transport. Prompt 006 locks a bounded hosted allowance (40 checks / 2 devices / 36 months).

## Decision

**Hosted architecture** — Chrome MV3 extension + HTTPS API + durable queue + locked-down workers that submit via the **approved encrypted commercial provider route**. Secrets remain server-side. Source storage is ephemeral.

### Topology

```text
[Extension MV3] --TLS--> [API] --signed upload--> [Encrypted object storage]
                              |                         ^
                              +--> [DB entitlements]    |
                              +--> [Queue] --> [Submission worker] --encrypted--> [Provider]
                                           --> [Cleanup worker] --> delete source
[Payment page/webhooks] --TLS--> [Entitlement service]
```

### Rejected alternatives

| Alternative | Why rejected now |
| --- | --- |
| Direct extension TCP to public Moss | MV3 cannot; raw TCP forbidden commercially |
| Native companion first | Higher install friction; deferred unless hosted economics fail |
| Pure local engine (JPlag) only | Would be a pivot requiring regenerated backlog; not selected while commercial hosted path is authorized |

## Component Responsibilities

| Component | Responsibility |
| --- | --- |
| Extension | Grouping UX, consent, draft shell, upload orchestration, progress, result card |
| API | Auth, jobs, entitlement, signed uploads, history metadata |
| Storage | Encrypted ephemeral source objects |
| Queue/workers | Provider submit + guaranteed cleanup |
| Provider adapter | Immutable request, allowlisted egress, result URL validation |
| Payment | Hosted checkout; webhooks drive entitlement |

## Trust, Scaling, Failure

- Trust boundaries follow Prompt 009 B1–B6.
- Scale by queue depth and worker concurrency within purchased commercial capacity; never rotate free accounts.
- Failures distinguish offline-before-send, sent-without-result, and unknown-transfer; no blind retry after send.
- Estimated operating cost bounded by Prompt 006 conservative margin (+$1.10/sale at full allowance under labeled assumptions).

## Consequences

- Continue monorepo scaffold (Prompt 013+) for `apps/extension`, `apps/api`, workers, shared packages.
- Production deploys that target raw public TCP must fail closed.
- If commercial encryption or rights fail, stop/pivot ADR required before continuing.

## Verification Record

| Test | Coverage |
| --- | --- |
| P010-T01–T05 | Hosted choice, topology, rejects, economics/privacy wiring (`tests/prompt-010-architecture.test.js`) |
