# Continuous Integration Quality Gates

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 021 |
| Workflow | `.github/workflows/ci.yml` |
| Status | Accepted |

## Pipeline

1. `npm ci`
2. runtime / format / lint / typecheck
3. `npm test` with `CI=true` (no live Moss)
4. `npm run build`
5. canary secret scan

## Constraints

- `permissions.contents: read` only
- Node version from `.nvmrc`
- No production secrets in ordinary CI
- Live Moss submission forbidden

## Branch protection (manual)

Require the `Quality gates` job on `main` before merge.

## Verification

`tests/prompt-021-ci.test.js`
