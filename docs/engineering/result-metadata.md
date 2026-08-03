# Persist and Expose Result Metadata Safely

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 066 — Persist and Expose Result Metadata Safely |
| Module | `@moss/api` results/metadata |

Successful report metadata is stored with encrypted bearer URLs, scheme/host/path validation, and availability estimates. Owner-scoped result/history endpoints return minimal projections. URL-only forget retains minimal history; terminal history delete requires cleanup. Neither action claims provider, browser, or clipboard revocation. This phase does not crawl, mirror, parse, preview, index, log, or send the report to third parties.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
