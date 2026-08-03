# Submission Grouping and Preview

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 041 — Build Submission Grouping and Preview |
| Module | `@moss/ui/grouping` |

Logical submission groups are suggested from top-level folders. Flat files stay separate by default. Archives use their grouping hint. Users can rename, merge, split, move, and reorder groups before continue.

Preview shows exactly what will be compared. Pair mode requires exactly two groups; batch mode requires at least two. Base files never become comparison groups. Group identity uses **stable internal IDs** only — never temporary server paths.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Specimen preview lists suggested groups with stable IDs; pair/batch validation enforced |
