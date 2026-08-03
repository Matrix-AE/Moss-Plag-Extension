# Accessible Component Primitives

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 030 — Accessible Component Primitives |
| Module | `packages/ui/primitives` |
| Version | `PRIMITIVES_VERSION = 1` |

## Catalog

| Primitive | Semantic HTML / ARIA | Keyboard |
| --- | --- | --- |
| button | `<button>` + visible label | Enter, Space |
| link | `<a>` | Enter |
| input | `<label>` + `<input>` + error `role=alert` | native |
| select | combobox/listbox | Enter, Space, ArrowDown |
| switch | `role=switch` + label | Enter, Space |
| tabs | tablist / tab / tabpanel | Arrows, Home, End |
| dialog | `role=dialog` aria-modal + title | Escape, focus trap |
| tooltip | `role=tooltip` | Escape |
| badge | `role=status` + text (color never alone) | — |
| progress | `progressbar` + text label; indeterminate for provider waits | — |
| toast | `status` or `alert` | Escape |
| disclosure | `<details>`/`<summary>` | Enter, Space |

## Constraints

- Prefer native elements; ARIA is minimal and only when needed.
- Loading buttons keep a text label and set `aria-busy`.
- Progress never fabricates percentages for provider waits.
- Bundle stays headless builders in `@moss/ui` (no React dependency in the package).

## Verification

| ID | Check |
| --- | --- |
| P030-V01 | All 12 primitives listed with keyboard contracts |
| P030-V02 | Builders reject missing labels |
| P030-V03 | Specimen renders button, switch, dialog, tabs, badge, progress, toast, disclosure |

### Live Walkthrough Record

| Date | 2026-08-03 |
| Result | Specimens show labeled controls and busy/disabled states |
