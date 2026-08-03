# Implement Durable Job Status and Polling

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 065 — Implement Durable Job Status and Polling |
| Module | `@moss/api` jobs/durable-status |

Backend job state is authoritative because MV3 service-worker and popup lifetimes are short. Clients poll with bounded backoff, restore job IDs after restart, show upload/validation/provider stages, rotate auth, and request cancel. Notifications never include URLs or names. Polling stops for terminal, forgotten, and unauthorized jobs. Late cancellation never claims to have stopped an already-accepted provider query.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
