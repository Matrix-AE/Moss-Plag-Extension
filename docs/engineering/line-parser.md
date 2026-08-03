# Implement Robust Protocol Line Parsing

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 056 — Implement Robust Protocol Line Parsing |
| Module | `@moss/provider-adapter/line-parser` |

Bounded newline parser preserves surplus bytes, caps length, and always uses deadline/abort. One TCP event is never equated with one response.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
