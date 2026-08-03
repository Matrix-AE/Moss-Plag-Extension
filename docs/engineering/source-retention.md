# Implement Source Retention and Deletion Controls

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 062 — Implement Source Retention and Deletion Controls |
| Module | `@moss/api` retention/source |

Source is deleted after terminal processing (success, failure, cancel, crash). Only approved metadata is retained. Lifecycle, orphan, retry, and reconciliation jobs remove anything beyond the configured backstop and raise alerts. Source must stay out of backups, analytics, traces, queues, dead-letter payloads, and support tooling. Provider retention is documented separately and is not claimed to be revoked by product deletion.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
