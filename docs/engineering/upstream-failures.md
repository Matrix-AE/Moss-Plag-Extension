# Add Typed Upstream Failures and Safe Retry Rules

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 060 — Add Typed Upstream Failures and Safe Retry Rules |
| Module | `@moss/provider-adapter/failures` |

Phase-aware product errors with retry only before upstream side effects. Uncertain outcomes require deliberate resubmit; quota actions are release/consume/hold.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
