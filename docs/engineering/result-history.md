# Add Owner-Scoped Result History

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 068 — Add Owner-Scoped Result History |
| Module | `@moss/api` results/history |

Searchable recent-job history with title, mode, language, date, state, and availability estimate. Distinct forget link versus terminal delete history actions. Excludes original paths, sensitive filenames, source previews, and plaintext URLs in lists. No browser-sync persistence. Forgotten-link entries retain minimal history; deleted history disappears; active deletion blocks; rerun restores empty structure/settings only with mandatory reselection. Tenant isolation is enforced.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
