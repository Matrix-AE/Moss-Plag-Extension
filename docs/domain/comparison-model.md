# Comparison Domain Model

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 036 — Implement the Comparison Domain Model |
| Package | `@moss/domain` |
| Schema version | 1 |

One compatible schema across extension, API, and worker. Persisted file metadata may include stable ids, display/safe names, sizes, optional sha256 hashes, upload states, ownership, and timestamps. **Forbidden:** source bytes, absolute/full local paths, `webkitRelativePath`.

Pair mode requires exactly two groups. Batch requires ≥2. Base files must set `countsAsSubmission: false`. Succeeded results store opaque `reportUrlRef`, never plaintext provider URLs.

### Live verification

| Date | 2026-08-03 |
| Result | Fixtures serialize/validate; absolute-path leak fixture fails validation |
