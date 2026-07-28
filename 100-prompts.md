# 100 Production Implementation Prompts

These prompts convert [`plan.md`](./plan.md) into a production delivery sequence. Execute them in numerical order, keep each change reviewable, and attach the requested evidence before moving past a gate.

## Global execution contract

- Treat `plan.md` and approved ADRs as the product source of truth; record any necessary divergence instead of silently changing scope.
- Prompt 5 is a hard branch: `stop` ends execution; `pivot` or `native companion` requires regenerating later architecture-specific prompts before continuing; hosted live traffic requires written rights and encrypted transport.
- Prompt 6 fixes the measurable $15 offer and numeric hosted allowance before Prompt 10 selects architecture or downstream quota/payment work begins.
- Keep real source code, provider IDs, result URLs, payment secrets, and customer data out of the repository, fixtures, logs, analytics, screenshots, and CI.
- Use synthetic fixtures and a local mock provider in automated tests; any live smoke test must be separately authorized, manual, quota-aware, and non-sensitive.
- Preserve the upstream MIT notice, request minimal extension permissions, use responsible similarity terminology, and never implement account pooling or rotation.
- For every prompt, update documentation and tests in the same change, run the narrow checks first and the complete relevant quality suite before handoff.

## Phase A — Discovery, decisions, and foundations

## Prompt 001 — Repository Baseline and Evidence Map

- **Objective:** Produce a factual baseline of the current repository before introducing product architecture or implementation changes.
- **Context:** The product repository begins with a README plus these planning files; the MIT `node-moss` repository was audited separately as an integration reference.
- **Requirements:** Document target files/history/license state and separately map upstream dependencies, API, protocol, builds, tests, defects, provenance, and reusable assets.
- **Constraints:** Keep this step documentation-only; do not install dependencies, alter runtime code, or claim behavior that is not evidenced by the repository.
- **Acceptance:** `docs/discovery/repository-baseline.md` clearly separates existing capabilities, missing product layers, technical risks, and assumptions requiring validation.
- **Verification:** Compare against target `rg --files`/Git/license state and dated links to upstream `package.json`, `src/MOSS.ts`, build config, README, and MIT license.

## Prompt 002 — Product Charter and Responsible Terminology

- **Objective:** Define the product purpose, target users, value proposition, commercial boundary, and language standards.
- **Context:** The planned $15 one-time-purchase extension helps users submit code comparisons and receive a provider-hosted result link.
- **Requirements:** Define personas, jobs-to-be-done, supported scenarios, exclusions, success metrics, pricing assumption, and use of “similarity” versus “plagiarism.”
- **Constraints:** Do not claim that similarity proves misconduct, that the product is affiliated with Stanford, or that every uploaded document format is supported.
- **Acceptance:** `docs/product/product-charter.md` gives design and engineering an unambiguous promise, audience, ethical boundary, and measurable initial outcome.
- **Verification:** Review every proposed UI claim against the charter and confirm that “similarity report” is the default user-facing term.

## Prompt 003 — MVP Workflows and Product Requirements

- **Objective:** Convert the charter into complete MVP workflows and a prioritized product requirements document.
- **Context:** Users need pair comparison, batch comparison, multi-file project grouping, optional base code, configuration, progress, and a result URL.
- **Requirements:** Specify journeys/edges and run target-user interviews plus prototype, grouping/privacy-comprehension, competitor, pricing, and willingness-to-pay research.
- **Constraints:** Keep report interpretation and scraping outside MVP; distinguish individual files from grouped project submissions and base-code exclusions.
- **Acceptance:** `docs/product/mvp-prd.md` contains research evidence, numbered requirements, priorities, user stories, edges, and traceable acceptance criteria.
- **Verification:** Test prototypes with target adults and walk two files, twenty files, two projects, invalid/mixed input, offline, timeout, consent, and pricing.

## Prompt 004 — Official MOSS Service and Protocol Verification

- **Objective:** Validate the current MOSS protocol, registration, languages, service limits, privacy behavior, and acceptable-use conditions from authoritative sources.
- **Context:** The separately audited upstream client accepts any ID string and assumes raw TCP at `moss.stanford.edu:7690`; official credentials are numeric.
- **Requirements:** Record dated primary sources, command semantics, grouping rules, account requirements, quotas, result behavior, commercial restrictions, and open questions.
- **Constraints:** Label protocol details inferred from legacy code as unverified until corroborated; do not send test traffic or register accounts during research.
- **Acceptance:** `docs/compliance/moss-service-research.md` separates verified facts, implementation assumptions, policy risks, and questions requiring written clarification.
- **Verification:** Recheck every material claim against its linked source and obtain human review before any live traffic or managed-account implementation.

## Prompt 005 — Commercial Permission and Account Strategy Gate

- **Objective:** Obtain a lawful commercial-use decision and select a supportable provider-account model before provider-dependent implementation.
- **Context:** Public MOSS is non-commercial and enforces 100 submissions per day per user; no published authorization was found for a paid wrapper.
- **Requirements:** Seek written paid-automation/SaaS, account, quota/reset, data, TLS submission/report, SLA, support, brand, retention, and termination terms.
- **Constraints:** Do not use free/BYO/shared accounts without approval; pooling/rotation would evade the enforced per-user limit and is never a workaround.
- **Acceptance:** An ADR records go/pivot/stop, rights evidence, encrypted-transport decision, credential model, limits, fallback, owners, and review dates.
- **Verification:** Cross-functional owners sign; `stop` halts work and `pivot/native` triggers a regenerated backlog before later prompts continue.

## Prompt 006 — Define the $15 Offer and Unit-Economics Gate

- **Objective:** Define exactly what one $15 purchase buys and prove the selected architecture can sustain that promise.
- **Context:** Provider fees, payment/tax, hosting, support, refunds, fraud, updates, and long-tail use create recurring cost behind a one-time price.
- **Requirements:** Set numeric allowance, two devices, non-expiring feature entitlement, auto-update/major-version behavior, hosted EOL, refunds, remedy, and three-year scenarios.
- **Constraints:** Do not use vague fair use, hidden throttling, account-limit evasion, unlimited lifetime hosting, or architecture work based on unknown economics.
- **Acceptance:** An approved model records conservative/expected/high-use cost, margin, exact customer promise, go/pivot/price decision, and downstream parameters.
- **Verification:** Product/finance validate provider quotes, processor/tax assumptions, infrastructure/support estimates, and sensitivity before Prompt 10 begins.

## Prompt 007 — Privacy Data Inventory and Flow Map

- **Objective:** Identify every personal, credential, source-code, telemetry, payment, and result-link datum handled by the product.
- **Context:** Source may pass from extension through a backend to a provider while IDs, filenames, IP addresses, logs, and purchase records may also exist.
- **Requirements:** Map collection, processors, transfers, storage, encryption, roles, purpose, retention, deletion, and user controls for every data category.
- **Constraints:** Apply data minimization; treat source and report URLs as highly sensitive; never place credentials or content in analytics or ordinary logs.
- **Acceptance:** `docs/privacy/data-flow.md` covers local, extension, API, storage, queue, worker, provider, payment, support, and observability paths.
- **Verification:** Trace representative pair and batch jobs and confirm each transmitted or stored field has a documented owner, purpose, and retention rule.

## Prompt 008 — Consent, Retention, and Deletion Requirements

- **Objective:** Translate the data map into enforceable consent, retention, deletion, and incident-response product requirements.
- **Context:** Users must understand that code reaches an external provider and that provider-side report deletion is outside the extension’s direct control.
- **Requirements:** Define pre-submit disclosure, affirmative consent, temporary deletion, log redaction, account export/deletion, support access, and processor caveats.
- **Constraints:** Do not promise deletion or report availability that the provider does not guarantee; default temporary storage to the shortest viable window.
- **Acceptance:** Approved requirements name exact UI copy locations, backend deletion jobs, audit evidence, exceptions, owners, and policy version handling.
- **Verification:** Test consent gating conceptually, trace success/failure deletion, exercise a deletion request, and reconcile wording with actual planned behavior.

## Prompt 009 — Security Threat Model and Control Backlog

- **Objective:** Threat-model the extension, API, storage, queue, worker, provider transport, payment, licensing, and operational access.
- **Context:** Risky inputs include filenames, IDs, comments, archives, source, result URLs, extension messages, webhooks, and raw line-based commands.
- **Requirements:** Cover injection, SSRF, archive traversal/bombs, malware, IDOR, replay, XSS, secret leakage, supply chain, insiders, fraud, and denial of service.
- **Constraints:** Treat all client input and provider responses as untrusted; prohibit client-selected provider hosts/ports and control characters in protocol fields.
- **Acceptance:** `docs/security/threat-model.md` ranks threats, assigns mitigations/owners/milestones, and marks launch-blocking security work.
- **Verification:** Review every trust boundary and ensure each high-severity threat has prevention, detection, tests, and a documented residual-risk owner.

## Prompt 010 — Product Architecture Decision

- **Objective:** Approve a production architecture compatible with browser-extension restrictions and the Node-based provider client.
- **Context:** Manifest V3 cannot use Node `net`, `fs`, or `glob`, so direct raw-TCP submission from normal extension code is not viable.
- **Requirements:** Using Prompts 5–6, choose hosted/native/alternative architecture and define extension, identity, transport, storage, jobs, provider, deployment, and trust boundaries.
- **Constraints:** Stop or regenerate this backlog after a non-hosted pivot; require encrypted launch transport, keep secrets server-side, and minimize source storage.
- **Acceptance:** An ADR records topology, hosted-versus-native choice, rejected alternatives, scaling/failure behavior, controls, and estimated operating cost.
- **Verification:** Validate the ADR against all MVP workflows, threats, privacy flows, MV3 constraints, commercial terms, and the $15 unit-economics model.

## Prompt 011 — Submission and Comparison Domain Model

