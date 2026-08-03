# Harden Extension and API Security Boundaries

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 064 — Harden Extension and API Security Boundaries |
| Module | `@moss/api` security/boundaries |

Defense in depth across extension, API, storage, queue, database, worker, and provider integration. Enforce CSP, exact API/dedicated-upload permissions, authenticated CORS, request caps, rate limits, stage-scoped egress, supply-chain gates, and redacted telemetry. Request no history/all-sites/page-content permissions. Send no filenames, code, credentials, or report URLs to analytics. Every approved threat mitigation is implemented or has documented non-launch risk acceptance; no unnecessary permission remains.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
