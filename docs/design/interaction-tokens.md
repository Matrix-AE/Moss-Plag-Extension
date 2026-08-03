# Theme, Motion, and Interaction Tokens

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 029 — Theme, Motion, and Interaction Tokens |
| Module | `packages/ui/interaction` |
| Version | `INTERACTION_VERSION = 1` |
| CSS | `packages/ui/interaction/interaction.css` |

## Theme selection

Preferences: `system` | `light` | `dark`. `resolveTheme(preference, systemPrefersDark)` maps to a concrete theme. OS preference is respected when mode is `system`.

## Motion

| Token | ms |
| --- | --- |
| fast | 120 |
| base | 180 |
| deliberate | 240 |
| maxAllowed | 240 |

Easing: standard / enter / exit cubic-beziers. `prefers-reduced-motion: reduce` zeroes durations and disables skeleton shimmer and transforms (`motionFor(true)`).

## Interaction states

rest, hover, pressed, focus (ring via `--focus`), disabled (opacity 0.45), loading (`aria-busy`, requires visible text — never color/animation alone).

## Progress & skeletons

Indeterminate progress only for provider waits — no fabricated percentages. Skeletons become static blocks under reduced motion.

## Verification

| ID | Check |
| --- | --- |
| P029-V01 | Durations ≤ 240ms |
| P029-V02 | Reduced-motion substitutions |
| P029-V03 | Theme resolution for system/light/dark |
| P029-V04 | Loading requires text signal |
| P029-V05 | Extension imports interaction.css |

### Live Walkthrough Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Result | Specimens exercise theme toggle and reduced-motion CSS media query |
