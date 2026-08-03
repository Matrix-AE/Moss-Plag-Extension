# Secure Provider Credential Management

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 063 — Secure Provider Credential Management |
| Module | `@moss/api` credentials/vault |

Isolated credential vault with envelope encryption, tenant binding, masked display, replace/delete, access audits, versioned keys, and per-job references. Only an authorized submission worker can decrypt the owning tenant’s credential for a valid leased job. Never embed IDs in extension builds, expose plaintext via APIs, log them, or sync them through browser storage.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