- **Objective:** Define a domain model for pair files, batch submissions, grouped projects, base code, provider settings, and results.
- **Context:** The current library assigns one ID per file and lacks a first-class representation of multiple files belonging to one student/project.
- **Requirements:** Model drafts, jobs, groups, files, base files, language, lifecycle, result references, validation errors, schema versions, and idempotency keys.
- **Constraints:** Preserve display names separately from safe protocol names; never infer trusted grouping solely from user-controlled paths.
- **Acceptance:** Shared schema examples cover two files, many flat files, two multi-file projects, many projects, mixed-language rejection, and base code.
- **Verification:** Unit-test serialization, invariants, stable IDs, grouping, duplicate names, nested paths, empty groups, and version compatibility.

## Prompt 012 — Nonfunctional Requirements and Launch Gates

- **Objective:** Define measurable reliability, performance, accessibility, security, privacy, compatibility, deletion, and support expectations.
- **Context:** A paid one-time utility still needs dependable jobs, understandable failures, browser compatibility, and sustainable usage boundaries.
- **Requirements:** Propose user SLIs/SLOs, file/count/size limits, timeouts, Chrome matrix, WCAG target, RPO/RTO, deletion, and support expectations.
- **Constraints:** Use Prompt 6’s numeric allowance; label performance targets provisional and never promise permanent reports or unsupported availability.
- **Acceptance:** `docs/product/nonfunctional-requirements.md` contains thresholds, owners, evidence sources, and explicit launch-blocking gates.
- **Verification:** Map each requirement to an automated test, monitoring signal, operational drill, manual audit, or documented pre-launch decision.

## Prompt 013 — Monorepo Scaffold

- **Objective:** Reorganize the repository into a maintainable monorepo for extension, API, worker, contracts, UI, configuration, and provider adapter.
- **Context:** The product repository is nearly empty; the audited `node-moss` code is an external MIT reference that may be imported only with provenance.
- **Requirements:** Establish extension/API/two workers/shared packages/infra/docs and import only the approved provider-client portions with attribution and tests.
- **Constraints:** Preserve upstream MIT notice and commit/source provenance, isolate the import from product code, and keep package dependencies acyclic.
- **Acceptance:** One root install supports build, typecheck, lint, and test orchestration while each workspace remains independently addressable.
- **Verification:** Inspect the workspace graph and run all root quality commands from a clean clone with deterministic output and no undeclared imports.

## Prompt 014 — Reproducible Runtime and Package Tooling

- **Objective:** Pin supported runtimes and package-management behavior for reproducible local, CI, and production builds.
- **Context:** The upstream reference lockfile implies modern Node, while the product repository declares no runtime, engine, package manager, or lockfile policy.
- **Requirements:** Choose an active Node LTS, pin the package manager through Corepack, add engine metadata, runtime files, lockfile policy, and setup checks.
- **Constraints:** Use one package manager across workspaces; reject unsupported runtime execution and silently regenerated lockfiles.
- **Acceptance:** A fresh environment receives clear version guidance, installs deterministically, and runs documented commands without global dependencies.
- **Verification:** Test clean installs on supported CI systems, compare lockfile integrity, and prove unsupported Node versions fail immediately and clearly.

## Prompt 015 — Workspace Boundaries and Dependency Rules

- **Objective:** Enforce boundaries between browser, server, worker, protocol, contracts, and reusable presentation code.
- **Context:** Importing Node-only code into the extension would cause build failure, unsafe polyfills, or secret/runtime leakage.
- **Requirements:** Define public exports, browser/server conditions, dependency direction, forbidden imports, and ownership for every workspace.
- **Constraints:** `apps/extension` and `packages/ui` must never depend on Node sockets/filesystems, backend secrets, or the concrete transport implementation.
- **Acceptance:** Boundary lint rules and export maps prevent cross-layer leakage while exposing only intentional typed entry points.
- **Verification:** Add negative fixtures that attempt forbidden imports and confirm typecheck/lint/CI reject them before packaging or deployment.

## Prompt 016 — Shared TypeScript Configuration

- **Objective:** Standardize strict TypeScript across browser, Node, tests, and shared packages without hiding environment mistakes.
- **Context:** One legacy CommonJS-oriented configuration cannot correctly represent every planned runtime and build target.
- **Requirements:** Create base, browser, Node, and test presets with strict flags, project references, path discipline, declarations, and incremental builds.
- **Constraints:** Avoid broad ambient types, unchecked assertions, unjustified suppression, and aliases that break package resolution.
- **Acceptance:** Every workspace extends the correct preset and passes typechecking independently and through the root orchestrator.
- **Verification:** Run clean/incremental checks, inspect declarations, and inject temporary browser/Node cross-environment violations to prove detection.

## Prompt 017 — Formatting, Linting, and Commit Quality

- **Objective:** Create a low-friction quality baseline enforced consistently in editors, local commits, and CI.
- **Context:** The new product repository has no formatter, linter, staged checks, import policy, or commit convention.
- **Requirements:** Configure EditorConfig, formatting, type-aware linting, import ordering, staged checks, conventional commits, and documented escape hatches.
- **Constraints:** Exclude generated artifacts, keep hooks fast, and require a reason for every rule suppression.
- **Acceptance:** Root format, lint, and staged commands are deterministic and legacy formatting is normalized in an isolated mechanical change.
- **Verification:** Run checks twice and prove they reject floating promises, unsafe types, forbidden imports, unused suppressions, and malformed commits.

## Prompt 018 — Runtime-Validated Contracts Foundation

- **Objective:** Establish one source of truth for extension-to-API payloads, jobs, errors, limits, capabilities, and results.
- **Context:** Compile-time TypeScript types do not validate untrusted extension input, multipart metadata, webhooks, or backend responses.
- **Requirements:** Define runtime schemas, inferred types, stable error codes, versioning, serialization rules, and generated API documentation/client types.
- **Constraints:** Keep schemas transport-focused, redact sensitive fields from errors, and make breaking changes explicit and migratable.
- **Acceptance:** `packages/contracts` validates requests/responses on both sides and documents public routes and job transitions.
- **Verification:** Contract tests cover valid examples, boundaries, unknown/missing fields, malformed payloads, version mismatch, and safe errors.

## Prompt 019 — Environment Configuration and Secrets Contract

- **Objective:** Make configuration explicit, validated, environment-specific, and safe for packaged/open-source client code.
- **Context:** URLs, storage, queues, observability, payment, limits, encryption, and provider settings vary by environment.
- **Requirements:** Add typed startup validation, example files, secret classification, rotation guidance, public-variable allowlisting, and useful failures.
- **Constraints:** Never commit secrets, expose server-only values in extension bundles, log secret values, or fall back to insecure production defaults.
- **Acceptance:** Every app publishes its configuration contract and refuses startup/build when required or mutually dependent values are invalid.
- **Verification:** Seed canary secrets, scan source and built artifacts, test invalid environments, and inspect logs/error paths for redaction.

## Prompt 020 — Test Infrastructure and Protocol Harnesses

- **Objective:** Establish fast, deterministic test layers before product behavior expands.
- **Context:** The product has no test harness; the upstream reference’s `npm test` is a placeholder and live MOSS is unsuitable for CI.
- **Requirements:** Configure unit, contract, component, extension E2E, API integration, worker, and injectable TCP-harness interfaces with safe fixtures and coverage.
- **Constraints:** CI must never require live credentials or transmit fixture code externally; keep any authorized manual smoke path separate.
- **Acceptance:** Root tests run offline with placeholder fake transports; Prompt 55 will add the full scripted mock TCP server and adversarial scenarios.
- **Verification:** Prove each harness runs in isolation, blocks external MOSS egress, reports coverage, and catches one seeded contract/state defect.

## Prompt 021 — Continuous Integration Quality Gates

- **Objective:** Require every change to prove buildability, correctness, packaging integrity, and policy compliance before merge.
- **Context:** The repository currently has no CI or required checks.
- **Requirements:** Add install, format, lint, typecheck, unit, contract, integration, build, extension package, artifact scan, license, and dependency-security jobs.
- **Constraints:** Pin action versions, minimize token permissions, isolate untrusted pull requests, and keep production secrets out of ordinary CI.
- **Acceptance:** Branch protection can require a deterministic pipeline with clear failures, retained reports, and no live provider submission.
- **Verification:** Exercise success, test failure, lockfile drift, secret detection, forbidden dependency, vulnerable package, and invalid manifest scenarios.

## Prompt 022 — Supply Chain, Versioning, and Release Policy

- **Objective:** Define safe dependency maintenance and repeatable releases for extension, services, and packages.
- **Context:** A paid product needs traceable artifacts, predictable upgrades, rollback, vulnerability response, and separate client/server releases.
- **Requirements:** Configure update automation, dependency review, SBOM, license scan, changesets, semantic versions, signed artifacts, and release notes.
- **Constraints:** Separate store submission from backend deployment and require human approval for production, breaking, or security-sensitive updates.
- **Acceptance:** `docs/engineering/release-process.md` specifies provenance, staged rollout, rollback, hotfix, compatibility, and deprecation procedures.
- **Verification:** Perform an unpublished dry-run release producing checksummed artifacts, provenance, an SBOM, and rollback evidence.

## Phase B — Extension shell and design system

## Prompt 023 — Manifest V3 Extension Shell

- **Objective:** Create the minimal production-ready extension shell using WXT, React, TypeScript, and Manifest V3.
- **Context:** The extension handles file selection, job control, and results while all raw provider transport remains outside browser code.
- **Requirements:** Add popup, full-page workspace, service worker, settings, icons, CSP, exact API/dedicated-upload origins, minimum permissions, and deterministic packaging.
- **Constraints:** Request no permission without a documented feature; prohibit inline/remote executable code, `eval`, and Node polyfills.
- **Acceptance:** The unpacked extension installs, opens each surface, survives service-worker suspension, and produces a store-ready archive.
- **Verification:** Inspect generated manifest/bundles, test supported browsers, and run automated permission, CSP, source-map, and forbidden-import checks.

## Prompt 024 — Extension State and Message Architecture

