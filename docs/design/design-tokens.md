# Semantic Design Tokens

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 027 — Semantic Design Tokens |
| Status | Accepted token foundation for MVP surfaces |
| Effective date | 2026-08-03 |
| Package | `@moss/ui` (`packages/ui/tokens`) |
| Token version | `1` (`TOKEN_VERSION`) |
| CSS artifact | `packages/ui/tokens/tokens.css` |
| Specimens | `packages/ui/specimens/index.html` |
| Brand source | `docs/design/art-direction.md` / `docs/design/brand/brand-model.js` |

## Layers

| Layer | Location | Rule |
| --- | --- | --- |
| Primitive | `tokens/primitives.js` | Raw hex, px, shadows. Never imported by components. |
| Semantic | `tokens/semantic.js` | Intent roles (`color.text`, `space.md`). Theme swaps primitives under stable names. |
| Component | `tokens/components.js` | Maps UI parts to semantic paths only. No literals. |
| CSS variables | `tokens/css.js` → `tokens.css` | Emitted custom properties for browser surfaces. |

Components and extension stylesheets may reference **semantic CSS variables** (`var(--text)`, `var(--space-md)`). They must not contain hex colors or ad-hoc spacing literals.

## Naming

| Context | Pattern | Example |
| --- | --- | --- |
| JS primitive | `{category}.{name}` | `color.light.blue600`, `space.2` |
| JS semantic | `{category}.{role}` | `color.accent`, `space.md` |
| JS component | `{component}.{part}` → semantic path | `button.primary.background` → `color.accent` |
| CSS variable | `--{category}-{kebab-role}` plus short color aliases | `--color-accent-text`, `--accent-text` |

Short color aliases (`--surface`, `--text`, `--accent`, …) exist so extension CSS stays readable; they always resolve to the same value as the `--color-*` long form.

## 8-pixel spacing system

Major rhythm steps are multiples of **8px** (`space.1` = 8, `space.2` = 16, …). Half-steps of **4px** are allowed for compact popup density and hairline padding only. Validation rejects any spacing primitive not on the 4px grid.

| Semantic | px |
| --- | --- |
| none | 0 |
| hair | 4 |
| xs | 8 |
| sm | 12 |
| md | 16 |
| lg | 20 |
| xl | 24 |
| 2xl | 32 |
| 3xl | 40 |
| 4xl | 48 |

## Density

| Density | Use | pad / gap |
| --- | --- | --- |
| compact | Popup (320px) | 16px pad, 12px gap |
| comfortable | Workspace / settings | 24–32px pad, 20px gap |

Density objects are JS composition helpers. CSS binds the resolved semantic space tokens instead of a `--density-*` namespace.

## Accent rule

Exactly one component mapping may use `color.accent` as a **background fill**: `button.primary.background`. Secondary controls, badges, and rails must not fill with the accent. Schema validation fails if a second accent fill appears.

## Contrast

Semantic text and status pairs are checked with the same WCAG math as Prompt 026. Targets:

- Body / muted / status / button label ≥ 4.5:1
- Focus ring ≥ 3:1
- Border ≥ 1.4:1

`validateTokens()` fails the suite when any pair regresses.

## Unused-token reporting

`reportUnusedTokens()` lists:

- Semantic roles not referenced by any component mapping (reserved for later surfaces is fine)
- Primitive values not referenced by any semantic role (**brand color primitives must be zero unused**)

CI fails on unused brand color primitives; unused semantic roles are reported for review.

## Exports

```js
const { TOKEN_VERSION, SEMANTIC, COMPONENTS, toCss, validateTokens } = require("@moss/ui/tokens");
```

| Export | Purpose |
| --- | --- |
| `TOKEN_VERSION` | Integer bump when breaking semantic names |
| `SEMANTIC` | Typed theme maps |
| `COMPONENTS` | Component → semantic paths |
| `toCss()` | Full custom-property stylesheet |
| `validateTokens()` | Schema + contrast + unused brand check |
| `@moss/ui/tokens.css` | Committed CSS artifact for Vite/WXT imports |

Regenerate CSS after token edits:

```bash
npm run emit:tokens --workspace=@moss/ui
# or: node scripts/emit-ui-tokens.js
```

## Extension wiring

Popup, workspace, and settings entrypoints import `@moss/ui/tokens.css` before `styles/base.css`. `base.css` contains layout and component rules only — zero hex literals.

## Specimens and snapshot matrix

`packages/ui/specimens/index.html` renders popup (320×520) and workspace (880×720) frames in light and dark themes at 100%, 125%, and 150% zoom. The facilitator chrome may use page-local colors; the framed product UI uses token variables exclusively.

## Verification

| ID | Check |
| --- | --- |
| P027-V01 | Schema validation passes |
| P027-V02 | Contrast targets pass in both themes |
| P027-V03 | No unused brand color primitives |
| P027-V04 | Component mappings resolve; accent fill is unique |
| P027-V05 | Emitted CSS matches `toCss()` and brand palette |
| P027-V06 | Extension base.css has no hex; entrypoints import tokens.css |
| P027-V07 | Specimens cover popup/workspace × zoom matrix |
| P027-V08 | Live specimen walkthrough in both themes |

### Live Walkthrough Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Method | Served `packages/ui/specimens/` and stepped theme / viewport / zoom controls; rebuilt extension and confirmed packaged CSS contains token variables |
| Result | Dark popup resolved `--surface #15171c` / `--accent #9db6ff`; light workspace at 125% resolved `--surface #ffffff` / `--accent #2f4fd8` with `scale(1.25)`; packaged extension CSS includes token variables and brand hexes |
| Follow-up | Prompt 028 consumes size/icon tokens for typography and iconography |
