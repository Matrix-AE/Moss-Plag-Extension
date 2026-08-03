# Secure File, Folder, and Archive Intake

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 039 — Integrate Secure File, Folder, and Archive Intake |
| Module | `@moss/ui/intake` |

Supports picker, multi-file, folder (`webkitdirectory`), and approved archives (`.zip`, `.tar`, `.tgz`, `.tar.gz`). Selections stay `localOnly` with source type, counts, sizes, and grouping hints. No broad filesystem permission, no execution, no upload before review consent.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Dropzone specimen shows local-only copy; intake validates folder/archive/duplicate paths |
