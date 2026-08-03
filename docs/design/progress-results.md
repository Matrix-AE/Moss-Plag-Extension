# Progress and Result Components

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 034 — Progress and Result Components |
| Module | `packages/ui/progress` |

Deterministic phase machine: validate → upload → queue → submit → wait → success|failure|cancelled|timeout. Never fabricates percentages, never auto-opens report links, never calls results a plagiarism verdict.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Happy-path transitions reach success with copy-link action only |
