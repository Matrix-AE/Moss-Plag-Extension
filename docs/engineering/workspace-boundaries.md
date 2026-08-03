# Workspace Boundaries and Dependency Rules

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 015 — Workspace Boundaries and Dependency Rules |
| Status | Accepted |
| Enforcer | `scripts/check-boundaries.js` (also via `npm run lint`) |

## Ownership

| Workspace | Owner layer | May depend on | Must not depend on |
| --- | --- | --- | --- |
| `apps/extension` | Browser | `@moss/domain`, `@moss/ui`, `@moss/contracts` | `@moss/provider-adapter`, `node:net`/`fs`/`tls`, secrets |
| `packages/ui` | Browser presentation | none / tiny pure helpers | provider-adapter, Node sockets/fs, API secrets |
| `packages/domain` | Shared pure model | none | provider transport |
| `packages/contracts` | Shared constants/schemas | none (later runtime validators) | provider transport |
| `packages/provider-adapter` | Server/worker protocol | domain, contracts | imported by extension/ui |
| `apps/api` | Server | domain, contracts, (later adapter types) | browser-only packages as runtime req |
| `apps/worker-submit` | Worker | domain, contracts, provider-adapter | extension/ui |
| `apps/worker-cleanup` | Worker | contracts | provider secrets in logs |

## Public exports

Each package exposes only `package.json#exports` entry points. Deep imports outside exports are disallowed by policy.

## Verification

- Positive: `node scripts/check-boundaries.js`
- Negative fixture: `tests/fixtures/forbidden-imports/extension-imports-provider.js`
- Tests: `tests/prompt-015-boundaries.test.js`
