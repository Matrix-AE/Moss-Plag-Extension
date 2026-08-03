# Create Actionable Error and Recovery UX

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 069 — Create Actionable Error and Recovery UX |
| Module | `@moss/ui/error-recovery` |

Typed validation, upload, auth, license, quota, worker, provider, result, offline, and unknown failures map to concise copy, retry eligibility, correlation ID, and reconnect/settings/support actions. Uncertain submissions require deliberate resubmit. Never expose stack traces, credentials, object keys, raw responses, or URLs. Every typed error has accessible UI copy and either one safe action or an honest terminal explanation.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
