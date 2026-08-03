# Art Direction and Brand Visual Language

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 026 — Original Brand and Visual Direction |
| Status | Accepted visual direction for MVP surfaces |
| Effective date | 2026-08-03 |
| Executable source | `docs/design/brand/brand-model.js` |
| Mood board | `docs/design/brand/index.html` |
| Governing charter | `docs/product/product-charter.md` (Responsible Terminology Standard) |

The palette, naming rules, and copy rules in this document are executable. `brand-model.js` computes
WCAG contrast from the hex values and screens names and strings against the charter vocabulary, so a
change to the palette that breaks contrast fails `tests/prompt-026-brand.test.js` rather than
surviving in prose.

## Naming Placeholders

The product name is not chosen yet. These placeholders carry the direction until naming is settled.

| Placeholder | Rationale |
| --- | --- |
| Codeprint | Suggests a code fingerprint without implying judgement. |
| Sidebyside | Describes comparison plainly; reads friendly and neutral. |
| Overlap | Names the observable phenomenon, not a verdict. |

A candidate name is rejected if it matches any of: `moss`, `stanford`, `official`, `certified`,
`plagiar`, `cheat`, `caught`, `busted`, `detector`, `police`, `judge`, `verdict`. The first three
would imply institutional affiliation or endorsement the product does not have; the rest promise a
judgement the product explicitly refuses to make.

## Mood

> Feels like a sharp developer tool a friend recommended: quick, plainspoken, and calm about a
> decision only a human can make.

**Is:** fast, candid, modern, workshop-like, unfussy.

**Is not:** institutional crest, courtroom, surveillance, alarm siren, casino neon.

Gen-Z currency comes from pace and plain speech — tight copy, immediate feedback, no ceremony — not
from gradient meshes, sticker chaos, or slang. Academic credibility comes from restraint and
accurate limits, not from wood-panel seals or Latin mottos. Both are satisfied by the same choices.

## Color

Two themes, both first-class. Dark is the default because the popup opens over developer tooling;
light is not a degraded afterthought and carries identical semantics.

### Light

| Role | Hex | Use |
| --- | --- | --- |
| surface | `#ffffff` | Page and card background |
| surfaceMuted | `#f2f4f8` | Recessed rows, code rails |
| border | `#d3d8e0` | Hairline separation |
| text | `#14161a` | Body copy |
| textMuted | `#525a66` | Helper text, timestamps |
| accent | `#2f4fd8` | One primary action per view |
| accentText | `#ffffff` | Label on accent fill |
| focus | `#0b47c7` | Focus ring |
| info | `#1f5a8f` | Progress and neutral state |
| caution | `#7a4a05` | Needs a decision before continuing |
| danger | `#96231f` | Blocked or failed |
| success | `#1c5f3a` | Workflow finished |

### Dark

| Role | Hex | Use |
| --- | --- | --- |
| surface | `#15171c` | Page and card background |
| surfaceMuted | `#1e2128` | Recessed rows, code rails |
| border | `#333945` | Hairline separation |
| text | `#f1f3f6` | Body copy |
| textMuted | `#aab2be` | Helper text, timestamps |
| accent | `#9db6ff` | One primary action per view |
| accentText | `#10131c` | Label on accent fill |
| focus | `#b9ccff` | Focus ring |
| info | `#96c4ee` | Progress and neutral state |
| caution | `#e7b169` | Needs a decision before continuing |
| danger | `#f2a09a` | Blocked or failed |
| success | `#89d6a8` | Workflow finished |

### Contrast Targets

Body, muted, status, and button-label text meet 4.5:1 against their own surface. The focus ring
meets 3:1. Borders are decorative and only need to be visible (1.4:1). Measured ratios in both
themes are shown live on the mood board; the lowest text ratio in the set is 6.33:1, which leaves
headroom for the token work in Prompt 027.

### Neon Exclusion

A color is rejected as neon when its HSL saturation is at least 0.85 while one channel is pinned at
250 or above and another sits at 60 or below — the `#39ff14` / `#ff00ff` / `#00ffff` family. Those
values vibrate against dark surfaces and strand small text. Pale tints such as the dark-theme accent
`#9db6ff` share a high HSL saturation but are not channel-blown, which is why saturation alone
cannot be the test.

### Status Colors Are Never the Only Signal

`danger` marks a blocked or failed job. It never marks a person, a similarity level, or a match.
Every status color is paired with text and an icon so color-blind users and grayscale screenshots
lose nothing.

| Status | Meaning |
| --- | --- |
| info | Progress and neutral state |
| caution | Needs a decision before continuing |
| danger | Blocked or failed; never an accusation about a person |
| success | The workflow finished; not a similarity judgement |

