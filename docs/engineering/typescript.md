# Shared TypeScript Configuration

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 016 — Shared TypeScript Configuration |
| Status | Accepted |
| Base | `tsconfig.base.json` (strict) |

## Presets

| Preset | Use |
| --- | --- |
| `tsconfig.base.json` | Shared strict flags, declarations, incremental |
| `tsconfig.browser.json` | Extension / `packages/ui` |
| `tsconfig.node.json` | API, workers, domain, contracts, provider-adapter |
| `tsconfig.test.json` | Test typechecking (no emit) |
| `tsconfig.json` | Solution-style project references |

## Rules

- No broad ambient `any` escapes without a documented reason.
- Packages must extend the environment-correct preset.
- Root `npm run typecheck` runs `tsc -b`.

## Verification

`tests/prompt-016-typescript.test.js` and `npm run typecheck`.
