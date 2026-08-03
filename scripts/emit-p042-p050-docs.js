"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function w(rel, content) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content, "utf8");
  console.log("wrote", rel);
}

const openapi = require(path.join(root, "packages/contracts/openapi"));
console.log(openapi.writeArtifacts(path.join(root, "packages/contracts")));

w(
  "docs/product/base-code.md",
  `# Optional Base-Code Handling

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 042 — Add Optional Base-Code Handling |
| Module | \`@moss/ui/base-code\` |

Base / starter / shared library files suppress expected overlap and never count as comparison groups. Users add, inspect, replace, and remove base files without changing submission-group identities. Language compatibility is checked against server capabilities.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Base panel specimen marks files distinctly; group IDs unchanged on add/remove |
`,
);

w(
  "docs/product/preflight-validation.md",
  `# Client-Side Preflight Validation

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 043 — Implement Client-Side Preflight Validation |
| Module | \`@moss/ui/preflight\` |

Client preflight catches invalid drafts early. The backend remains authoritative. Warnings require acknowledgement and reset after material changes. Limits come from the server capability document.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Blocking vs warning findings render in grouped lists; invalid drafts cannot proceed |
`,
);

w(
  "docs/product/comparison-settings.md",
  `# Safe Comparison Settings

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 044 — Add Safe Comparison Settings |
| Module | \`@moss/ui/settings\` |

Safe defaults work untouched. Advanced controls are bounded and capability-gated. Directory mode is derived from grouping. Experimental mode is disabled. Labels are sanitized; no free-form protocol commands.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Settings panel resets to defaults; serialization snapshot is deterministic |
`,
);

w(
  "docs/product/review-consent.md",
  `# Review, Consent, and Confirmation

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 045 — Create Review, Consent, and Confirmation |
| Module | \`@moss/ui/review\` |

Final review summarizes exactly what leaves the device using similarity terminology with no provider affiliation claim. Consent checkboxes are never pre-checked. Submission stays disabled until blockers clear and versioned consent is recorded. Material draft changes reset consent.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Confirm button disabled until both consents; quota copy visible when allowance is zero |
`,
);

w(
  "docs/engineering/job-account-api.md",
  `# Versioned Job and Account API

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 046 — Specify the Versioned Job and Account API |
| Module | \`@moss/contracts/openapi\` |

OpenAPI 3.1 contract for auth, account data rights, jobs, uploads, validation, status, cancel, forget, and results. Safe errors only — never object paths, plaintext credentials, bearer URLs in lists, or raw provider errors.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | openapi.json + generated-types.ts written; positive/negative fixtures validated |
`,
);

w(
  "docs/engineering/job-state-machine.md",
  `# Job Persistence and State Transitions

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 047 — Implement Job Persistence and State Transitions |
| Module | \`@moss/api/jobs\` |

Guarded transitions cover draft through canceled. Report availability is separate from job status. Manifests are immutable. Optimistic version checks prevent concurrent corruption. Terminal jobs never reprocess.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Transition table races and late cancellation covered by unit suite |
`,
);

w(
  "docs/engineering/auth-sessions.md",
  `# Authentication, Sessions, and Authorization

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 048 — Implement Authentication, Sessions, and Authorization Boundary |
| Module | \`@moss/api/auth\` |

Email magic-link with 10-minute device-bound nonce, 15-minute access tokens, rotating 30-day refresh with reuse detection, logout-all, and pluggable entitlements. Purchase IDs are never authentication. Production refuses fake entitlements. Refresh material stays local.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Nonce replay/expiry/device binding and refresh reuse verified offline |
`,
);

w(
  "docs/engineering/upload-sessions.md",
  `# Temporary Upload Sessions

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 049 — Create Temporary Upload Sessions |
| Module | \`@moss/api/uploads/sessions\` |

Short-lived tenant/job-bound upload sessions with opaque keys, exact count/size/type/checksum constraints, expiry, optional multipart cleanup, and lifecycle backstop. No public access or client keys.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Origin/ownership/replay/expiry/hash checks pass in offline suite |
`,
);

w(
  "docs/engineering/upload-transfer.md",
  `# Upload Transfer Manager

## Document Control

| Field | Value |
| --- | --- |
| Prompt | 050 — Implement the Upload Transfer Manager |
| Module | \`@moss/api/uploads/transfer\` |

After review and entitlement, create a titled job, upload opaque objects with bounded concurrency, track honest progress, verify hashes, and support reselection resume. Cancel cleans active objects and is not forget. File handles do not survive browser restart.

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Drop/resume/cancel/idempotent job creation covered by offline transfer suite |
`,
);

const changes = [
  ["0020-base-code.md", "Add optional base-code handling separate from submission groups."],
  ["0021-preflight.md", "Add client-side preflight validation with warning acknowledgement."],
  ["0022-comparison-settings.md", "Add safe bounded comparison settings with derived directory mode."],
  ["0023-review-consent.md", "Add final review screen with versioned consent gating."],
  ["0024-job-account-api.md", "Add versioned OpenAPI job and account contract."],
  ["0025-job-state-machine.md", "Add job persistence repository and guarded state machine."],
  ["0026-auth-sessions.md", "Add magic-link auth, sessions, and authorization boundary."],
  ["0027-upload-sessions.md", "Add temporary tenant-bound upload sessions."],
  ["0028-upload-transfer.md", "Add upload transfer manager with resume and cancel."],
];

for (const [name, summary] of changes) {
  w(
    `.changes/${name}`,
    `---
train: packages
bump: minor
security: false
approval: standard
---

${summary}
`,
  );
}

console.log("done");
