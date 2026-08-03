# Verify the Submission Pipeline with Test Entitlements

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 070 — Verify the Submission Pipeline with Test Entitlements |
| Module | `@moss/api` pipeline/submission-gate |

Pre-commerce E2E gate covering upload, intake, provider processing (mock), results, history, recovery, abuse, and cleanup. Uses the production auth boundary with synthetic non-production entitlements. CI uses synthetic fixtures and the mock server only — never live accounts or real student/customer code. Evidence is published under `docs/engineering/evidence/`.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