- **Objective:** Define predictable state ownership and safe communication among popup, workspace, settings, service worker, storage, and API client.
- **Context:** Popups close, workers suspend, jobs outlive views, and sensitive information must not persist accidentally.
- **Requirements:** Specify messages, migrations, 24-hour draft fields/purge, and active opaque job IDs purged within 24 hours after terminal state.
- **Constraints:** Persist no title/labels/names/paths/hashes/source/`File`; validate messages, allowlist actions, use local not sync, and distrust worker memory.
- **Acceptance:** A typed implementation can reopen during a job without duplicating submission or losing recoverable status.
- **Verification:** E2E tests close/reopen views, suspend/reload the worker, restart the browser, send malformed messages, and migrate stale storage.

## Prompt 025 — Extension Information Architecture

- **Objective:** Turn approved workflows into a compact information architecture for popup, workspace, settings, consent, progress, and results.
- **Context:** Users need a simple first run while grouping and advanced options remain discoverable without overwhelming the primary task.
- **Requirements:** Define hierarchy, synthetic/local preview, final-review paywall transition, progressive disclosure, keyboard order, and popup/workspace behavior.
- **Constraints:** Keep the primary action visible, avoid deep navigation, and never hide privacy or destructive consequences behind ambiguous icons.
- **Acceptance:** Wireframes cover free demo/local draft, payment only before upload, first/return use, pair/batch, processing, results, failures, and accounts.
- **Verification:** Walk every MVP scenario at target popup/workspace sizes and map each requirement to one clear entry and recovery path.

## Prompt 026 — Original Brand and Visual Direction

- **Objective:** Establish a distinctive, modern Gen-Z visual direction that remains credible for academic and professional code review.
- **Context:** The product should feel fast, friendly, and current without implying Stanford ownership or trivializing integrity decisions.
- **Requirements:** Define naming placeholders, mood, colors, shape/illustration language, voice, microcopy, dark/light behavior, and visual-energy examples.
- **Constraints:** Avoid institutional imitation, accusatory verdict imagery, inaccessible neon combinations, and trend effects that reduce comprehension.
- **Acceptance:** An art-direction document and mood board guide popup, workspace, settings, checkout, store assets, and support surfaces consistently.
- **Verification:** Review for originality, non-affiliation, contrast feasibility, theme behavior, responsible tone, and charter alignment.

## Prompt 027 — Semantic Design Tokens

- **Objective:** Build the token foundation for consistent color, spacing, size, radius, border, shadow, layering, and density.
- **Context:** Compact extension surfaces need comfortable layouts across near-black, elevated, and light surfaces without hardcoded values.
- **Requirements:** Define primitive and semantic tokens, component mappings, CSS variables, typed exports, naming rules, and an 8-pixel spacing system.
- **Constraints:** Components consume semantic tokens; accents remain purposeful; all text/status combinations meet approved contrast targets.
- **Acceptance:** `packages/ui` exports versioned tokens used by representative popup/workspace specimens in dark and light themes.
- **Verification:** Run schema/token validation, contrast checks, unused-token reporting, and visual snapshots across viewport and zoom matrices.

## Prompt 028 — Typography and Iconography System

- **Objective:** Define readable typography and coherent lightweight icons optimized for small extension surfaces.
- **Context:** Names, code languages, counts, statuses, helper text, warnings, and actions compete for limited space.
- **Requirements:** Specify locally bundled font/fallbacks, scale, weights, line heights, truncation, numeric styles, icon sizes, and accessible names.
- **Constraints:** Avoid remote fonts, oversized display text, icon-only critical actions, arbitrary glyph mixing, and unlicensed assets.
- **Acceptance:** Specimens demonstrate hierarchy for every planned content role and remain legible at supported zoom and long localization strings.
- **Verification:** Inspect bundles/licenses, test fallback fonts, run clipping snapshots, and confirm semantic colors and accessible icon labels.

## Prompt 029 — Theme, Motion, and Interaction Tokens

- **Objective:** Define theme, focus, hover, pressed, disabled, loading, and reduced-motion behavior as reusable contracts.
- **Context:** Polish should come from disciplined feedback and subtle 180–240 ms continuity, not ornamental delay.
- **Requirements:** Add system theme selection, durations, easing, overlays, focus rings, skeletons, progress behavior, and reduced-motion substitutions.
- **Constraints:** Respect OS preferences, avoid flashing/layout shifts, and never use color or animation as the only status signal.
- **Acceptance:** Theme/interaction specimens show every primitive state and transition without unreadable intermediate frames.
- **Verification:** Test keyboard focus, reduced motion, high contrast, rapid theme changes, loading states, and screenshot matrices.

## Prompt 030 — Accessible Component Primitives

- **Objective:** Implement reusable accessible primitives without duplicating interaction logic across extension screens.
- **Context:** Foundations include buttons, links, inputs, selects, switches, tabs, dialogs, tooltips, badges, progress, toasts, and disclosures.
- **Requirements:** Provide typed APIs, semantic HTML, keyboard behavior, focus management, minimal ARIA, loading/error states, and form integration.
- **Constraints:** Prefer small headless foundations, avoid inaccessible custom controls, and stay within the approved extension bundle budget.
- **Acceptance:** Each primitive has documented variants, states, usage guidance, accessibility notes, and stable visual tests.
- **Verification:** Run unit interactions, keyboard review, automated accessibility scans, screen-reader spot checks, and bundle reporting.

## Prompt 031 — Extension Shell Components

- **Objective:** Build reusable page shell, header, navigation, section, footer, and responsive panel components for all extension surfaces.
- **Context:** Popup and workspace should feel unified while adapting density and navigation to available space.
- **Requirements:** Support identity, context, settings, connection/license state, scroll containment, safe areas, sticky actions, and workspace launch.
- **Constraints:** Keep controls reachable without horizontal scrolling and prevent chrome from obscuring validation, progress, or actions.
- **Acceptance:** Shell stories cover target viewports, long content, zoom, localization stress, offline mode, and both themes.
- **Verification:** Use screenshot matrices and keyboard traversal to confirm landmarks, focus visibility, stable layout, and unclipped actions.

## Prompt 032 — File Upload and Selection Components

- **Objective:** Create trustworthy file-selection components for individual files, batches, folders where supported, and optional base code.
- **Context:** Browser paths are constrained and users need feedback before sensitive code leaves the device.
- **Requirements:** Implement drop zone, picker, file rows, local type/size checks, duplicates, removal, sanitized display, totals, and disclosure placement.
- **Constraints:** Do not upload before final review/consent; server validation remains authoritative; do not request broad filesystem permission.
- **Acceptance:** Components distinguish accepted, rejected, duplicate, base, and grouped files with keyboard and screen-reader support.
- **Verification:** Test empty, drop/picker, duplicate/Unicode names, zero-byte, oversized, unsupported, many-file, removal, and consent cases.

## Prompt 033 — Comparison Mode and Group Builder Components

- **Objective:** Design reusable controls for pair, batch, and multi-project grouping without exposing provider protocol complexity.
- **Context:** Individual files and multi-file projects require explicit logical groups; advanced users may also add shared base code.
- **Requirements:** Provide mode cards, group create/rename/reorder, file movement, language selection, summaries, and progressive settings.
- **Constraints:** Prevent ambiguous grouping, mixed-language jobs, empty groups, and accidental splitting of one project into many submissions.
- **Acceptance:** The builder generates the approved domain model for every supported scenario and explains grouping in plain language.
- **Verification:** Test mode switching, preserved inputs, invalid transitions, keyboard reordering, duplicate nested names, and payload previews.

## Prompt 034 — Progress and Result Components

- **Objective:** Create unified feedback for validation, upload, queue, submission, waiting, success, cancellation, timeout, and failure.
- **Context:** The provider may be slow or unavailable; users need honest status, actionable recovery, and a protected result link.
- **Requirements:** Implement phase progress, elapsed context, retry/cancel, error codes, open/copy actions, estimated-availability caveats, and diagnostics IDs.
- **Constraints:** Never fabricate percentages, expose internals, auto-open external reports, or characterize results as proof of plagiarism.
- **Acceptance:** Every job state has concise copy, a safe action, accessible announcement behavior, and consistent visual semantics.
- **Verification:** Drive components from a deterministic state machine and snapshot transitions, reconnects, errors, availability estimates, and keyboard actions.

## Prompt 035 — Design-System Documentation and Audit

- **Objective:** Consolidate the extension design system into a documented, testable contract ready for feature implementation.
- **Context:** Tokens/components must remain coherent across contributors, themes, popup, workspace, settings, and later commercial surfaces.
- **Requirements:** Publish a catalog, recipes, do/don’t guidance, content patterns, accessibility notes, versioning, and visual-regression matrix.
- **Constraints:** Document implemented behavior only, mark experiments, eliminate one-off styling, and resolve critical accessibility/contrast defects.
- **Acceptance:** All approved wireframes can be assembled from documented tokens and components without inventing new primitives.
- **Verification:** Rebuild representative screens, run visual/accessibility suites, inspect bundle budget, and complete a human design-system review.

## Phase C — Submission experience and job pipeline

## Prompt 036 — Implement the Comparison Domain Model

- **Objective:** Implement shared types and schemas for drafts, jobs, groups, files, base files, modes, languages, settings, and results.
- **Context:** Pair checks compare two logical submissions while batch checks compare several submissions that may each contain multiple files.
- **Requirements:** Include stable IDs, display/safe names, sizes, hashes, upload states, ownership, timestamps, invariants, and explicit schema versions.
- **Constraints:** Keep source and full local paths out of persisted metadata; use one compatible schema across extension, API, and worker.
- **Acceptance:** Pair, batch, multi-file project, and base-code fixtures serialize and validate without ambiguous grouping or provider leakage.
- **Verification:** Run typecheck/schema tests for valid fixtures, missing/unknown fields, incompatible versions, and invalid state combinations.

## Prompt 037 — Build the Persistent Upload Workspace

