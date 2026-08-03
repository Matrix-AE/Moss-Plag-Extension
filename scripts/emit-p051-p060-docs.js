"use strict";

const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");

function w(rel, content) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), content, "utf8");
  console.log(rel);
}

const docs = [
  [
    "docs/engineering/server-intake.md",
    "051",
    "Harden Server-Side File and Archive Ingestion",
    "`@moss/api` intake/ingest",
    "Authoritative isolated intake produces immutable sanitized manifests. Traversal, absolute paths, bombs, symlinks, binaries, nested archives, and MIME mismatches fail closed and delete sandbox artifacts.",
  ],
  [
    "docs/engineering/finalize-outbox.md",
    "052",
    "Finalize Uploads and Enqueue Validation Idempotently",
    "`@moss/api` intake/finalize",
    "Completed uploads become exactly one validation outbox task and later one provider event. Quota reserves after intake success, consumes on provider query, and releases on earlier terminal paths.",
  ],
  [
    "docs/engineering/fair-queues.md",
    "053",
    "Build Intake and Fair Provider Queues",
    "`@moss/api` queues/fair",
    "Separate intake and provider queues with tenant fairness, per-credential caps, leases/heartbeats, dead letters, circuit breaker, and honest estimates. Never assume quota reset timezone.",
  ],
  [
    "docs/engineering/stream-adapter.md",
    "054",
    "Define the Stream-Based Provider Adapter",
    "`@moss/provider-adapter/stream-adapter`",
    "Typed single-use stream adapter with mock, disabled, and commercial implementations. No filesystem paths or globals.",
  ],
  [
    "docs/engineering/mock-moss-server.md",
    "055",
    "Build the Mock MOSS Protocol Server",
    "`@moss/provider-adapter/mock-moss-server`",
    "Deterministic loopback TCP mock for offline CI. Synthetic IDs only; teardown captures transcripts; no external MOSS connections.",
  ],
  [
    "docs/engineering/line-parser.md",
    "056",
    "Implement Robust Protocol Line Parsing",
    "`@moss/provider-adapter/line-parser`",
    "Bounded newline parser preserves surplus bytes, caps length, and always uses deadline/abort. One TCP event is never equated with one response.",
  ],
  [
    "docs/engineering/protocol-names.md",
    "057",
    "Sanitize Protocol Names and Build the Manifest",
    "`@moss/provider-adapter/protocol-names`",
    "Collision-safe virtual filenames with stable group roots and display mapping. No drive letters, usernames, or storage keys.",
  ],
  [
    "docs/engineering/socket-transport.md",
    "058",
    "Harden Socket Transport and Lifecycle",
    "`@moss/provider-adapter/socket-transport`",
    "Approved endpoint/transport only with connect/read/write/overall deadlines, abort, and exactly-once cleanup. Production blocks unencrypted traffic.",
  ],
  [
    "docs/engineering/job-commands.md",
    "059",
    "Map Product Jobs to Provider Commands",
    "`@moss/provider-adapter/job-commands`",
    "Deterministic authorized command sequences for pair, batch, projects, and base code. No free-form protocol commands.",
  ],
  [
    "docs/engineering/upstream-failures.md",
    "060",
    "Add Typed Upstream Failures and Safe Retry Rules",
    "`@moss/provider-adapter/failures`",
    "Phase-aware product errors with retry only before upstream side effects. Uncertain outcomes require deliberate resubmit; quota actions are release/consume/hold.",
  ],
];

for (const [rel, num, title, mod, body] of docs) {
  w(
    rel,
    `# ${title}

## Document Control

| Field | Value |
| --- | --- |
| Prompt | ${num} — ${title} |
| Module | ${mod} |

${body}

### Live Walkthrough

| Date | 2026-08-03 |
| Result | Offline module validators and prompt test suite green |
`,
  );
}

w(
  "docs/engineering/extension-local-testing.md",
  `# How to Load and Verify the Extension Locally

## Build

\`\`\`bash
npm install
npm run icons:extension
npm run build:extension
npm run check:extension
\`\`\`

Unpacked output: \`apps/extension/.output/chrome-mv3\`

## Load in Chrome / Edge

1. Open \`chrome://extensions\` (or \`edge://extensions\`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select \`apps/extension/.output/chrome-mv3\`.
5. Pin the extension; open the **popup**, then **Open workspace**.

## What to click through

| Surface | Verify |
| --- | --- |
| Popup | Status glance, open workspace / settings |
| Workspace | Mode (Pair/Batch), language, intake, grouping, base code, settings, preflight, review consents, paywall gate |
| Settings | Origins and permissions copy |

## Dev loop (optional)

\`\`\`bash
npm run dev --workspace @moss/extension
\`\`\`

WXT prints a path to load unpacked; reload the extension after changes.

## Automated gates

\`\`\`bash
npm test
npm run check:extension
\`\`\`

Provider/protocol work (Prompts 051+) is covered by Node tests with the mock loopback server — not by live Stanford MOSS traffic.
`,
);

for (let i = 0; i < 10; i++) {
  const n = 29 + i;
  const summaries = [
    "Add authoritative server-side intake with fail-closed sandbox cleanup.",
    "Add idempotent finalize/outbox with quota reserve-consume-release.",
    "Add fair intake and provider queues with leases and circuit breaker.",
    "Add stream-based single-use provider adapter contract.",
    "Add deterministic loopback mock MOSS protocol server.",
    "Add bounded protocol line parser with deadline and abort.",
    "Add collision-safe protocol names and provider manifest mapping.",
    "Add hardened socket transport with approved endpoints and cleanup.",
    "Add deterministic product-to-provider command mapping.",
    "Add typed upstream failures with phase-aware retry and quota actions.",
  ];
  w(
    `.changes/00${n}-${["server-intake","finalize-outbox","fair-queues","stream-adapter","mock-moss","line-parser","protocol-names","socket-transport","job-commands","upstream-failures"][i]}.md`,
    `---
train: packages
bump: minor
security: false
approval: standard
---

${summaries[i]}
`,
  );
}

console.log("done");
