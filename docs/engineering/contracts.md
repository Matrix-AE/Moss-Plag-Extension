# Runtime-Validated Contracts

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 018 — Runtime-Validated Contracts Foundation |
| Module | `packages/contracts/validate.js` |
| Status | Accepted v1 validators |

## Covered payloads

| Validator | Purpose |
| --- | --- |
| `validateCreateJobRequest` | Extension→API job create metadata (no inline source/secrets) |
| `validateJobStatusResponse` | API→extension status with opaque `reportUrlRef` |
| `validateConnectMossUserIdRequest` | BYO Moss userid connect (numeric only, no passwords) |

## Rules

- Breaking schema changes bump `schemaVersion`.
- Errors use stable `code` strings and never echo source, Moss userids, or report URLs.
- Source bytes travel via signed upload, not JSON create-job bodies.

## Verification

`tests/prompt-018-contracts.test.js`
