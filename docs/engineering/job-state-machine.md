# Job Persistence and State Transitions

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 047 — Implement Job Persistence and State Transitions |
| Module | `@moss/api/jobs` |

Guarded transitions cover draft through canceled. Report availability is separate from job status. Manifests are immutable. Optimistic version checks prevent concurrent corruption. Terminal jobs never reprocess.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Transition table races and late cancellation covered by unit suite |
