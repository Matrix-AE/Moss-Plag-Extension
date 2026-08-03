# Authentication, Sessions, and Authorization

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 048 — Implement Authentication, Sessions, and Authorization Boundary |
| Module | `@moss/api/auth` |

Email magic-link with 10-minute device-bound nonce, 15-minute access tokens, rotating 30-day refresh with reuse detection, logout-all, and pluggable entitlements. Purchase IDs are never authentication. Production refuses fake entitlements. Refresh material stays local.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Nonce replay/expiry/device binding and refresh reuse verified offline |
