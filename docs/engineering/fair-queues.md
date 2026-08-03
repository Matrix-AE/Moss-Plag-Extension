# Build Intake and Fair Provider Queues

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 053 — Build Intake and Fair Provider Queues |
| Module | `@moss/api` queues/fair |

Separate intake and provider queues with tenant fairness, per-credential caps, leases/heartbeats, dead letters, circuit breaker, and honest estimates. Never assume quota reset timezone.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
