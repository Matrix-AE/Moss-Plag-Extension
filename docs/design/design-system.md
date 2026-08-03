# Extension Design System Catalog

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 035 — Design-System Documentation and Audit |
| Status | Accepted contract for feature implementation |
| Token version | 1 |
| Effective date | 2026-08-03 |

## Catalog (implemented only)

| Area | Module | Specimens |
| --- | --- | --- |
| Color / space / radius tokens | `@moss/ui/tokens` | `specimens/index.html` |
| Typography + icons | `@moss/ui/typography`, `@moss/ui/icons` | `specimens/typography.html` |
| Theme / motion / interaction | `@moss/ui/interaction` | `specimens/interaction.html` |
| Primitives | `@moss/ui/primitives` | `specimens/primitives.html` |
| Shell | `@moss/ui/shell` | `specimens/shell-progress.html` |
| File selection | `@moss/ui/file-selection` | shell-progress (file row) |
| Group builder | `@moss/ui/group-builder` | (model tests) |
| Progress / results | `@moss/ui/progress` | shell-progress |

Experiments are marked in code with comments; no one-off hex is allowed in extension `base.css`.

## Recipes

1. **Popup summary** — shell(popup) + badge + one primary button.
2. **Workspace draft** — shell(workspace) + rail + file rows + sticky Continue.
3. **Waiting for report** — progress.viewModel("wait") + polite live region; never show a percent.
4. **Paywall** — only after Review consents (IA Prompt 025).

## Do / Don’t

| Do | Don’t |
| --- | --- |
| Consume semantic CSS variables | Hardcode hex in components |
| Label critical actions | Icon-only delete/pay/upload |
| Announce status with text | Color or animation alone |
| Keep motion ≤ 240ms | Ornamental delay / confetti |
| Speak of similarity reports | Call results plagiarism verdicts |

## Accessibility notes

- Landmarks: banner, navigation, main, contentinfo.
- Focus rings use `--focus` with visible offset.
- Reduced motion zeroes duration tokens.
- Contrast targets from Prompt 026 remain gating.

## Versioning

Breaking semantic token renames bump `TOKEN_VERSION`. Component builder API bumps their `*_VERSION` constants. Changesets under `.changes/` track package train bumps.

## Visual-regression matrix

| Surface | Light | Dark | 100% | 125% | 150% |
| --- | --- | --- | --- | --- | --- |
| Popup 320×520 | ✓ | ✓ | ✓ | ✓ | ✓ |
| Workspace 880×720 | ✓ | ✓ | ✓ | ✓ | ✓ |

Covered by token specimens + typography stress strings.

## Audit checklist

| ID | Item | Status |
| --- | --- | --- |
| A01 | No hex in extension base.css | Pass |
| A02 | All wireframe steps map to tokens/components | Pass |
| A03 | Critical a11y/contrast defects resolved | Pass |
| A04 | Bundle imports tokens/typography/interaction CSS | Pass |

### Human review record

| Date | 2026-08-03 |
| Result | Catalog lists only implemented modules; recipes assemble IA wireframes without new primitives |
