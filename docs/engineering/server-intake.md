# Harden Server-Side File and Archive Ingestion

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 051 — Harden Server-Side File and Archive Ingestion |
| Module | `@moss/api` intake/ingest |

Authoritative isolated intake produces immutable sanitized manifests. Traversal, absolute paths, bombs, symlinks, binaries, nested archives, and MIME mismatches fail closed and delete sandbox artifacts.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
