# Upload Transfer Manager

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 050 — Implement the Upload Transfer Manager |
| Module | `@moss/api/uploads/transfer` |

After review and entitlement, create a titled job, upload opaque objects with bounded concurrency, track honest progress, verify hashes, and support reselection resume. Cancel cleans active objects and is not forget. File handles do not survive browser restart.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Drop/resume/cancel/idempotent job creation covered by offline transfer suite |
