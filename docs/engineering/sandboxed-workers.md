# Implement Sandboxed Intake and Submission Workers

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 061 — Implement Sandboxed Intake and Submission Workers |
| Module | `@moss/api` workers/sandboxed |

Isolated non-root workers with restricted files, network, and resources. Intake has no provider credential or egress. Submission accepts immutable manifests only and never executes source. Stages are redacted; artifacts always clean on success, failure, cancel, or crash. Anything beyond the documented backstop is treated as a retention defect.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