- **Objective:** Create the full-page extension workspace that owns the complete comparison workflow.
- **Context:** Popups close easily, so the popup launches/summarizes work while the workspace owns uploads and configuration.
- **Requirements:** Add free synthetic/local preview through final review, then entitlement gate before job/upload creation, plus stages through result.
- **Constraints:** Never claim ordinary `File` objects survive restart; use approved design, keyboard/reduced-motion support, strict CSP, and bundled code.
- **Acceptance:** Only approved 24-hour fields persist; restart requires reselection/revalidation, and entitled finalized jobs restore by opaque ID.
- **Verification:** Test no-pay local preview, zero pre-entitlement API upload/job, TTL/purge, restart/reselection, migration, keyboard, and popup navigation.

## Prompt 038 — Implement Pair and Batch Mode Selection

- **Objective:** Add an accessible selector for Pair Check and Batch Check.
- **Context:** Pair mode requires exactly two logical groups; batch mode requires at least two and supports approved folders or archives.
- **Requirements:** Explain each mode visually, initialize correct group structures, preserve compatible data, and confirm destructive switches.
- **Constraints:** Do not describe similarity as a verdict or expose raw MOSS directory-mode terminology.
- **Acceptance:** Selecting a mode produces the correct draft and prevents continuation until its group-count rules are satisfied.
- **Verification:** Test empty, populated-compatible, populated-incompatible, canceled-confirmation, keyboard, and screen-reader switching paths.

## Prompt 039 — Integrate Secure File, Folder, and Archive Intake

- **Objective:** Integrate drag/drop and browse flows for individual files, multiple files, folders, and specifically approved archive formats.
- **Context:** Users need a fast path for two files and a scalable path for multi-file student/project submissions.
- **Requirements:** Capture minimal metadata, show selection feedback, support removal/replacement, preserve browser handles only as approved, and warn on duplicates.
- **Constraints:** Request no broad filesystem permission, never execute files, and upload nothing before explicit review and consent.
- **Acceptance:** Supported selections appear reliably with clear source type, counts, sizes, grouping hints, and local-only status.
- **Verification:** Test drop, picker, folder, archive, canceled access, duplicate, empty/inaccessible file, and unsupported archive behavior.

## Prompt 040 — Add Language Selection and Detection

- **Objective:** Provide a searchable programming-language selector with transparent extension-based suggestions.
- **Context:** The provider accepts one language per job and automatic detection can be wrong for extensionless or mixed projects.
- **Requirements:** Map friendly names to configured codes, show suggestion confidence/reasons, require confirmation, and explain splitting mixed-language work.
- **Constraints:** Never silently submit a guessed language; source available languages and aliases from server capabilities, not UI constants.
- **Acceptance:** Every reviewable draft has one explicitly confirmed supported language and mismatches have actionable guidance.
- **Verification:** Test known, ambiguous, uppercase, extensionless, mixed, unsupported files, manual override, and stale-capability cases.

## Prompt 041 — Build Submission Grouping and Preview

- **Objective:** Convert selected files into explicit logical submission groups and provide manual correction tools.
- **Context:** One multi-file project is one submission, while separate student/project folders must remain separate submissions.
- **Requirements:** Suggest groups from top-level folders, treat flat batch files separately by default, and support rename, merge, split, move, and reorder.
- **Constraints:** Preserve stable internal IDs, separate base files, and never expose or trust temporary server paths as group identity.
- **Acceptance:** Preview shows exactly what will be compared, with exactly two groups in pair mode and at least two in batch mode.
- **Verification:** Test flat files, nested folders, two projects, many archives, manual regrouping, collisions, and mode-specific validation.

## Prompt 042 — Add Optional Base-Code Handling

- **Objective:** Create a separate area for instructor-provided skeleton, starter, or shared library code.
- **Context:** Provider base files can suppress expected overlap and reduce false-positive similarity matches.
- **Requirements:** Explain the effect, reuse secure intake, validate language compatibility, and mark base files distinctly through review.
- **Constraints:** Base files never count as comparison groups and never silently become regular submissions.
- **Acceptance:** Users add, inspect, replace, and remove one or many base files without changing submission-group identities.
- **Verification:** Test no-base, one/many base, wrong language, duplicate, name collision, removal, and base-versus-submission cases.

## Prompt 043 — Implement Client-Side Preflight Validation

- **Objective:** Validate the complete draft before upload and present grouped, actionable findings.
- **Context:** Early checks save bandwidth and improve UX, while the backend remains authoritative because client code is bypassable.
- **Requirements:** Check group counts, language, empty/binary/encoding, duplicates, count, size, names, archive metadata, and stale limits.
- **Constraints:** Read only what validation/hashing requires, use server-provided limits, and distinguish warnings from blocking errors.
- **Acceptance:** Invalid drafts cannot proceed; warnings require visible acknowledgement and reset after material changes.
- **Verification:** Unit-test every rule, combined failures, exact boundaries, Unicode/control names, duplicate hashes, and capability-version mismatch.

## Prompt 044 — Add Safe Comparison Settings

- **Objective:** Provide safe defaults plus an optional advanced settings panel.
- **Context:** Most users need one-click defaults while instructors may adjust result count, common-match threshold, and a report label.
- **Requirements:** Add bounded controls, explanations, reset behavior, capability-based availability, and deterministic request serialization.
- **Constraints:** Derive directory mode from grouping, disable experimental mode, sanitize labels, and accept no free-form protocol command.
- **Acceptance:** Defaults work untouched and advanced values remain within approved provider and product ranges.
- **Verification:** Test defaults, min/max, out-of-range/text/control input, reset, persistence, version changes, and serialization snapshots.

## Prompt 045 — Create Review, Consent, and Confirmation

- **Objective:** Build the final review screen summarizing exactly what will leave the device.
- **Context:** Source reaches product infrastructure and an external provider while result URLs can grant access to submitted code.
- **Requirements:** Show title, groups, file counts/names, language, base code, settings, bytes, numeric allowance, retention, transport, and Prompt 8 consent.
- **Constraints:** Use similarity terminology, no provider affiliation claim, no pre-checked consent, and no upload before confirmation.
- **Acceptance:** Submission is disabled until blockers are resolved and required versioned consent is explicitly recorded.
- **Verification:** Test consent reset after material changes, reading/focus order, summary accuracy, quota copy, and submit gating.

## Prompt 046 — Specify the Versioned Job and Account API

- **Objective:** Define OpenAPI and generated types for auth, account data rights, jobs, uploads, validation, status, cancel, forget, and results.
- **Context:** Extension, API, intake, and submission workers need one authoritative contract before feature/backend implementation.
- **Requirements:** Include auth/logout-all, device list, export/delete status, idempotency, ownership, title, consent, pagination, versions, and safe errors.
- **Constraints:** Never return object paths, plaintext credentials, bearer URLs in lists, or raw internal/provider errors.
- **Acceptance:** Pair, batch, upload/validation, cancellation, allowance, result availability, account export/deletion, and failure states need no hidden fields.
- **Verification:** Validate OpenAPI, generate clients, run positive/negative fixtures, and reject undocumented or incompatible payloads.

## Prompt 047 — Implement Job Persistence and State Transitions

- **Objective:** Create database migrations, repositories, and a guarded job/cancellation state machine.
- **Context:** Jobs must survive view restarts, deploys, intake/provider queues, worker crashes, and upstream uncertainty.
- **Requirements:** Support draft, uploading, uploaded, validating, queued, submitting, awaiting-report, succeeded, failed, cancel-requested, and canceled.
- **Constraints:** Keep expected report availability separate from job state; enforce ownership, immutable manifests, guarded transitions, and transactions.
- **Acceptance:** Invalid/late cancellation is explicit, terminal jobs never reprocess, and concurrent updates cannot corrupt or duplicate work.
- **Verification:** Test migrations, transition table/races, rollback, cancel-before/after-query, quota state, availability metadata, and tenant isolation.

## Prompt 048 — Implement Authentication, Sessions, and Authorization Boundary

- **Objective:** Implement email magic-link sign-in, sessions, device binding, ownership authorization, and a pluggable entitlement interface.
- **Context:** Job/upload APIs need real identity before payment integration, while billing entitlements connect in Prompt 079.
- **Requirements:** Use single-use 10-minute device-bound email nonce/code, 15-minute access tokens, rotating 30-day refresh reuse detection, logout-all, and recovery.
- **Constraints:** Purchase IDs are never authentication; use no PKCE unless a future authorization-code flow requires it; store refresh material local, never sync.
- **Acceptance:** Protected routes enforce user/device/job ownership and production cannot start with fake entitlements or reusable magic-link proof.
- **Verification:** Test nonce/expiry/replay/device binding, refresh rotation/reuse, logout-all, profile reset, compromised email, CSRF/origins, IDOR, and prod guard.

## Prompt 049 — Create Temporary Upload Sessions

- **Objective:** Issue short-lived, tenant/job-bound upload sessions using private encrypted object storage.
- **Context:** Authenticated source uploads should avoid API memory and remain available only for validation/submission.
- **Requirements:** Generate opaque keys, exact count/size/type/checksum constraints, expiry, optional multipart, completion records, and deletion tags.
- **Constraints:** Use an exact API/upload origin; disable public access/client keys, require Prompt 048 ownership, and add a short lifecycle backstop.
- **Acceptance:** Only the owner uploads expected objects; expired, oversized, replayed, cross-tenant, or altered uploads cannot complete.
- **Verification:** Test auth/ownership, origin/CORS/permission, wrong key/size/hash/type, replay, expiry, multipart failure, isolation, and lifecycle.

## Prompt 050 — Implement the Upload Transfer Manager

