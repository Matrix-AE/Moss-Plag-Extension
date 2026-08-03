# MVP Product Requirements Document

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 003 — MVP Workflows and Product Requirements |
| Status | Accepted for engineering planning; commercial sale remains gated |
| Effective date | 2026-08-03 |
| Source plan | [`plan.md`](../../plan.md) |
| Charter | [`product-charter.md`](./product-charter.md) |
| Market evidence | [`research/prompt-003-market-scan.md`](./research/prompt-003-market-scan.md) |
| Research prototype | [`research/prototype/index.html`](./research/prototype/index.html) |
| Hard commercial gates | Prompt 005 written authorization; Prompt 006 approved offer/economics |
| Provider facts gate | Prompt 004 official service and protocol verification |

This PRD converts the charter into complete MVP workflows, prioritized requirements, user stories, edges, and acceptance criteria. Silent scope drift is not allowed; any divergence must be recorded against this document and the charter.

## Research Evidence Summary

### Evidence collected in Prompt 003

| Evidence ID | Artifact | What it establishes | What it does not establish |
| --- | --- | --- | --- |
| E-01 | [`prompt-003-market-scan.md`](./research/prompt-003-market-scan.md) | Official-source competitor and price anchors; free alternatives are material; $15 remains unvalidated | Purchase intent, conversion, or retention among target adults |
| E-02 | Research prototype model + UI | Pair/batch grouping, validation, consent gating, offline/timeout recovery, pricing concept, and result handling can be exercised with synthetic metadata | Real upload, provider submission, payment, or store behavior |
| E-03 | Automated prototype tests (`tests/prompt-003-research-prototype.test.js`) | Required scenarios, grouping invariants, consent, recovery copy, CSP/local-only constraints, and terminology hooks | Moderated adult comprehension rates from charter metrics M-01–M-09 |
| E-04 | Live prototype walkthrough (synthetic) | Facilitator can load every required scenario; consent and recovery states behave as modeled | Statistical confidence for launch metrics |

### Research protocol status

Target-adult moderated interviews and willingness-to-pay collection remain **open**. Until a recorded research session meets the sample and method rules below, charter metrics M-01–M-09 must stay labeled unmet.

| Protocol item | Required rule |
| --- | --- |
| Participants | Adults 18+ matching personas P-01–P-04; no minors; no real classmate/employer confidential code |
| Materials | Synthetic filenames/metadata only; never private source, credentials, or live provider traffic |
| Tasks | Two files, twenty files, two projects, invalid input, mixed language, offline, timeout, consent, pricing |
| Comprehension checks | Category, verdict-not-proof, external processing, bearer-link sensitivity |
| Pricing | Show the bounded concept after workflow tasks; record choice among buy / keep current method / would not compare; require accurate restatement of limits |
| Confidence | Do not mark a charter metric met from team opinion, compliments, or competitor list prices alone |

### Research conclusions that bind the PRD

1. MVP value is reduced setup and grouping friction plus responsible consent/result handling—not exclusive access to a similarity engine.
2. Free alternatives (public MOSS, Dolos, JPlag, AutoMOSS, CodeGrade free tier) create price pressure; the $15 hypothesis stays unproven.
3. Individual files must not be silently flattened into “one person per file” when the user intends multi-file projects.
4. Report interpretation and scraping stay outside MVP.
5. No checkout, commercial provider traffic, or publishable `$15` store promise until Prompts 005–006 pass.

## MVP Workflows

### W-01 Pair Check

1. User chooses Pair mode.
2. User places exactly two logical submissions (one file or multi-file project each).
3. User confirms one language and optional base code.
4. User reviews corpus, disclosures, and consents.
5. After authorized submission, user receives a provider-hosted similarity report link.

### W-02 Batch Check

1. User chooses Batch mode.
2. User creates two or more logical submissions with consistent grouping.
3. Same configure → review → consent → progress → result path as Pair.
4. Numeric group/file/byte limits remain unset until Prompts 004–006 fix enforceable values.

### W-03 Multi-file project grouping

1. Files keep membership under an explicit logical submission.
2. Safe virtual paths are shown before transfer.
3. Folder/ZIP intake is in scope for the product; the research prototype models membership without reading real archives.

### W-04 Optional base code

1. Base code is a separate authorized group, not a submission.
2. UI explains provider-supported exclusion without promising perfect filtering.

