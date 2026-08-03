# Formatting, Linting, and Commit Quality

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 017 — Formatting, Linting, and Commit Quality |
| Status | Accepted baseline (EditorConfig + existing boundary/runtime lint) |

## Baseline

| Tool | Command | Notes |
| --- | --- | --- |
| EditorConfig | `.editorconfig` + `npm run format:check` | UTF-8, LF, 2-space indent |
| Runtime/engines | `npm run check:runtime` | Node 22+, npm only |
| Workspace lint | `npm run lint` | workspace graph + boundary rules |
| Typecheck | `npm run typecheck` | `tsc -b` |

## Commit convention

Use concise imperative subjects scoped by area, for example:

- `docs: ...`
- `feat: ...`
- `chore: ...`
- `test: ...`

Every lint/type suppression must include a reason in a nearby comment when introduced later.

## Verification

`tests/prompt-017-quality-baseline.test.js`.
