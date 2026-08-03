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
- Actions pinned to `actions/checkout@v5` and `actions/setup-node@v5`; the `@v4` majors run on the
  deprecated Node 20 action runtime and are rejected by `tests/prompt-021-ci.test.js`
- No production secrets in ordinary CI
- Live Moss submission forbidden

## Reproducing a red pipeline locally

The workspace working tree can pass while a clean checkout fails, because gates such as the canary
scan walk `git ls-files`. Clone `HEAD` into a scratch directory and run the gate chain there before
pushing a CI fix.

## Branch protection (manual)

Require the `Quality gates` job on `main` before merge.

## Verification

`tests/prompt-021-ci.test.js`