### W-05 Configuration, progress, and result

1. Language is explicit; mixed languages are rejected or deliberately separated.
2. Progress uses confirmed stages only: uploading → validating → queued → submitting → waiting → ready.
3. Result offers open/copy/forget-URL guidance with bearer-link and availability warnings.
4. MVP does not scrape, proxy, rewrite, or permanently archive the report.

## Prioritized Requirements

Priorities: **P0** launch-blocking for the approved MVP architecture; **P1** required soon after P0 surfaces work; **P2** deferred or post-MVP unless a later prompt promotes it.

| ID | Priority | Requirement | Trace |
| --- | --- | --- | --- |
| R-001 | P0 | Support Pair Check with exactly two logical submissions. | W-01, J-01, S-01 |
| R-002 | P0 | Support Batch Check with two or more logical submissions under one language/settings set. | W-02, J-02, S-02 |
| R-003 | P0 | Preserve multi-file project membership; never infer trusted grouping solely from user-controlled paths. | W-03, J-03, S-03 |
| R-004 | P0 | Allow optional authorized base-code identification separate from submissions. | W-04, J-04, S-04 |
| R-005 | P0 | Require one provider-supported language per job; reject mixed-language corpora. | S-05, charter copy |
| R-006 | P0 | Show pre-submit review of groups, files, language, disclosures, and consent before any transfer. | W-05, J-05, S-06 |
| R-007 | P0 | Require corpus-specific affirmative authority and processing confirmation; reset on material change. | Ethical boundary |
| R-008 | P0 | Return only a validated provider-hosted similarity report link; no scraping or proprietary reinterpretation. | S-07, J-07 |
| R-009 | P0 | Use responsible “similarity report” terminology; never claim misconduct proof. | Charter vocabulary |
| R-010 | P0 | Distinguish offline-before-send, sent-without-result, and unknown-transfer states; block unsafe retry. | J-08 |
| R-011 | P0 | Reject unsupported formats (PDF, DOCX, images, executables, essays) with honest copy. | Exclusions |
| R-012 | P0 | Keep source, credentials, and complete report URLs out of analytics, ordinary logs, and research fixtures. | Trust boundary |
| R-013 | P0 | Do not implement account pooling, rotation, or registration automation. | Commercial boundary |
| R-014 | P1 | Persist only metadata-safe draft recovery; never retain source/filenames as recoverable history beyond approved rules. | Plan draft rules |
| R-015 | P1 | Provide popup launcher/status plus full extension workspace surfaces. | Plan UX |
| R-016 | P1 | Enforce approved numeric file/group/byte/allowance limits once Prompts 004–006 fix values. | Limits gate |
| R-017 | P1 | Offer recent-activity metadata cards without storing source content. | Plan recent activity |
| R-018 | P2 | Optional Chrome side panel after research confirms value. | Post-MVP |
| R-019 | P2 | Institutional/classroom, minor-authored, LMS, and roster workflows. | Explicitly out of MVP |
| R-020 | P2 | Internet-wide search, AI authorship detection, grading/discipline automation. | Explicitly out of MVP |

## User Stories

| ID | Story | Acceptance focus |
| --- | --- | --- |
| US-01 | As an independent learner, I can compare two authorized exercises as a Pair Check without CLI setup. | R-001, R-006, R-008 |
| US-02 | As a developer, I can keep each multi-file project intact in a Batch Check. | R-002, R-003 |
| US-03 | As a mentor, I can mark shared starter files as base code and still understand that false positives may remain. | R-004 |
| US-04 | As any user, I must confirm authority and external processing for this exact corpus before submit. | R-007 |
| US-05 | As any user, when I am offline I learn that nothing was sent and that this is not a similarity outcome. | R-010 |
| US-06 | As any user, when a check was sent without a result I am blocked from blind retry. | R-010 |
| US-07 | As any user, I receive a similarity report link with bearer-secret and human-review warnings. | R-008, R-009 |
| US-08 | As a research participant, I can explore the workflow with synthetic data and a non-purchase pricing concept. | E-02, S-08 |

## Edge Cases and Expected Behavior