- **Objective:** Integrate generated contracts to upload reviewed files with bounded concurrency, progress, cancellation, integrity, and recovery.
- **Context:** Batch uploads must survive transient failures and view closure without pretending local `File` objects survive browser restart.
- **Requirements:** After final review and entitlement, create a titled job, upload opaque objects, track progress, verify hashes, and support reselection resume.
- **Constraints:** Never put source in logs/sync storage; after restart require reselection unless upload completed; do not conflate cancel with forget.
- **Acceptance:** Network interruption resumes safely without duplicate jobs and cancellation cleans active objects while preserving honest state.
- **Verification:** Simulate slow/drop network, expired URL, page/restart, changed reselection, hash mismatch, cancel race, and retry.

## Prompt 051 — Harden Server-Side File and Archive Ingestion

- **Objective:** Build authoritative isolated intake that produces an immutable sanitized manifest before provider queuing.
- **Context:** Client checks are untrusted and archives can contain traversal, links, nested bombs, binaries, or deceptive extensions.
- **Requirements:** Normalize paths, cap expanded bytes/depth/ratio/count, reject links/controls/binaries, normalize encoding, and map safe groups.
- **Constraints:** Extract only in sandboxed temporary space, never execute content, reject nested archives by policy, and fail closed.
- **Acceptance:** Valid projects yield deterministic manifests while malicious/uncertain input returns a safe code and is deleted.
- **Verification:** Test traversal, drive/absolute paths, bombs, symlinks, Unicode collision, MIME mismatch, UTF-16, binary, and valid ZIPs.

## Prompt 052 — Finalize Uploads and Enqueue Validation Idempotently

- **Objective:** Convert completed objects into exactly one intake-validation task and later one provider-queue event.
- **Context:** Double clicks, retries, and queue/database failures must not duplicate validation or provider submissions.
- **Requirements:** Recheck identity, entitlement boundary, objects, hashes, groups, language, settings, consent, then use transactional outboxes for both stages.
- **Constraints:** Reserve numeric/provider quota only after intake succeeds; consume it when the provider query is sent and release it on earlier terminal paths.
- **Acceptance:** Identical repeats return one job, changed payload conflicts, and database/queue state converges without duplicate work.
- **Verification:** Test concurrent duplicates, queue outage, rollback, stale consent, changed object/key reuse, quota reserve/consume/release, and cancel.

## Prompt 053 — Build Intake and Fair Provider Queues

- **Objective:** Implement durable intake scheduling and fair provider scheduling across users and approved credentials.
- **Context:** Validation must precede provider quota, while upstream concurrency and numeric allowances require controlled fair execution.
- **Requirements:** Add separate queues, tenant fairness, per-credential caps, leases/heartbeats, dead letters, circuit breaker, and honest estimates.
- **Constraints:** Never retry uncertain queries, assume quota reset timezone, bypass numeric allowance, or route through alternate identities automatically.
- **Acceptance:** Jobs survive restarts, noisy users cannot starve others, and no credential or entitlement exceeds approved capacity.
- **Verification:** Load-test fairness, worker loss, leases, dead letters, unknown reset boundary, duplicate messages, cancellation, and circuit breaker.

## Prompt 054 — Define the Stream-Based Provider Adapter

- **Objective:** Replace the stateful local-path client with a typed, immutable, single-job provider interface.
- **Context:** Mutable arrays and filesystem paths complicate isolation, concurrency, testing, and replacement after commercial changes.
- **Requirements:** Accept validated metadata/streams, expose capabilities/configuration, return typed bearer-result metadata, and support dependency injection.
- **Constraints:** Keep instances single-use, avoid globals, and separate provider transport from storage, queues, product, and UI.
- **Acceptance:** Workers can use mock, disabled, commercial MOSS, or approved alternative implementations through one conformance contract.
- **Verification:** Test in-memory streams, concurrent instances, invalid config, cancellation, capability differences, and cleanup.

## Prompt 055 — Build the Mock MOSS Protocol Server

- **Objective:** Create a deterministic local TCP server for adapter and worker integration tests.
- **Context:** CI must not consume live quota, expose code, use credentials, or depend on third-party availability.
- **Requirements:** Script valid sessions, chunks, rejection, delay, reset, malformed URLs, backpressure, ambiguity, and captured transcripts.
- **Constraints:** Bind loopback/ephemeral only, use synthetic IDs/code, guarantee teardown, and block external MOSS network access.
- **Acceptance:** All protocol/worker scenarios run offline through reusable versioned fixtures with deterministic control.
- **Verification:** Run repeatedly/in parallel with randomized chunks/timing, assert teardown/transcripts, and prove zero external connection.

## Prompt 056 — Implement Robust Protocol Line Parsing

- **Objective:** Build a bounded parser for fragmented, combined, delayed, malformed, and prematurely closed responses.
- **Context:** The current one-shot data listener can hang when one response line arrives across several TCP chunks.
- **Requirements:** Buffer to newline, preserve surplus bytes, cap length/buffer, decode predictably, resolve one waiter, and reject close/error.
- **Constraints:** Never equate one event with one response and never wait without deadline or abort.
- **Acceptance:** Each command receives its intended response regardless of packet boundaries or adjacent lines.
- **Verification:** Test one-byte chunks, multi-line chunks, CRLF/LF, missing newline, oversize, invalid encoding, close, delay, and abort.

## Prompt 057 — Sanitize Protocol Names and Build the Manifest

- **Objective:** Produce collision-safe virtual filenames that preserve grouping without leaking paths or enabling command injection.
- **Context:** The line protocol receives filenames, and the current client only replaces spaces in full local paths.
- **Requirements:** Reject controls, normalize Unicode/separators, bound length, create stable group roots, resolve collisions, and separate display mapping.
- **Constraints:** Never transmit drive letters, usernames, absolute paths, controls, storage keys, or raw archive entries.
- **Acceptance:** Every accepted file has one unique safe provider name and maps to a group through non-sensitive metadata.
- **Verification:** Test controls, Unicode equivalents, reserved/long names, duplicate basenames, nesting, normalization collision, and determinism.

## Prompt 058 — Harden Socket Transport and Lifecycle

- **Objective:** Implement safe provider connection management with strict lifecycle guarantees.
- **Context:** The official public Perl client uses raw TCP without TLS; a commercial encrypted endpoint remains a Prompt 5 requirement.
- **Requirements:** Enforce approved endpoint/transport, connect/read/write/overall deadlines, abort, drain/backpressure, cleanup, and termination.
- **Constraints:** Allow no user host/port; production blocks unencrypted student/confidential traffic and never writes to a destroyed socket.
- **Acceptance:** Every connection resolves/fails within bounds and releases timers, listeners, buffers, streams, and sockets exactly once.
- **Verification:** Simulate DNS/refusal, TLS/transport mismatch, slow/blocked IO, reset, half-close, abort, each timeout, and partial cleanup.

## Prompt 059 — Map Product Jobs to Provider Commands

- **Objective:** Translate validated pair and batch manifests into the exact authorized provider sequence.
- **Context:** Grouping, base code, language, match threshold, result count, and report title must map consistently.
- **Requirements:** Send auth, grouping, limits, language, base files, ordered groups/files, query, and termination with deterministic IDs/bytes.
- **Constraints:** Disable experiments, validate every field, and accept no free-form command input.
- **Acceptance:** Pair, flat batch, projects, and base-code fixtures emit reproducible transcripts.
- **Verification:** Snapshot order, IDs, groups, exact bytes, safe names, language rejection, controls, and empty-group prevention.

## Prompt 060 — Add Typed Upstream Failures and Safe Retry Rules

- **Objective:** Convert transport/provider outcomes into stable phase-aware product errors and quota actions.
- **Context:** A failure before connect differs from one after a provider query may already have consumed a submission.
- **Requirements:** Track confirmed phase and classify credential, language, quota, overload, timeout, uncertain query, invalid URL, and generic failure.
- **Constraints:** Retry automatically only before any upstream side effect; require deliberate resubmit after ambiguity and never infer quota reset timing.
- **Acceptance:** Every error has a safe action/terminal explanation and correct reserve/consume/release behavior without internal leakage.
- **Verification:** Test every phase boundary, retry eligibility, duplication, error redaction, URL allowlist, quota action, and ambiguity.

## Prompt 061 — Implement Sandboxed Intake and Submission Workers

- **Objective:** Implement isolated worker lifecycles for validation and approved provider submission using the completed adapter.
- **Context:** Source processing is high risk and must remain separate from public APIs with different egress privileges by stage.
- **Requirements:** Run non-root with restricted files/network/resources, enforce deadlines/cancel, emit redacted stages, and always clean artifacts.
- **Constraints:** Intake has no provider credential/egress; submission accepts immutable manifests only and never executes source.
- **Acceptance:** Success stores permitted bearer-result metadata; failure/cancel/crash leaves no source beyond the documented backstop.
- **Verification:** Test both workers under kill/restart, disk/memory pressure, timeout, late cancel, cleanup failure, egress denial, and redaction.

## Prompt 062 — Implement Source Retention and Deletion Controls

- **Objective:** Enforce minimization from upload creation through terminal processing, policy retention, and user-requested deletion.
- **Context:** Source is sensitive and successful processing provides no reason to retain temporary product-side copies.
- **Requirements:** Delete objects/temp files after terminal processing, keep approved metadata only, and add lifecycle, orphan, retry, and reconciliation jobs.
- **Constraints:** Keep source out of backups, analytics, traces, queues, dead-letter payloads, and support; document provider retention separately.
- **Acceptance:** Each job has auditable deletion status/timestamps and anything beyond the configured backstop triggers removal and alerting.
- **Verification:** Test success, failure, cancellation, worker crash, storage outage, lifecycle fallback, user deletion, backups, and orphan repair.

## Prompt 063 — Secure Provider Credential Management

- **Objective:** Store each approved provider identity in an isolated encrypted credential vault.
- **Context:** A numeric MOSS ID controls quota and can be abused even though it is not a conventional password.
- **Requirements:** Use envelope encryption, tenant binding, masked display, replace/delete, access audits, versioned keys, and per-job references.
- **Constraints:** Never embed IDs in extension builds, expose plaintext via APIs, log them, sync them through browser storage, or rotate identities for limits.
- **Acceptance:** Only an authorized submission worker can decrypt the owning tenant’s credential for a valid leased job.
- **Verification:** Test cross-tenant denial, key rotation, revoked/deleted IDs, audit redaction, worker identity, and encrypted backup/restore.

