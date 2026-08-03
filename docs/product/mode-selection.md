# Pair and Batch Mode Selection

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 038 — Implement Pair and Batch Mode Selection |
| Module | `@moss/ui/mode-selector` |
| Version | `MODE_SELECTOR_VERSION = 1` |

## Modes

| Mode | Groups | Notes |
| --- | --- | --- |
| Pair Check | Exactly 2 | Two logical submissions; multi-file projects stay together |
| Batch Check | ≥ 2 | Folders/archives may each become a group |

Selecting a mode initializes the correct draft. Continuation is blocked until group-count rules and non-empty groups are satisfied. Populated drafts require an explicit confirmation before a destructive switch; cancel keeps the current draft.

Copy stays responsible: no accusation language and no provider protocol jargon in user-facing mode cards.

## Accessibility

Radiogroup with labeled radio cards. Keyboard: arrows, Space, Enter. Screen readers hear title + summary on each option.

### Live Walkthrough Record

| Date | 2026-08-03 |
| Method | Specimen radiogroup + workspace mode section |
| Result | Pair/Batch cards render; destructive switch prompts confirmation |
