# Monorepo Scaffold

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 013 — Monorepo Scaffold |
| Status | Accepted initial workspace graph |
| Root orchestration | `package.json` workspaces + `npm test` / `npm run build` |

## Workspaces

| Path | Package | Role |
| --- | --- | --- |
| `apps/extension` | `@moss/extension` | MV3 extension (browser-safe deps only) |
| `apps/api` | `@moss/api` | HTTPS API |
| `apps/worker-submit` | `@moss/worker-submit` | Provider submission worker |
| `apps/worker-cleanup` | `@moss/worker-cleanup` | Source deletion worker |
| `packages/domain` | `@moss/domain` | Comparison domain model |
| `packages/contracts` | `@moss/contracts` | Shared constants/contracts |
| `packages/ui` | `@moss/ui` | Browser-safe UI helpers |
| `packages/provider-adapter` | `@moss/provider-adapter` | Provider boundary (server/worker only) |
| `infra/` | — | Future deploy templates |

## Dependency rules

- `apps/extension` and `packages/ui` must **not** depend on `@moss/provider-adapter`.
- Upstream MIT `node-moss` import (later) lands only under `packages/provider-adapter/vendor/` with attribution.
- Provider secrets never enter the extension bundle.
- Customer BYO Moss userids are handled by API/workers only (ADR-0005B).

## Verification

`node scripts/check-workspaces.js` and `tests/prompt-013-monorepo.test.js`.
