# Repository Baseline and Evidence Map

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 001 — Repository Baseline and Evidence Map |
| Status | Verified baseline |
| Observation date | 2026-07-28 (Asia/Karachi) |
| Product repository | `https://github.com/Matrix-AE/Moss-Plag-Extension.git` |
| Product snapshot | [`88630cd711f1d6ab93696674ba23fcc43360752b`](https://github.com/Matrix-AE/Moss-Plag-Extension/commit/88630cd711f1d6ab93696674ba23fcc43360752b) |
| Upstream reference | `https://github.com/abdelhalimyasser/node-moss.git` |
| Upstream snapshot | [`07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f`](https://github.com/abdelhalimyasser/node-moss/commit/07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f) |
| Verification command | `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-repository-baseline.ps1` |

## Scope and Evidence Rules

This document freezes two independent repositories at immutable commits:

1. **Target product repository** means `Matrix-AE/Moss-Plag-Extension`. It is the only delivery repository.
2. **Upstream integration reference** means `abdelhalimyasser/node-moss`. It was inspected for protocol and API knowledge; it has not been merged, vendored, or installed into the product.

Claims marked **Observed** are directly supported by a pinned file, Git object, or executed repository command. **Derived risk** means a code-review conclusion that still needs a focused reproduction test before implementation. **Unknown** means a decision or fact deliberately deferred to a later prompt. Mutable branch links are not accepted as evidence.

This prompt did not install dependencies, build product code, contact MOSS, register an account, or submit files. The only added executable artifact is a dependency-free documentation verifier; there is still no product runtime or frontend to wire in this increment.

## Target Product Repository

### Snapshot and File Inventory

At the product snapshot, the complete tracked-file inventory is:

<!-- target-inventory:start -->
```text
100-prompts.md
README.md
plan.md
```
<!-- target-inventory:end -->

The Git history contains two commits:

| Commit | Date | Purpose |
| --- | --- | --- |
| [`6866b8ebb4d7be0f6e12b549eb9b4b5d2f9f4037`](https://github.com/Matrix-AE/Moss-Plag-Extension/commit/6866b8ebb4d7be0f6e12b549eb9b4b5d2f9f4037) | 2026-07-28 | Initial two-line README |
| [`88630cd711f1d6ab93696674ba23fcc43360752b`](https://github.com/Matrix-AE/Moss-Plag-Extension/commit/88630cd711f1d6ab93696674ba23fcc43360752b) | 2026-07-28 | Production plan and ordered implementation prompts |

The baseline was verified with `git ls-tree -r --name-only 88630cd711f1d6ab93696674ba23fcc43360752b`, `git log --reverse`, and `git ls-remote product refs/heads/main`. At verification time, remote `main` resolved to the product snapshot.

### Existing Capabilities

| Capability | Evidence-backed state |
| --- | --- |
| Product description | The README contains only a name and “Plagiarism Checker Extension”; it does not specify or implement behavior. |
| Product strategy | `plan.md` defines a proposed extension, backend, security, commercial, and delivery direction. These are plans, not implemented capabilities. |
| Delivery sequence | `100-prompts.md` provides ordered work and hard gates. No prompt implementation existed at the snapshot. |
| Runtime | None. There is no extension manifest, application source, server, worker, package manifest, or deployable artifact. |
| User interface | None. There is no popup, full-page extension view, component, style, or browser asset to run or test. |
| Automated quality system | None. There is no test runner, test file, CI workflow, lint configuration, or coverage configuration. |

### Missing Product Layers

The snapshot is missing every product implementation layer. Later prompts must introduce them only after their prerequisites:

- product charter, validated requirements, research evidence, and architecture decisions;
- commercial MOSS authorization and a provider-approved encrypted transport decision;
- privacy inventory, consent, retention, deletion, security, and abuse controls;
- Manifest V3 packaging, least-privilege permissions, popup, full-page workflow, and accessibility system;
- authenticated API, upload intake, queue, provider adapter, worker isolation, cleanup, and observability;
- entitlement, payment, device, refund, tax, support, update, and end-of-life behavior for the $15 offer;
- unit, integration, contract, component, end-to-end, security, accessibility, performance, recovery, and release tests;
- CI/CD, environments, infrastructure as code, artifact provenance, store assets, policies, and operational runbooks.

This inventory prevents a planning document from being mistaken for a working or market-ready extension.

### License State

**Observed:** the target snapshot has no `LICENSE`, `COPYING`, `NOTICE`, contributor terms, or product distribution terms. Repository ownership and the license to apply to original product code must be confirmed before outside contribution or sale.

The upstream MIT license does not automatically become the product repository’s license, and it does not authorize commercial use of the external MOSS service. If upstream code is later copied or substantially adapted, its copyright and MIT permission notice must be preserved. Service rights remain a separate Prompt 004/005 gate.

## Upstream `node-moss` Integration Reference

### Provenance

The inspected upstream snapshot is commit `07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f`, authored by Abdelhalim Yasser on 2026-02-14. The repository contains three commits and no tags at the observation date. Its complete tracked inventory is:

```text
.gitignore
.npmignore
LICENSE
README.md
package-lock.json
package.json
src/MOSS.ts
tsconfig.json
tsup.config.ts
```

The repository declares package version `1.0.0`, a single runtime dependency on `glob`, TypeScript/Node build dependencies, and an MIT license. The v3 lockfile resolves the direct tools to `glob@10.5.0`, `tsup@8.5.1`, `typescript@5.9.3`, and `@types/node@20.19.26`. These facts describe the pinned source only; package registry contents and current provider behavior are outside Prompt 001.

### API and Protocol

The upstream exposes one stateful `MOSS` class:

| Area | Observed behavior | Evidence |
| --- | --- | --- |
| Construction | Accepts any `userID` string and optional server/port; defaults to `moss.stanford.edu:7690`. | `src/MOSS.ts` lines 60–72 |
| Configuration | Stores comment, directory mode, language, ignore limit, result limit, and experimental-server flag. | `src/MOSS.ts` lines 49–169 |
| Input collection | Adds base files, submission files, or glob matches using local filesystem paths. | `src/MOSS.ts` lines 171–197 |
| Connection | Opens a Node `net.Socket`, which is raw TCP rather than TLS. | `src/MOSS.ts` lines 262–270 |
| Session commands | Writes user ID, directory mode, experimental flag, maximum matches, result count, and language. | `src/MOSS.ts` lines 272–290 |
| Upload grouping | Sends every base file with ID `0`; submission IDs start at `1` and increment per added file. | `src/MOSS.ts` lines 292–301 |
| Completion | Sends `query 0 <comment>`, returns the first response line as a string, then writes `end`. | `src/MOSS.ts` lines 303–314 |

This is useful protocol research, but the product must place provider communication behind an independently specified and tested adapter. The public client’s current transport and command handling are not approved production architecture.

### Build and Package

| Concern | Observed state |
| --- | --- |
| Package entry points | `package.json` declares `dist/MOSS.js` and `dist/MOSS.d.ts`. |
| Build command | `npm run build` invokes `tsup`; `prepublishOnly` invokes the build. |
| Build output | `tsup.config.ts` requests CommonJS, ESM, declarations, shims, clean output, and external Node modules. |
| TypeScript | `tsconfig.json` targets ES2018/CommonJS with strict and strict-null checks for `src/MOSS.ts`. |
| Runtime dependency | `glob` is used by `addByWildcard`; filesystem and networking use Node built-ins. |
| Publication metadata | The package has no `engines`, `exports`, `module`, or `prepare` field; ESM output is requested but not advertised through package metadata. |
| Browser suitability | The implementation imports Node filesystem and TCP modules, so it cannot run in a Manifest V3 browser context as-is. |

No dependency was installed and no build was run for this baseline. Build reproducibility, emitted entry-point correctness, dependency audit, and browser/backend partitioning require later implementation tests.

### Tests and Quality Evidence

**Observed:** `package.json` defines `npm test` as a message followed by exit code `1`; the pinned inventory has no test or CI files. Therefore upstream behavior has no repository-supplied automated regression evidence at this snapshot.

The README documents a happy-path API example and method tables. Documentation is useful orientation, but it is not execution evidence and does not cover transport failure, fragmentation, timeouts, concurrency, invalid protocol data, cleanup, or privacy.

### Known Defects and Risks

| ID | Classification | Finding | Consequence | Required follow-up |
| --- | --- | --- | --- | --- |
| U-R01 | Observed | Provider traffic uses `net.connect` without a TLS layer. | Source code and credentials are not protected in transit by this client. | Prompt 004/005 must confirm an approved encrypted provider path before live product traffic. |
| U-R02 | Observed | The only declared test command intentionally exits unsuccessfully and there are no tests/CI files. | No upstream regression confidence can be inherited. | Build a local mock-provider contract suite before adapting any behavior. |
| U-R03 | Observed | No connection, read, write, or whole-job timeout is configured. | A stalled server or fragmented response may leave work unresolved indefinitely. | Specify deadlines, cancellation, bounded retries, and cleanup; verify with fault injection. |
| U-R04 | Derived risk | `sendCommand` uses a one-shot `data` listener while its buffer logic expects more than one chunk. | A first chunk without a newline can remove the only listener and leave the promise pending. | Reproduce with a local fragmented-response server before adapter design. |
| U-R05 | Observed | User ID, comment, and normalized path are interpolated into line commands without newline/control-character validation. | Untrusted values could corrupt command framing or disclose path information. | Use opaque filenames, strict schemas, and protocol-safe serialization tests. |
| U-R06 | Observed | The first query response line is returned without URL origin/scheme validation. | An invalid or malicious response could be exposed as a result link. | Parse and allowlist provider result origins; reject all other values. |
| U-R07 | Observed | `fs.stat` accepts a path without confirming it is a regular file; reading occurs later. | Directories and unsupported filesystem objects fail late and inconsistently. | Validate authoritative file manifests before queuing or provider submission. |
| U-R08 | Observed | `getSupportedLanguages` returns the mutable internal array. | A caller can mutate the client’s later validation behavior. | Expose immutable configuration generated from an independently verified language registry. |
| U-R09 | Derived risk | One mutable socket and mutable file arrays are stored on an instance with no concurrent-send guard. | Overlapping sends may interfere with state and cleanup. | Make each job isolated and test concurrency and cancellation races. |
| U-R10 | Unknown | Public README claims, language codes, service commands, limits, and result behavior were not corroborated here against provider terms. | Building around stale assumptions can break compliance or correctness. | Prompt 004 must verify every provider fact from current authoritative sources. |
| U-R11 | Observed | Generated `dist` artifacts are untracked and no `prepare` script exists. | Installing directly from the Git SHA may not provide the declared entry points. | Treat the source as reference material; establish reproducible product builds and package tests independently. |

### Reusable Assets

| Asset | Reuse decision | Conditions |
| --- | --- | --- |
| Protocol command sequence | Research input only | Re-specify behind a provider adapter and verify against authoritative/current behavior and a mock server. |
| TypeScript method vocabulary | Conceptual input | Redesign around immutable job configuration, schemas, ownership, cancellation, and typed errors. |
| Language-code list | Candidate seed data | Do not ship until Prompt 004 verifies it; generate UI/backend values from one registry. |
| Base-file and directory-mode concepts | Product-domain input | Preserve only after UX research and contract tests confirm grouping semantics. |
| Wildcard/local-path ingestion | Do not copy into extension | Browser file APIs and secure backend manifests require a different design. |
| README example | Test-scenario inspiration | Convert only synthetic cases into mock-provider tests; never use real student source or credentials. |
| MIT-licensed source | Eligible for evaluated reuse | Preserve the upstream copyright and permission notice for copied/substantial portions; complete dependency and security review first. |
| Raw socket implementation | Do not ship | Replace with a provider-approved encrypted transport or stop/pivot at the commercial gate. |

## Assumptions Requiring Validation

| ID | Assumption or open question | Owner prompt | Blocking effect |
| --- | --- | --- | --- |
| A-001 | Matrix AE owns or is authorized to license all original code placed in the product repository. | Prompt 005 / legal setup | Blocks external contribution and sale until recorded. |
| A-002 | A paid automated integration can receive written commercial provider authorization. | Prompt 005 | Blocks provider-dependent implementation and launch. |
| A-003 | The commercial provider can offer an approved encrypted submission and result path. | Prompt 004/005 | Blocks live transmission of student or confidential source. |
| A-004 | Current language codes, grouping commands, limits, report behavior, and account rules match the legacy client. | Prompt 004 | Blocks final provider contract and UI claims. |
| A-005 | A one-time $15 entitlement can fund the chosen architecture and support window. | Prompt 006 | Blocks architecture selection and commerce implementation. |
| A-006 | Target users have authority to upload every submitted file and accept provider processing. | Prompt 002/003/008 | Blocks final submission UX and policy copy. |
| A-007 | Browser extension APIs can support the desired pair, batch, and grouped-project flows within documented limits. | Prompt 003/011 | Blocks final interaction and ingestion design. |
| A-008 | Provider-hosted result links can be opened directly under approved confidentiality and retention terms. | Prompt 004/005/008 | Blocks result-link behavior. |

No account pooling or rotation is an acceptable answer to authorization, quota, reliability, or unit-economics questions.

## Evidence Map

| ID | Scope | Claim | Immutable evidence | Status / confidence |
| --- | --- | --- | --- | --- |
| E-T01 | target | README contains only the initial product name/description. | [target `README.md`](https://github.com/Matrix-AE/Moss-Plag-Extension/blob/88630cd711f1d6ab93696674ba23fcc43360752b/README.md) | Observed / high |
| E-T02 | target | The proposed architecture, gates, and product scope are planning statements. | [target `plan.md`](https://github.com/Matrix-AE/Moss-Plag-Extension/blob/88630cd711f1d6ab93696674ba23fcc43360752b/plan.md) | Observed / high |
| E-T03 | target | Delivery is organized into 100 ordered prompts with hard prerequisites. | [target `100-prompts.md`](https://github.com/Matrix-AE/Moss-Plag-Extension/blob/88630cd711f1d6ab93696674ba23fcc43360752b/100-prompts.md) | Observed / high |
| E-U01 | upstream | Upstream describes itself as a Promise-based Node client and documents its intended API. | [upstream `README.md`](https://github.com/abdelhalimyasser/node-moss/blob/07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f/README.md#L10-L170) | Observed / high |
| E-U02 | upstream | Package metadata declares entries, scripts, dependency, tooling, and MIT identifier. | [upstream `package.json`](https://github.com/abdelhalimyasser/node-moss/blob/07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f/package.json#L1-L38) | Observed / high |
| E-U03 | upstream | One source file implements configuration, file collection, raw socket protocol, and result return. | [upstream `src/MOSS.ts`](https://github.com/abdelhalimyasser/node-moss/blob/07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f/src/MOSS.ts#L1-L316) | Observed / high |
| E-U04 | upstream | TypeScript compilation is strict and scoped to the MOSS source. | [upstream `tsconfig.json`](https://github.com/abdelhalimyasser/node-moss/blob/07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f/tsconfig.json#L1-L16) | Observed / high |
| E-U05 | upstream | `tsup` is configured for CommonJS, ESM, and declarations. | [upstream `tsup.config.ts`](https://github.com/abdelhalimyasser/node-moss/blob/07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f/tsup.config.ts#L1-L10) | Observed / high |
| E-U06 | upstream | The source license grants MIT permissions subject to notice preservation. | [upstream `LICENSE`](https://github.com/abdelhalimyasser/node-moss/blob/07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f/LICENSE#L1-L21) | Observed / high |
| E-U07 | upstream | Ignore rules exclude build output, dependencies, logs, environment files, and platform metadata. | [upstream `.gitignore`](https://github.com/abdelhalimyasser/node-moss/blob/07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f/.gitignore) | Observed / high |
| E-U08 | upstream | Published package exclusions also omit TypeScript/build configuration files. | [upstream `.npmignore`](https://github.com/abdelhalimyasser/node-moss/blob/07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f/.npmignore) | Observed / high |
| E-U09 | upstream | The v3 lockfile pins the dependency graph used by the snapshot. | [upstream `package-lock.json`](https://github.com/abdelhalimyasser/node-moss/blob/07c6bf18aeefe1e6bb84bf77cbe777d5bf4a0e2f/package-lock.json#L1-L18) | Observed / high |

## Verification Record

### Test Cases

| Test | Purpose | Expected result |
| --- | --- | --- |
| P001-T01 | Validate required sections and their order. | Every required section appears exactly once and in sequence. |
| P001-T02 | Compare the declared target inventory with the pinned Git tree. | Exactly the three declared files are present at the snapshot. |
| P001-T03 | Separate target license absence from upstream MIT presence. | No target license-like file exists; upstream `LICENSE` exists and contains `MIT License`. |
| P001-T04 | Validate evidence scope and immutability. | Required target/upstream files use the correct repository and 40-character snapshot SHA; no mutable blob links exist. |
| P001-T05 | Validate local documentation links and Markdown structure. | Local links resolve, fenced blocks balance, and no trailing whitespace is present. |
| P001-T06 | Detect high-signal credential/source-result leakage. | No private keys, provider result URLs, access tokens, or forbidden secret filenames are tracked. |
| P001-T07 | Optionally validate public upstream permalinks over the network. | Every unique upstream evidence URL returns a successful or redirect HTTP status. |
| P001-T08 | Confirm verification is read-only. | Running the verifier does not change Git worktree status. |

The dependency-free verifier is the executable acceptance gate for this documentation-only prompt. Remote target links are private and are validated from the pinned local Git object; optional anonymous network validation is limited to public upstream links.

### Execution Results

Verified on 2026-07-28 at 20:25 PKT with Windows PowerShell 5.1:

| Command | Result |
| --- | --- |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-repository-baseline.ps1` | Passed 8/8 test cases |
| `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-repository-baseline.ps1 -CheckNetwork` | Passed 8/8 test cases, including public upstream permalink reachability |
| `git diff --check` | Passed; no whitespace errors |

Prompt 001 has no product runtime or UI, so a frontend integration test is not applicable. The next UI-bearing prompt must add its own component and packaged-extension coverage rather than claiming this documentation gate exercised a nonexistent frontend.
