# Finalize Uploads and Enqueue Validation Idempotently

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 052 — Finalize Uploads and Enqueue Validation Idempotently |
| Module | `@moss/api` intake/finalize |

Completed uploads become exactly one validation outbox task and later one provider event. Quota reserves after intake success, consumes on provider query, and releases on earlier terminal paths.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