| Edge ID | Input / condition | Expected product behavior |
| --- | --- | --- |
| E-EMPTY | Empty submission group | Block continue/submit; explain each submission needs a supported source file. |
| E-ONE | Fewer than two logical submissions | Block meaningful comparison. |
| E-INVALID | PDF/DOCX/image/executable mixed into a group | Reject unsupported file; no analysis implication. |
| E-MIXED | More than one language in the job | Block; require separate checks per language. |
| E-OFFLINE | Submit while offline | Stay on review; state that no files were sent. |
| E-TIMEOUT | Provider sent, no report | Error/recovery; do not retry until marked safe. |
| E-CONSENT | Review without both confirmations | Block submit; require authority and processing confirmation. |
| E-RESULT | Successful synthetic/real result | Show link + warnings; open/copy are deliberate; forget-link does not revoke provider content. |
| E-PRICE | Pricing concept screen | Research-only; nothing for sale until Gates 005–006. |
| E-FLAT | Twenty files belonging to five projects | Keep five groups of four; do not flatten to twenty submissions. |

## Traceable Acceptance Criteria

| Criterion | Must pass | Evidence |
| --- | --- | --- |
| AC-01 | PRD contains research evidence, numbered requirements, priorities, stories, edges, and acceptance criteria. | This document + `tests/prompt-003-mvp-prd.test.js` |
| AC-02 | Prototype exposes and models every required walkthrough scenario. | `tests/prompt-003-research-prototype.test.js` P003-P01–P20 |
| AC-03 | Two files become two logical submissions. | Prototype scenario `two-files` |
| AC-04 | Twenty files remain grouped as intact projects. | Prototype scenario `twenty-files` |
| AC-05 | Two multi-file projects keep separate membership. | Prototype scenario `two-projects` |
| AC-06 | Invalid and mixed-language inputs are blocked with charter-aligned copy. | Scenarios `invalid-input`, `mixed-language` |
| AC-07 | Offline and timeout recovery copy match charter edge language. | Scenarios `offline`, `timeout` |
| AC-08 | Consent gates submission; pricing is research-only. | Scenarios `consent`, `pricing` |
| AC-09 | Prototype cannot network, store, or write clipboard secrets; CSP is restrictive. | P003-P16–P19 |
| AC-10 | No live provider traffic, credentials, or real result URLs in Prompt 003 artifacts. | Secret scan in PRD verifier + prototype tests |
| AC-11 | Moderated adult interview metrics remain unmet until recorded sessions exist. | Research protocol status above |

## Out of Scope (MVP)

- Report scraping, mirroring, fabricated percentages, or proprietary certainty scores.
- Internet-wide or GitHub-wide plagiarism search.
- Essay/PDF/DOCX/image/video/audio/executable checking.
- Automatic plagiarism/cheating/guilt conclusions.
- AI-generated-code or authorship detection.
- Minor-authored code, LMS/SIS, rosters, institutional DPA workflows.
- Account pooling, rotation, or automated MOSS registration.
- Checkout or “buy now” copy before Prompts 005–006.
- Unlimited/lifetime hosted processing promises.

## Downstream Traceability

| PRD item | Next owner |
| --- | --- |
| Language registry, quotas, protocol, retention claims | Prompt 004 |
| Commercial rights, account model, encrypted transport, brand | Prompt 005 |
| Exact $15 entitlement and unit economics | Prompt 006 |
| Data inventory, consent/retention/deletion enforcement | Prompts 007–008 |
| Threat model and architecture | Prompts 009–010 |
| Domain model and NFRs | Prompts 011–012 |
| Implementation surfaces | Prompt 013+ |

## Verification Record

| Test | Coverage |
| --- | --- |
| P003-D01–D12 | MVP PRD structure, requirement IDs, priorities, stories, edges, gates, and secret hygiene (`tests/prompt-003-mvp-prd.test.js`) |
| P003-P01–P20 | Research prototype scenario and safety suite (`tests/prompt-003-research-prototype.test.js`) |
| P003-L01 | Live synthetic walkthrough of required scenarios in the local prototype |

Live walkthrough P003-L01 passed on 2026-08-03 against `http://127.0.0.1:4173/?facilitator=1`: pair grouping → configure → consent-gated submit → synthetic result, plus timeout recovery. No provider traffic occurred.

Prompt 003 adds research documentation and a local prototype only. Packaged extension wiring begins after architecture and monorepo prompts; this PRD is the product contract those later prompts must implement.
