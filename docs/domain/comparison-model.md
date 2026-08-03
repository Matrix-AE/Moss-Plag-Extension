# Submission and Comparison Domain Model

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 011 — Submission and Comparison Domain Model |
| Status | Accepted schema v1 |
| Executable module | [`../../packages/domain/comparison-model.js`](../../packages/domain/comparison-model.js) |
| Architecture | [`../adr/0010-product-architecture.md`](../adr/0010-product-architecture.md) |

## Core Types

- **Draft / Job:** `schemaVersion`, `idempotencyKey`, `status`, `mode`, `language`, `groups`, `baseFiles`, `settings`, `result`
- **Group:** stable `id`, display `label`, `files[]` — trusted membership is the group id
- **File:** `displayName` (UI) separate from `safeProtocolName` (protocol); `virtualPath`; `language`; `bytes`
- **Base file:** same shape with `countsAsSubmission: false`
- **Result:** opaque `reportUrlRef` only in the domain model (never plaintext provider URL in schemas/logs)

## Invariants

1. ≥ 2 non-empty groups.
2. One language per job; mixed languages invalid.
3. Never trust grouping solely from user paths (`inferredFromPathOnly` rejected).
4. Reject `..` in virtual paths and duplicate `safeProtocolName` within a group.
5. Succeeded jobs reference opaque result refs, not raw URLs.

## Example Coverage

| Example | Factory |
| --- | --- |
| Two files | `exampleTwoFiles` |
| Many flat files | `exampleManyFlatFiles` |
| Two multi-file projects | `exampleTwoProjects` |
| Many projects | `exampleManyProjects` |
| Mixed-language rejection | `exampleMixedLanguage` |
| Base code | `exampleWithBaseCode` |

## Verification Record

Unit tests in `tests/prompt-011-domain-model.test.js` cover serialization, invariants, stable ids, grouping, duplicates, nested traversal, empty groups, and schema version.