## Prompt 064 — Harden Extension and API Security Boundaries

- **Objective:** Apply defense in depth across extension, API, storage, queue, database, worker, payment, and provider integration.
- **Context:** Uploaded code, paid entitlements, credentials, and bearer report URLs are high-value targets.
- **Requirements:** Enforce CSP, exact API/dedicated-upload permissions, authenticated CORS, request caps, rate limits, egress, supply chain, and redacted telemetry.
- **Constraints:** Request no history/all-sites/page-content permissions and send no filenames, code, credentials, or report URLs to analytics.
- **Acceptance:** Every approved threat mitigation is implemented or has documented non-launch risk acceptance; no unnecessary permission remains.
- **Verification:** Run permission/CSP review, SAST/dependency scans, API abuse/IDOR tests, log canaries, and egress-policy tests.

## Phase D — Status, results, history, and end-to-end readiness

## Prompt 065 — Implement Durable Job Status and Polling

- **Objective:** Keep users accurately informed across view closure, service-worker suspension, browser restart, and temporary offline periods.
- **Context:** Backend job state is authoritative because MV3 workers and popups are not long-lived.
- **Requirements:** Poll with bounded backoff, restore job IDs, show upload/validation/provider stages, rotate auth, request cancel, and optionally notify completion.
- **Constraints:** Put no URL/name in notifications, stop terminal/forgotten/unauthorized polling, and never claim late cancellation stopped an accepted query.
- **Acceptance:** Popup/workspace agree on uploading, validating, queued, submitting, waiting, succeeded, failed, cancel-requested, and canceled.
- **Verification:** Test suspension, restart, offline/auth recovery, cancel before/after query, notification privacy, and terminal polling shutdown.

## Prompt 066 — Persist and Expose Result Metadata Safely

- **Objective:** Store successful report metadata and provide owner-scoped result/history endpoints.
- **Context:** The provider report URL is a bearer secret that may expose submitted code to anyone receiving it.
- **Requirements:** Encrypt URLs, validate scheme/host/path, estimate availability, implement URL-only forget and terminal history deletion, and return minimal projections.
- **Constraints:** Do not crawl, mirror, parse, preview, index, log, or send the report to third parties in this phase.
- **Acceptance:** URL forget retains minimal history; history delete requires terminal cleanup; neither claims provider/browser/clipboard revocation.
- **Verification:** Test encryption/URL validation/IDOR, URL-only forget, active-delete conflict, terminal delete, estimate, entitlement, and audits.

## Prompt 067 — Build the Result Experience

- **Objective:** Create a clear completion screen centered on opening and protecting the provider-hosted similarity report.
- **Context:** Reports support human review, are not plagiarism verdicts, and may disappear before or after the displayed availability estimate.
- **Requirements:** Show time, language, mode, estimated availability, open, copy, rerun, forget, bearer-link/browser-history/clipboard warnings, and review guidance.
- **Constraints:** Do not invent percentages, guarantee availability, imply misconduct, auto-open, call the link private, or imply forget revokes provider copies.
- **Acceptance:** Users can deliberately open/copy the correct bearer link and understand its confidentiality, estimated availability, and interpretation limits.
- **Verification:** Test open/copy, `noreferrer` where applicable, keyboard/screen reader, past estimate, forgotten record, blocked action, and warnings.

## Prompt 068 — Add Owner-Scoped Result History

- **Objective:** Provide a searchable recent-job history without retaining source or unnecessary personal data.
- **Context:** Users need to revisit reports and failures even though provider links may disappear before or after the displayed estimate.
- **Requirements:** Show title, mode, language, date, state, estimate, and distinct “forget link” versus terminal “delete history” actions.
- **Constraints:** Exclude original paths, sensitive filenames, source previews, plaintext URLs in lists, and browser-sync persistence.
- **Acceptance:** Forgotten-link entries retain minimal history; deleted history disappears; active deletion blocks; rerun restores empty structure/settings only.
- **Verification:** Test pagination/filters, forget vs delete, active conflict, estimate, mandatory reselection, purge, and tenant isolation.

## Prompt 069 — Create Actionable Error and Recovery UX

- **Objective:** Map validation, upload, auth, license, quota, worker, provider, and result failures to clear recovery paths.
- **Context:** Generic socket/server errors are unusable and can encourage unsafe repeated submissions that consume quota.
- **Requirements:** Provide concise copy, retry eligibility, correlation ID, reconnect/settings/support actions, and explicit uncertain-submission handling.
- **Constraints:** Never expose stack traces, credentials, object keys, raw responses, URLs, or blame users for third-party outages.
- **Acceptance:** Every typed error has accessible UI copy and either one safe action or an honest terminal explanation.
- **Verification:** Snapshot all errors and test focus, live announcements, retry gating, offline recovery, unknown fallback, and support copy.

## Prompt 070 — Verify the Submission Pipeline with Test Entitlements

- **Objective:** Establish a pre-commerce E2E gate for upload, intake, provider processing, results, history, recovery, abuse, and cleanup.
- **Context:** Real payments/policies arrive later, so this gate uses the production auth boundary with synthetic non-production entitlements.
- **Requirements:** Cover pair, batch, projects, base code, auth/quota, protocol failures, URL-only forget, terminal-history delete, and cleanup.
- **Constraints:** Use synthetic fixtures and the mock server only in CI; never include live accounts or real student/customer code.
- **Acceptance:** Submission-pipeline journeys pass on supported Chrome with no high-severity security, accessibility, privacy, or retention defect.
- **Verification:** Run packaged-extension E2E, accessibility, load, IDOR, deletion, permission, CSP, and redacted-log audits; publish evidence.

## Phase E — Commerce, policy, and customer access

## Prompt 071 — Reconfirm Commercial and Encrypted-Transport Gates

- **Objective:** Reconfirm Prompt 5 before any live environment or paid provider feature is enabled.
- **Context:** Scope, volume, architecture, terms, or endpoint security may have changed during implementation.
- **Requirements:** Revalidate paid automation, account model, 100-submission rule, reset/consumption event, data, TLS upload/report, SLA, brand, and termination.
- **Constraints:** Production stays off when rights or encrypted transport are absent/ambiguous; BYO, pooling, and rotation are not workarounds.
- **Acceptance:** Current evidence and every restriction are encoded in configuration, copy, monitoring, kill switches, owners, and review dates.
- **Verification:** Product, legal/privacy, security, and operations sign the enable checklist and drill stop/pivot/kill behavior.

## Prompt 072 — Finalize Provider Capacity Configuration

- **Objective:** Convert approved provider terms into enforceable limits and an operational capacity plan.
- **Context:** Public MOSS enforces 100 submissions per day per user; no SLA was found in reviewed public materials, which warn of overload.
- **Requirements:** Set consumption/reset semantics, credential quota, concurrency, file/group/byte bounds, timeouts, maintenance, escalation, and forecasts.
- **Constraints:** Never invent reset timezone or promise greater availability, retention, capacity, or support than written terms provide.
- **Acceptance:** Versioned capabilities match evidence and cover launch peak, outage, exhaustion, growth, contract change, and termination.
- **Verification:** Reconcile every value with agreement/source evidence and stress conservative high-use and provider-outage scenarios.

## Prompt 073 — Revalidate the Exact $15 Customer Promise

- **Objective:** Revalidate Prompt 6’s numeric offer using implemented cost and load evidence before commerce work.
- **Context:** Provider quotes and implementation benchmarks may differ from discovery; Prompt 095 performs the final deployed load/cost validation.
- **Requirements:** Finalize allowance/renewal, two devices, v1 update/support term, refund window, shutdown remedy, limits, margin, and sensitivity.
- **Constraints:** No vague fair use, hidden throttle, unlimited lifetime hosting, account evasion, or dependence on unavailable beta data.
- **Acceptance:** One approved versioned offer drives capability config, quota rules, terms, checkout copy, support, and financial reserve.
- **Verification:** Product/finance reconcile quotes and benchmark-based cost models, approve worst-case viability, and require Prompt 095 revalidation before launch.

## Prompt 074 — Implement Provider Onboarding, Fallback, and Kill Switches

- **Objective:** Build only the approved credential flow and make provider availability controllable without an emergency client release.
- **Context:** Terms may permit managed or customer numeric IDs, while outage/termination may require a disabled or alternative adapter.
- **Requirements:** Add masked connect/replace/delete, capabilities, disabled mode, maintenance copy, kill switch, adapter selection, and stale-client handling.
- **Constraints:** No automated registration/password request/shared rotation or silent processor switch; material provider changes require new disclosure/consent.
- **Acceptance:** Onboarding matches the approved model and operations can stop new work while preserving drafts, cleanup, existing links, and support.
- **Verification:** Test validation/encryption/IDOR, replacement/deletion, disable/re-enable, adapter change, stale client, consent version, and in-flight jobs.

## Prompt 075 — Select Payment and Merchant Architecture

- **Objective:** Select a payment or merchant-of-record solution for the finalized one-time offer.
- **Context:** Hosted checkout needs tax, receipts, refunds, disputes, signed webhooks, reliable events, and global data handling.
- **Requirements:** Compare regions/currencies, VAT/sales tax, fees, fraud, payouts, refunds, privacy, APIs, webhooks, support, and migration.
- **Constraints:** Verify current store/processor rules from primary sources, minimize PCI scope, and keep payment SDKs out of extension code.
- **Acceptance:** An ADR records provider, alternatives, cost/data flow, failures, compliance owner, sandbox plan, and exit strategy.
- **Verification:** Legal/privacy, finance, security, and engineering approve and validate every required sandbox event/API.

## Prompt 076 — Publish Terms of Service and EULA

