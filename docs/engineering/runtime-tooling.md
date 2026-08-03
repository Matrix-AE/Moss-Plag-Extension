# Runtime and Package Tooling

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 014 — Reproducible Runtime and Package Tooling |
| Status | Accepted |
| Node line | **22+** (pin files target Node 22 Active LTS) |
| Package manager | **npm@10.9.2** via `packageManager` + Corepack |

## Pins

| File | Purpose |
| --- | --- |
| `.nvmrc` / `.node-version` | Local version managers select Node 22 |
| `package.json#engines` | `node >=22`, `npm >=10` with `.npmrc` `engine-strict=true` |
| `package.json#packageManager` | Corepack-managed npm only |
| `package-lock.json` | Root lockfile only (nested lockfiles ignored) |

## Rules

1. One package manager: **npm**. Yarn/pnpm/bun installs are rejected by `scripts/check-node-version.js`.
2. Unsupported Node majors `< 22` fail immediately before test/build/lint.
3. Do not silently regenerate lockfiles in CI without review; commit intentional lockfile updates.
4. No global CLIs required beyond Node + Corepack-enabled npm.

## Setup

```bash
corepack enable
corepack prepare npm@10.9.2 --activate
npm install
npm run check:runtime
npm test
```

## Verification

`tests/prompt-014-runtime.test.js` plus `npm run check:runtime`.
