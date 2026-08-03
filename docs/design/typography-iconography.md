# Typography and Iconography System

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 028 — Typography and Iconography System |
| Status | Accepted |
| Effective date | 2026-08-03 |
| Modules | `packages/ui/typography`, `packages/ui/icons` |
| Specimens | `packages/ui/specimens/typography.html` |

## Fonts

Local system stacks only. Remote fonts, Google Fonts, Adobe Fonts, and `@import url(...)` are forbidden in extension bundles.

| Stack | CSS variable | Value |
| --- | --- | --- |
| UI | `--font-ui` | system-ui, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif |
| Mono | `--font-mono` | ui-monospace, Cascadia Code, Consolas, Liberation Mono, Menlo |

## Type scale and roles

Maximum display size on extension surfaces is **18px**. Every planned content role has a specimen.

| Role | Size | Weight | Notes |
| --- | --- | --- | --- |
| title | 16 | 600 | Max 2 lines, end truncate |
| subtitle | 14 | 600 | Section heads |
| body | 14 | 400 | Default copy |
| helper | 12 | 400 | Limits and guidance |
| label | 12 | 600 | Form labels, single line |
| caption | 11 | 400 | Meta, timestamps |
| code | 12 / mono | 400 | Filenames; middle-friendly ellipsis |
| numeric | 13 | 500 | `tabular-nums` for counts |
| warning | 13 | 500 | Caution copy (color from tokens) |
| action | 14 | 600 | Button labels |

## Icons

Twelve stroke icons at 16 / 20 / 24px. Each icon has a default accessible name. **Critical actions** (`submit`, `pay`, `delete`, `discard`, `cancel`, `retry`, `connect`, `upload`) must include a visible text label — `assertLabeledAction` rejects icon-only usage.

Banned: emoji-as-icons, arbitrary glyph mixing, remote icon fonts, icon-only destructive controls.

## Verification

| ID | Check |
| --- | --- |
| P028-V01 | Typography validation passes; no role exceeds 18px |
| P028-V02 | No remote font patterns in emitted CSS |
| P028-V03 | Every icon has an accessible label |
| P028-V04 | Critical icon-only actions rejected |
| P028-V05 | Specimens show all roles + localization stress strings |
| P028-V06 | Extension imports typography CSS |

### Live Walkthrough Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Method | Served `packages/ui/specimens/typography.html`; confirmed all 10 roles, DE/ES stress strings, and labeled payment action |
| Result | All content roles rendered; action button exposed accessible name “Continuar al pago” with icon+text |
| Follow-up | Prompt 029 adds motion/interaction on top of these type roles |