- **Objective:** Publish contractual terms before checkout implementation.
- **Context:** Similarity is not a verdict; report URLs are bearer links, availability is estimated, and the service depends on third parties.
- **Requirements:** Cover license/version/devices, numeric allowance, acceptable use, ownership, third parties, disclaimers, refunds, support, suspension, and shutdown.
- **Constraints:** Do not guarantee provider accuracy, uptime, confidentiality, revocation/deletion of provider/browser copies, or permanent reports.
- **Acceptance:** Versioned terms are accessible before purchase/submission and accepted with timestamp/version evidence where required.
- **Verification:** Legal review reconciles terms with Prompt 73, provider contract, privacy, store, marketing, product, and support behavior.

## Prompt 077 — Publish Privacy Policy and Data Inventory

- **Objective:** Publish a truthful privacy policy from the implemented end-to-end data map before checkout.
- **Context:** Source, account/payment metadata, provider IDs, bearer URLs, IP/diagnostics, sessions, and support data may be processed.
- **Requirements:** Document purpose/basis, recipients, transfers, retention, safeguards, choices, rights, minors policy, subprocessors, and contacts.
- **Constraints:** Do not claim local-only, private reports, provider deletion, or end-to-end encryption unless runtime and agreement prove it.
- **Acceptance:** A versioned policy and maintained machine-readable inventory/subprocessor list have owners and change notice.
- **Verification:** Trace staging fields/events through all components and reconcile policy with retention, account rights, terms, and store disclosure.

## Prompt 078 — Finalize Versioned Consent and Data-Rights Copy

- **Objective:** Finalize the consent implemented from Prompt 8/45 and all account export/deletion explanations before purchase/upload.
- **Context:** Adults must understand backend/provider processing, bearer links, browser/clipboard copies, transport, authority, and legal-retention exceptions.
- **Requirements:** Add concise layered copy, policy/terms links, versioning, reset triggers, 18+ self-serve eligibility, and data-rights instructions.
- **Constraints:** Consent is unselected and cannot waive product duties; institutional/minor datasets remain outside the personal MVP.
- **Acceptance:** Copy is accessible, localized-ready, consistent across preview/checkout/review/settings, and auditable without storing source.
- **Verification:** Usability participants explain data flow/access; tests cover gating, reset, eligibility, version migration, and evidence.

## Prompt 079 — Implement Webhooks, Entitlements, and License Tokens

- **Objective:** Connect the Prompt 48 entitlement interface to tamper-resistant server-owned commercial state.
- **Context:** Inspectable extension code makes local booleans, embedded keys, and universal codes ineffective.
- **Requirements:** Verify signed webhooks/replay, process idempotently, model purchase/refund/dispute/override, and issue scoped short-lived entitlements.
- **Constraints:** Never ship signing/processor secrets; backend endpoints enforce allowance/device/status even when client code is altered.
- **Acceptance:** Entitlement/token transitions, clock skew, revocation, and any explicitly approved offline grace are versioned and auditable.
- **Verification:** Reject forged/altered/replayed/expired/wrong-user tokens and converge duplicate/out-of-order events correctly.

## Prompt 080 — Implement Secure Hosted Checkout

- **Objective:** Build hosted checkout for the exact Prompt 73 offer using published Prompt 76–78 documents.
- **Context:** The user reaches checkout only from final review; no product job or source upload exists before entitlement succeeds.
- **Requirements:** Bind customer/product/price/offer version, display tax/refund/allowance/terms, and handle success, cancel, decline, duplicate, and delay.
- **Constraints:** Trust no client price/entitlement, allowlist return origins, and log no checkout secret or payment detail.
- **Acceptance:** One charge maps to one entitlement, returns to the intact local review, then explicitly starts the first authenticated job/upload.
- **Verification:** Prove zero pre-entitlement job/upload and sandbox success/cancel/decline/duplicate/tamper/expiry/delay/return exactly once.

## Prompt 081 — Implement Purchase Restore and Device Policy

- **Objective:** Let buyers restore access while limiting casual sharing without invasive fingerprinting.
- **Context:** Buyers reinstall, replace devices, clear profiles, lose sessions, or need self-service transfer.
- **Requirements:** Add verified restore, two-device activation, opaque friendly names, deactivate/replace, compromise recovery, and audited support override.
- **Constraints:** Do not fingerprint hardware or permanently lock buyers out after normal changes; respect session-revocation behavior from Prompt 48.
- **Acceptance:** Device/recovery behavior matches the one-time offer, remains understandable, and exposes no reusable license secret.
- **Verification:** Test reinstall, profile reset, second/third device, lost device, transfer, compromised email/session, revoke, and override.

## Prompt 082 — Implement Refunds, Disputes, and Tax Aftercare

- **Objective:** Complete refunds, chargebacks, duplicates, taxes, invoices, and receipts.
- **Context:** Payment exceptions change access and require consistent processor, entitlement, accounting, support, and customer records.
- **Requirements:** Implement the published window, entitlement effects, dispute evidence, tax/receipt delivery, duplicate resolution, and audits.
- **Constraints:** Follow processor/store/consumer rules and keep payment details out of extension telemetry and general support logs.
- **Acceptance:** Decision tables and handlers cover every supported exception with clear messaging and escalation.
- **Verification:** Sandbox refund/reversal/chargeback/duplicate/tax invoice/event replay and idempotent entitlement changes.

## Prompt 083 — Implement Retention and Bearer-Link Policy Surfaces

- **Objective:** Give accurate controls/explanations for source cleanup, metadata, credentials, and provider-hosted bearer links.
- **Context:** MOSS reports are typically removed around 14 days but may disappear sooner; MVP does not probe or revoke them.
- **Requirements:** Show retention/cleanup/estimate, URL-only forget, terminal history delete, provider/browser/clipboard limits, backups, and escalation.
- **Constraints:** Never claim private/active/expired/deleted provider status or put source, IDs, or full URLs in telemetry/email/support/list APIs.
- **Acceptance:** Surfaces distinguish cancel, forget bearer URL, delete terminal history, credential/account deletion, and external copies precisely.
- **Verification:** UI/E2E plus retention tests prove no orphan, false availability/deletion claim, unauthorized recovery, or secret telemetry.

## Prompt 084 — Implement Account Export and Deletion

- **Objective:** Implement owner-scoped account export and verified deletion across all product systems.
- **Context:** Credentials, devices, sessions, jobs, bearer secrets, consents, telemetry IDs, support, and payment records have different rules.
- **Requirements:** Inventory/export eligible data, revoke sessions/devices, forget result URLs, delete terminal histories/credentials, propagate, and track exceptions.
- **Constraints:** Explain legally retained processor/accounting records and external provider/browser copies; never include secrets or other tenants in exports.
- **Acceptance:** Users can request, authenticate, monitor, and receive completion evidence for export/deletion with documented timing.
- **Verification:** Test IDOR/re-auth, full propagation, retention exceptions, backups, retries, canceled deletion, audit redaction, and completion.

## Prompt 085 — Assemble Licensing, Brand, and Compliance Pack

- **Objective:** Assemble every notice/disclosure required for sale, distribution, third-party use, and customer trust.
- **Context:** The product reuses MIT `node-moss` and adds dependencies, payment, hosting, telemetry, and an authorized similarity provider.
- **Requirements:** Preserve notices, inventory licenses, define non-affiliation/trademark use, list subprocessors, accessibility, disclaimers, policies, and owners.
- **Constraints:** Use MOSS/Stanford names/marks only as authorized and keep claims consistent across code, binaries, store, website, checkout, and product.
- **Acceptance:** `THIRD_PARTY_NOTICES.md` and a versioned release-linked compliance pack contain evidence/effective/review dates.
- **Verification:** Run license/SBOM review and audit every public, distributed, legal, support, and transactional surface for consistency.

## Phase F — Production hardening, beta, and launch

## Prompt 086 — Provision Environments, Deployment, Backups, and Disaster Recovery

- **Objective:** Provision reproducible development, staging, and production infrastructure plus tested recovery before beta.
- **Context:** APIs, databases, queues, storage, KMS, workers, uploads, and releases need isolation, safe migrations, rollback, RPO, and RTO.
- **Requirements:** Use IaC, workload identities, network/egress policy, source-excluded backups, restore plans, key recovery, deployment gates, and regional failure design.
- **Constraints:** Source objects never enter backups; environments/keys/data are isolated; restore must not resurrect forgotten secrets or revoked sessions.
- **Acceptance:** Reviewed IaC creates each environment and documented RPO/RTO, migration, rollback, queue recovery, and backup policies meet Prompt 12.
- **Verification:** Rebuild staging and drill database restore, queue reconstruction, key recovery, failed migration, backend rollback, and dependency/region loss.

## Prompt 087 — Refresh the Security Threat Model

- **Objective:** Reassess threats against the implemented extension, services, commerce, provider, infrastructure, operations, and supply chain.
- **Context:** Actual code and deployment introduce boundaries and abuse paths absent from initial design.
- **Requirements:** Update assets, actors, diagrams, misuse cases, likelihood/impact, controls/detection, owners, deadlines, and residual risk.
- **Constraints:** Include files, pages/devices, messages, IDOR, replay, SSRF, insiders, CI, dependencies, restore, fraud, and provider abuse.
- **Acceptance:** Critical/high findings are fixed before beta or explicitly marked no-launch; all lower risks have owners/dates.
- **Verification:** Cross-functional review maps every high risk to code/config/tests/alerts and reruns the model after remediation.

## Prompt 088 — Harden Secrets, Keys, and Privileged Access

- **Objective:** Protect provider, payment, signing, KMS, database, storage, deployment, and observability credentials end to end.
- **Context:** Client packages are observable and overprivileged backend/operator access can expose every tenant.
- **Requirements:** Use managed secrets, least privilege, workload identity, environment separation, rotation, audit, approvals, and break glass.
- **Constraints:** No secret in repository, client, CI output, screenshot, fixture, support tool, dump, or long-lived developer machine.
- **Acceptance:** Every secret/role has owner, consumer, scope, rotation/revocation, incident step, and access-review evidence.
- **Verification:** Run scans/build inspection, access review, canaries, key/credential rotation, offboarding, and break-glass drills.

