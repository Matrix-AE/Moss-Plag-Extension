# Temporary Upload Sessions

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 049 — Create Temporary Upload Sessions |
| Module | `@moss/api/uploads/sessions` |

Short-lived tenant/job-bound upload sessions with opaque keys, exact count/size/type/checksum constraints, expiry, optional multipart cleanup, and lifecycle backstop. No public access or client keys.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Origin/ownership/replay/expiry/hash checks pass in offline suite |