## Shape, Illustration, Motion

| Aspect | Rule |
| --- | --- |
| Radius | 10–14px on cards and controls; 999px only for status pills |
| Stroke | 1px hairline borders; no heavy outlines or drop-shadow stacks |
| Illustration | Abstract offset bars and aligned code rails |
| Motion | ≤ 180ms transitions on state changes only |
| Texture | Flat surfaces with one soft elevation shadow maximum |

Banned imagery: magnifying glasses over people, red stamps, handcuffs, gavels, scales of justice,
crests, shields, fingerprints on faces, and progress states that celebrate a match. A found overlap
is a neutral fact, so nothing in the interface may cheer or scold when one appears.

Banned effects: parallax, animated gradient meshes, glassmorphism over text, marquee scrolling,
confetti, and any motion that runs while a person is reading a limitation. Trend effects lose to
comprehension every time.

## Voice and Microcopy

Three principles:

1. Say what happened, then what the person can do.
2. Name limits in the same breath as capabilities.
3. Never imply a person did something wrong.

| Surface | Approved string |
| --- | --- |
| popup | No active check. Open the workspace to start. |
| workspace | Review these groups before anything leaves this device. |
| workspace | Similarity highlights code for human review. |
| settings | Connect your own provider account after purchase. |
| checkout | One-time purchase. Files have not been uploaded yet. |
| results | Treat this report link like a password. |
| support | Tell us what you expected and what you saw. |
| store | Group code submissions and get a similarity report link. |

Every shipped string is screened against accusation patterns (`guilty`, `caught`, `stolen`,
`verdict`), detection claims (`plagiarism detect`, `cheating detect`), endorsement claims
(`official stanford`, `endorsed by`), and absolute-safety claims (`100% secure`, `secure link`,
`private link`). The screen runs in `brand-model.js` so a new string cannot ship without passing it.

## Theme Behavior

- Both themes follow the OS preference by default, with a manual override in settings.
- Theme changes swap semantic roles only. No surface hardcodes a hex; Prompt 027 turns these roles
  into tokens.
- Store assets and marketing screenshots use the light theme so they read on any store background;
  every in-extension surface is theme-aware.

## Surface Application

| Surface | Density | Accent use | Theme-aware |
| --- | --- | --- | --- |
| popup | compact | One primary button | Yes |
| workspace | comfortable | Primary CTA plus active step | Yes |
| settings | comfortable | One primary button | Yes |
| checkout | comfortable | Price emphasis plus primary button | Yes |
| store | marketing | Hero mark plus one CTA | No (light only) |
| support | comfortable | Submit button only | Yes |

One accent per view is the load-bearing rule. When everything is emphasized, the consent moment
before upload stops standing out, and that moment is the one the charter cares most about.

## Non-Affiliation

Nothing in the visual system may imply Stanford ownership, MOSS endorsement, or academic
accreditation. Concretely: no crests, seals, laurels, university colors as a primary palette, `.edu`
styling, or diploma/transcript motifs. The provider is named only where Prompt 005 authorizes it,
with the approved surrounding disclaimer, and never rendered as a logo lockup that suggests a
partnership.

## Verification

| ID | Check | Method |
| --- | --- | --- |
| P026-V01 | Contrast targets met in both themes | Computed in `brand-model.js`, asserted in tests |
| P026-V02 | No neon values in the palette | `checkNeon()` |
| P026-V03 | Naming placeholders avoid affiliation and accusation | `checkNaming()` |
| P026-V04 | Microcopy passes charter terminology | `checkCopy()` |
| P026-V05 | Both themes cover every semantic role | Palette key parity assertion |
| P026-V06 | Mood board renders every surface and both themes | Live walkthrough |
| P026-V07 | No banned imagery, effects, or affiliation cues | Human review against this document |

### Live Walkthrough Record

| Field | Value |
| --- | --- |
| Date | 2026-08-03 |
| Method | Served `docs/design/brand/` locally and stepped through both themes; separately loaded the packaged extension stylesheet from `.output/chrome-mv3` with `prefers-color-scheme` forced to light and dark |
| Mood board result | Contrast table reported pass on all 10 pairs per theme (lowest 1.43 border in light, lowest text 6.33); neon status clean; popup, workspace, and checkout specimens rendered with palette roles in both themes |
| Packaged result | Built bundle resolved `#2f4fd8` / `#9db6ff` accents, `#14161a` / `#f1f3f6` body text, and all four status badges to the approved hexes in the matching theme |
| Follow-up | Semantic tokens in Prompt 027 will consume these roles; no hex may reach a component |