## Prompt 089 — Complete Hostile-Input, Authentication, and Abuse Testing

- **Objective:** Prove resistance to malicious files, unauthorized jobs, entitlement theft, IDOR, replay, denial of service, fraud, and quota attack.
- **Context:** Untrusted archives and paid endpoints can exhaust browsers, parsers, workers, storage, provider capacity, or other users’ data.
- **Requirements:** Test hostile path/encoding/archive corpus plus auth, devices, ownership, idempotency, limits, CSRF/origins, sessions, and webhooks.
- **Constraints:** Fixtures stay synthetic/non-executable; controls never route through alternate accounts or expose sensitive error differences.
- **Acceptance:** Attacks return stable redacted errors, preserve isolation/health, delete artifacts, emit safe signals, and allow legitimate recovery.
- **Verification:** Run corpus/fuzz/resource, burst/distributed, token theft, confused deputy, IDOR/race, enumeration, webhook, and quota suites.

## Prompt 090 — Audit Automated Test Coverage and Mutation Strength

- **Objective:** Confirm tests detect failures in every business-, security-, privacy-, deletion-, and recovery-critical path.
- **Context:** Upload, commerce, auth, provider, browser lifecycle, data rights, backups, and bearer-secret regressions affect paying users.
- **Requirements:** Map risks/requirements to unit, component, contract, integration, migration, protocol, E2E, accessibility, security, and DR tests.
- **Constraints:** CI stays independent of live provider traffic/real data; line coverage alone is not quality evidence.
- **Acceptance:** Risk thresholds, mutation goals, flaky budget, owners, and required PR/release suites are approved.
- **Verification:** Seed representative defects/mutations and prove the expected layer catches each quickly and reproducibly.

## Prompt 091 — Finalize Provider Conformance Tests

- **Objective:** Test every approved provider behavior deterministically without live quota or confidential data.
- **Context:** Providers may reject, delay, disconnect, exhaust quota, or return malformed, unavailable, or unencrypted links.
- **Requirements:** Version success, chunk, delay, overload, credential/language/quota rejection, malformed URL, ambiguity, and estimate fixtures.
- **Constraints:** Use synthetic code/IDs; keep any authorized real response sanitized and outside ordinary history.
- **Acceptance:** Each adapter passes one suite and deviations appear in capabilities, security gates, and user behavior.
- **Verification:** Randomize mock scenarios and ensure response/protocol changes fail clearly until deliberately reviewed and versioned.

## Prompt 092 — Implement Privacy-Safe Observability

- **Objective:** Diagnose production without collecting source, credentials, bearer links, or unnecessary identity.
- **Context:** Support needs end-to-end success/time, stage latency, provider attribution, deletion, commerce, versions, and cost correlation.
- **Requirements:** Add event codes, metrics, traces, sampling, retention, redaction, dashboards, and opaque request/job IDs.
- **Constraints:** Exclude source, paths/names where unnecessary, provider IDs, tokens, payment details, and full report URLs everywhere.
- **Acceptance:** Dashboards show user/report SLIs, queue/quota, deletion lag, provider/product failures, commerce, cost/job, and release health.
- **Verification:** Inject canaries through success/failure/support and prove none reach logs, traces, metrics, alerts, crashes, or analytics.

## Prompt 093 — Implement Alerting and Incident Response

- **Objective:** Detect and contain outages, deletion/restore failures, data exposure, secret leaks, quota exhaustion, and commerce failures.
- **Context:** Product and third-party incidents can block buyers or expose code and bearer links.
- **Requirements:** Define alerts, severity, ownership, escalation, runbooks, status/communications, evidence, regulatory assessment, and postmortems.
- **Constraints:** Alerts are actionable, deduplicated, privacy-safe, environment-aware, and tested without real-user contact or secret leakage.
- **Acceptance:** Cover provider/transport, invalid URLs, deletion/backup, credential, queue/API/storage/database, webhook, auth, and regional failures.
- **Verification:** Technical drills/tabletops demonstrate detect, triage, contain, communicate, recover, preserve evidence, and follow up.

## Prompt 094 — Complete Browser, Accessibility, and Commercial End-to-End QA

- **Objective:** Verify the complete paid journey across supported Chrome, viewports, zoom, input methods, themes, and failure states.
- **Context:** Prior E2E used test entitlements; this gate includes checkout, restore, policies, consent, data rights, support, and real release packaging.
- **Requirements:** Test install/update, preview/pay/restore, submit/recovery, bearer actions, URL forget/history delete, account rights, settings, and uninstall.
- **Constraints:** Meet WCAG 2.2 AA-oriented keyboard, focus, contrast, motion, zoom/reflow, status, and screen-reader requirements.
- **Acceptance:** Publish Chrome/accessibility matrices and resolve every release-blocking functional, commercial, or accessibility defect.
- **Verification:** Packaged E2E plus manual keyboard/screen-reader/high-contrast/200%-zoom and sandbox-commerce journeys pass.

## Prompt 095 — Complete Performance, Resilience, and Recovery Testing

- **Objective:** Keep client/service responsive and recoverable under supported load, deploys, failures, and restore events.
- **Context:** Multi-file jobs consume browser, bandwidth, storage, queues, workers, provider connections, and operational recovery capacity.
- **Requirements:** Benchmark intake/upload/queues/workers/status/cleanup/concurrency and drill crashes, outages, deploys, backup restore, keys, and region loss.
- **Constraints:** Bound resources/retries, never retry uncertain queries or exceed approved capacity, and never restore source or forgotten secrets.
- **Acceptance:** User SLIs, latency/memory, queue, error, deletion, cost, RPO, and RTO meet Prompt 12/73 gates.
- **Verification:** Run load/spike/soak/chaos, rolling deploy, circuit breaker, restore/failover, and recovery with zero duplicate provider query.

## Prompt 096 — Independent Security and Privacy Assessment

- **Objective:** Perform an independent release-blocking assessment after operational controls are implemented.
- **Context:** The product handles authorized code, commerce, sessions, provider credentials, backups, and bearer report links.
- **Requirements:** Review permissions/CSP/messages, auth/API, uploads/workers, storage/DR, commerce, supply chain, operations, data rights, and leakage.
- **Constraints:** Critical/high findings block beta/launch; exceptions require owner, rationale, expiry, and appropriate executive/legal approval.
- **Acceptance:** Deliver findings/evidence/severity, remediation references, retests, and signed residual-risk decisions.
- **Verification:** Dependency/SAST/DAST/manual abuse/privacy/DR checks pass and every remediation is independently retested.

## Prompt 097 — Prepare Beta Support and Run a Controlled Authorized Beta

- **Objective:** Establish minimum support/runbooks, then validate UX, reliability, deletion, economics, and support with invited adults.
- **Context:** Real authorized workflows reveal grouping, language, browser, network, expectation, and support issues missed by mocks.
- **Requirements:** Create beta help/escalation, define eligibility/consent/capacity/allowed data/metrics/incidents/stop criteria, and collect structured feedback.
- **Constraints:** Use commercial/encrypted provider access; exclude minors, institutional records, and sensitive third-party code under personal beta terms.
- **Acceptance:** Participants receive bearer/provider/privacy, numeric allowance, support/refund, deletion, diagnostics, and uninstall guidance.
- **Verification:** Report funnels, incidents, deletion, end-to-end SLIs, cost/job, support load, accessibility, and go/fix/stop recommendation.

## Prompt 098 — Prepare Store Submission and Release Pipeline

- **Objective:** Produce a policy-compliant Chrome Web Store release with reproducible build, staged rollout, and rollback.
- **Context:** Review checks permissions, remote code, privacy, payments, claims, data practice, and reviewer access.
- **Requirements:** Finalize listing/assets/disclosures/instructions, signed build/provenance, compatibility, rollout gates, monitoring, and rollback.
- **Constraints:** Recheck current official store policy; ship no remote executable code and request no unjustified host/browser permission.
- **Acceptance:** Checksummed artifact, SBOM/notices, reviewer guide, release notes, rollback package, and staged percentages are approved.
- **Verification:** Clean-profile install/update/uninstall, policy review, artifact reproduction/diff, reviewer scenario, and rollback rehearsal pass.

## Prompt 099 — Scale Launch Customer Support Operations

- **Objective:** Scale beta support for paying users without exposing source, credentials, payment data, or bearer report URLs.
- **Context:** Cases include activation/restore, unsupported files, grouping, estimated report availability, outages, data rights, IDs, and refunds.
- **Requirements:** Finalize portal/knowledge base, response targets, redacted diagnostics, access controls, escalation, macros, staffing, and privacy/abuse workflows.
- **Constraints:** Agents do not request source, full URLs, credentials/passwords, or card data by default; diagnostics require consent and redaction.
- **Acceptance:** Technical, billing, privacy, security, outage, accessibility, data-rights, and abuse cases have owners and limits.
- **Verification:** Drills meet targets while preserving tenant isolation, least access, redaction, auditing, and escalation quality.

## Prompt 100 — Final Launch Audit and Go/No-Go

- **Objective:** Make launch contingent on evidence that the product is lawful, secure, private, reliable, accessible, truthful, and supportable.
- **Context:** A polished interface cannot compensate for missing commercial rights, unsafe data handling, false claims, or unsustainable operations.
- **Requirements:** Audit rights/encrypted transport, exact offer, commerce, legal/privacy, data rights, security/DR, tests, observability, store, rollout, and support.
- **Constraints:** Missing/expired rights or encryption, critical/high risk, failed deletion/restore, dishonest claim, unsustainable offer, or unowned blocker is no-go.
- **Acceptance:** Record each checklist outcome, evidence link, owner, exception/expiry, rollback trigger, and signed executive go/pivot/stop decision.
- **Verification:** Conduct final sign-off, launch only through staged gates, and run evidence-based 24-hour, 7-day, and 30-day audits.
