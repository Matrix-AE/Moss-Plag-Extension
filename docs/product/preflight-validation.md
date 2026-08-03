# Client-Side Preflight Validation

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 043 — Implement Client-Side Preflight Validation |
| Module | `@moss/ui/preflight` |

Client preflight catches invalid drafts early. The backend remains authoritative. Warnings require acknowledgement and reset after material changes. Limits come from the server capability document.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Blocking vs warning findings render in grouped lists; invalid drafts cannot proceed |
