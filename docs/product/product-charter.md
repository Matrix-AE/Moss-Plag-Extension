# Product Charter and Responsible Terminology

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 002 — Product Charter and Responsible Terminology |
| Status | Proposed charter for research validation |
| Product stage | Pre-implementation; no provider-dependent product traffic is authorized |
| Effective date | 2026-07-28 |
| Source plan | [`plan.md`](../../plan.md) |
| Prerequisite baseline | [`repository-baseline.md`](../discovery/repository-baseline.md) |
| Next validation | Prompt 003 target-user and prototype research |
| Hard commercial gate | Prompt 005 written authorization; Prompt 006 approved offer/economics |

This charter controls product, design, engineering, marketing, support, analytics, and store language. Later evidence may refine it through a recorded decision; silent scope or claim drift is not allowed.

## Charter Statement

### Purpose

Help adults organize code they are authorized to submit, compare two or more logical submissions through an approved external similarity provider, and deliberately open the resulting provider-hosted report—without requiring command-line setup.

### Core Promise

> Compare authorized code submissions and receive a provider-hosted similarity report link through a clear, guided workflow.

The product organizes inputs, explains processing, tracks submission state, and returns a link. It does not decide whether plagiarism, cheating, infringement, or misconduct occurred.

### Product Category

The product is a **code-similarity workflow extension**. It is not a general document checker, Internet-wide search engine, authorship detector, grading system, disciplinary tool, or official Stanford/MOSS product.

### Value Proposition

Users get one understandable workflow for grouping code, reviewing what will leave their device, submitting it with explicit consent, following progress, and retrieving a sensitive result link. The value is reduced setup and grouping friction—not stronger detection claims than the provider supports.

## Launch Audience and Personas

The self-serve launch audience is adults aged 18 or older using a personal license. Every user must own or have explicit authority to submit every file and comparison group. Possession of a file is not sufficient authority.

| ID | Persona | Situation | Primary need | Boundary |
| --- | --- | --- | --- | --- |
| P-01 | Independent learner | Compares their own exercises, revisions, or other code they are authorized to use. | Understand overlap without installing scripts. | May not upload classmates’ work merely because they can access it. |
| P-02 | Developer or maintainer | Reviews authorized implementations, migrations, forks, or internal code sets. | Group multi-file projects and locate potential overlap for human review. | Employer/client policy and repository rights still apply. |
| P-03 | Mentor or tutor | Reviews code supplied with the author’s permission. | Compare two or more submissions while explaining results responsibly. | Must not turn a similarity report into an automatic accusation or grade. |
| P-04 | Independent adult educator | Reviews a small authorized adult-authored corpus outside an institution-managed deployment. | Submit groups consistently and retrieve one report link. | Minor-authored code, institutional records, rosters, and DPA workflows are not covered by the personal MVP. |

The product is not marketed to children and the self-serve MVP does not accept minor-authored code, even when an adult holds or submits it. Institutional/classroom administration, hiring decisions, employee surveillance, managed student records, and high-stakes automated decisions require separate legal, privacy, product, and commercial review.

## Jobs to Be Done

| ID | User job | Successful outcome |
| --- | --- | --- |
| J-01 | When I have exactly two authorized code submissions, help me structure a Pair Check. | I can see two distinct logical groups and verify their contents before anything is sent. |
| J-02 | When I have several authorized submissions, help me structure a Batch Check. | I can create at least two consistently grouped submissions without confusing files with projects. |
| J-03 | When each submission contains several files, keep project membership intact. | Files remain under the intended logical submission with safe virtual paths. |
| J-04 | When common starter code would create noise, let me identify optional authorized base code. | Base code is visibly separate and its exclusion purpose is explained without promising perfect filtering. |
| J-05 | Before source leaves my device, show exactly what will be processed and by whom. | I understand the file/group counts, external-provider transfer, sensitive-link behavior, and required consent. |
| J-06 | While a submission is running, tell me what is actually happening. | I see honest recoverable states instead of a frozen popup or invented progress. |
| J-07 | When analysis completes, help me handle the report safely. | I can deliberately open or copy the correct link and understand that it requires human interpretation. |
| J-08 | When something fails, help me recover without duplicate allowance consumption or accidental resubmission. | I receive a stable error category and a safe next action. |

## Supported MVP Scenarios

| ID | Scenario | Product behavior |
| --- | --- | --- |
| S-01 | Pair Check | Exactly two logical submissions; each may contain one code file or a multi-file project. |
| S-02 | Batch Check | Two or more logical submissions compared in one authorized corpus, subject to approved limits. |
| S-03 | Multi-file projects | Files and inspected safe ZIP/folder inputs are normalized into explicit project groups. |
| S-04 | Optional base code | A separate base-code group can identify authorized shared boilerplate for provider-supported exclusion. |
| S-05 | One language per job | The user confirms one provider-supported language; mixed inputs are rejected or deliberately separated. |
| S-06 | Pre-submit review | The user reviews groups, files, exclusions, limits, processing disclosures, and consent before transfer. |
| S-07 | Provider-hosted result | A successful job returns a validated bearer report link; the MVP does not scrape or reinterpret the report. |
| S-08 | Synthetic exploration | A user can understand the workflow with clearly fictional metadata/source before purchasing or uploading private code. |

All numeric file, archive, group, byte, allowance, and concurrency limits remain unset until research, provider terms, architecture, and unit economics establish enforceable values. The UI must not imply unlimited use while those values are unresolved.

## Product Definitions

| Term | Controlled definition |
| --- | --- |
| Logical submission | One code work being compared, represented by one source file or an explicitly grouped multi-file project. It is not every selected file treated as a separate person/work. |
| Pair Check | A comparison containing exactly two logical submissions. |
| Batch Check | A comparison containing two or more logical submissions under one language/settings set, subject to later approved limits. |
| Base code | Authorized shared starter/template code identified separately so the provider can handle expected overlap where supported. It does not guarantee removal of false positives. |
| Similarity report | The provider-hosted output for human review; it is not a plagiarism, intent, or misconduct verdict. |
| Bearer report link | A sensitive URL whose holder may be able to view submitted code without another product authentication step. |

## Explicit Exclusions

The MVP does not support:

- a single file checked against the Internet, GitHub, a global database, or an undisclosed corpus;
- essays, prose, PDFs, DOC/DOCX files, images, video, audio, executables, or arbitrary binary “documents”;
- automatic plagiarism, cheating, guilt, intent, infringement, or disciplinary conclusions;
- AI-generated-code or authorship detection;
- report scraping, report mirroring, fabricated percentages, or a proprietary similarity score;
- minor-authored code/data, LMS/SIS integrations, class rosters, institution roles, education-record workflows, or institutional DPAs;
- hiring, grading, punishment, surveillance, or other high-stakes automated decisions;
- page-content reading, all-sites browser access, browsing-history access, or automatic collection from open tabs;
- provider account registration automation, email-password collection, shared credentials, account pooling, or quota-evasion rotation;
- a promise that reports are private, revocable, permanently available, or deleted when local history is removed;
- a promise of unlimited lifetime hosted processing under the one-time purchase.

Requests outside these boundaries receive an honest explanation, not a hidden partial implementation.

## Responsible Terminology Standard

### Default Vocabulary

| Concept | Default user-facing term | Acceptable explanatory use | Do not claim |
| --- | --- | --- | --- |
| Product action | Similarity check; compare code | Code-similarity analysis | Plagiarism detector; cheating detector |
| Finding | Potential match; similar passage | Overlap requiring review | Copied; stolen; guilty; caught |
| Output | Similarity report; report link | Provider-hosted report | Verdict; proof; certificate |
| Interpretation | Review context; human review | Similarity does not establish intent or misconduct | Plagiarism proven; automatic decision |
| Input | Code file; submission; project group | Authorized source code | Document when PDF/DOCX support is implied |
| Processing party | External similarity provider | Provider name after authorization and brand review | Official Stanford extension; endorsed by MOSS |
| Link handling | Sensitive bearer report link | Treat the link like a password | Private link; secure link; revoked link |
| Availability | Estimated availability | May disappear before or after the estimate | Guaranteed for 14 days; permanently stored |
| Commercial offer | One-time purchase | Exact entitlement after Prompt 006 approval | Unlimited; lifetime hosted checks; all future versions |
| Protection | Encrypted from extension to the named endpoint, when true | Name the precise protected leg and remaining limits | Fully secure; anonymous; zero knowledge |

“Plagiarism” may appear in policy, help, search education, or a limitation statement only when it explicitly says similarity is not proof. It is never the default name of the product, action, report, result, or score. Search-friendly wording does not override truthful product wording.

### Approved UI Copy Baseline

Only the following proposed strings are approved at charter stage. Product-specific prices, limits, provider names, transport claims, retention promises, and availability estimates must wait for their controlling gates.

<!-- approved-ui-copy:start -->
```json
{
  "schemaVersion": 1,
  "locale": "en-US",
  "defaultReportTerm": "similarity report",
  "messages": {
    "primaryPromise": "Compare authorized code submissions and get a provider-hosted similarity report link—without command-line setup.",
    "primaryAction": "New similarity check",
    "pairMode": "Compare two submissions",
    "batchMode": "Compare multiple submissions",
    "authorityNotice": "Only upload code you own or are authorized to submit.",
    "processingNotice": "After your review and consent, your code will be sent to an external similarity provider.",
    "reviewAction": "Review files and processing details",
    "uploadProgress": "Uploading authorized code",
    "providerProgress": "Submitting for similarity analysis",
    "resultReady": "Your similarity report link is ready.",
    "resultGuidance": "Similarity highlights matching code; it does not determine plagiarism, intent, or misconduct. A person must review the highlighted code and context.",
    "reportScope": "This check compared only the submission groups you supplied.",
    "linkWarning": "Anyone with this report link may be able to view submitted code. Treat it like a password.",
    "externalCopyWarning": "Opening or copying the link may save it in browser history, sync, or the system clipboard.",
    "availabilityNotice": "Availability is estimated and the provider may remove the report earlier or later.",
    "forgetLinkNotice": "Forget link removes our saved URL only. It does not revoke the provider report or erase external copies.",
    "unsupportedFormat": "Choose supported source-code files. Essays, PDFs, Word documents, images, and executables are not supported.",
    "singleGroupError": "Add at least two submissions to run a meaningful comparison.",
    "noMatches": "No matches were reported within this supplied corpus under the selected settings. This is not proof of originality.",
    "highSimilarity": "High similarity was reported. Review the highlighted passages; the report does not establish authorship, copying direction, or intent.",
    "sameAuthorNotice": "Revisions or code by the same author can produce high similarity. Review the surrounding context.",
    "baseCodeNotice": "Expected shared code was identified as base code where provider support applies. This does not guarantee that every expected match is removed.",
    "mixedLanguageError": "This check cannot run with mixed languages. Create a separate check for each supported language.",
    "reportUnavailable": "The report is unavailable or past its estimated availability. We cannot confirm that the provider deleted it.",
    "providerNotSent": "The provider is unavailable and this check was not sent. No similarity conclusion was produced.",
    "providerSentNoResult": "The check was sent, but the provider returned no report. The submission outcome is incomplete; do not retry until the product marks it safe.",
    "providerStatusUnknown": "We cannot confirm whether the provider received this check. No similarity conclusion was produced; do not retry until the product marks it safe."
  }
}
```
<!-- approved-ui-copy:end -->

Every later UI surface must keep its proposed copy in a reviewable inventory. Copy tests must reject accusation language, unsupported formats/corpora, affiliation claims, absolute security/privacy language, and unlimited/lifetime hosted-service claims.

Any provider-specific non-affiliation statement is a conditional legal/brand template, not approved baseline UI copy. Prompt 005 must first authorize or require naming the provider and approve the exact surrounding disclaimer; an alternative-provider or native pivot must not inherit Stanford-specific copy.

### Required Interpretation Guidance

At result time, the product must state all of the following in plain language:

1. Similarity highlights code that may deserve review; it is not a misconduct verdict.
2. Similarity can arise from common patterns, required structure, libraries, templates, or authorized collaboration.
3. A person must inspect the report, source context, assignment/rule context, and legitimate explanations.
4. The product must not recommend punishment, grading, reporting, or accusation.

### Controlled Edge-Case Language

- **No matches:** say no matches were reported within the supplied corpus/settings; never say “plagiarism-free,” “original,” or “passed.”
- **High or 100% similarity:** report the provider value without inferring authorship, copying direction, intent, guilt, or a disciplinary outcome.
- **Same-author or legitimate reuse:** explain that revisions, shared patterns, required structure, templates, libraries, and authorized collaboration can produce similarity.
- **Base code:** say shared code was identified for provider-supported handling; never promise that false positives were eliminated.
- **Mixed languages:** explain that the configured job cannot run and require deliberately separated checks; do not imply cross-language detection.
- **Unavailable report:** say unavailable or past the displayed estimate; do not claim “expired” or “deleted” unless the provider confirms that state.
- **Provider outage, quota, or capacity:** identify the operational condition and whether submission occurred; never imply a similarity outcome.
- **Rerun:** create a new comparison from empty structure/settings and require file reselection; never imply retained source was silently resubmitted.

## Ethical and Trust Boundaries

### Authority and Consent

- Explain the authority requirement during onboarding and local review; Prompt 003 must test whether an earlier reminder helps without blocking private local drafting.
- Require job/corpus-specific affirmative confirmation before every submission after showing the exact groups, processing party, and applicable terms; renew it whenever files, groups, provider, or processing details change.
- Present the complete processing disclosure before the first external transfer and after material policy changes.
- Do not infer consent from installation, purchase, file selection, or a previously checked box for another job or materially changed processing.
- Reject workflows that are knowingly outside the adult self-serve scope.

### Human Review

- Keep neutral language from onboarding through support and marketing.
- Do not rank people by suspicion, generate guilt labels, or make automated disciplinary recommendations.
- Keep provider values in their documented context; do not relabel them as proprietary certainty scores.

### Data and Link Respect

- Treat source, filenames/paths, provider credentials, and report URLs as highly sensitive.
- Never place source, credentials, or complete report URLs in analytics, ordinary logs, screenshots, support forms, or marketing demos.
- Explain that opening/copying a bearer link can place it in browser history/sync or the system clipboard outside product control.
- Distinguish forgetting a locally stored URL from deleting history, deleting uploaded source, or revoking provider content.

### Provider and Service Respect

- No live commercial traffic without written authorization and an approved encrypted provider route.
- No automated account creation, shared free accounts, pooling, rotation, or attempts to evade provider limits.
- Use the provider’s name and marks only as accurately and expressly permitted; show non-affiliation where needed.
- A provider denial or unsuitable data/transport term triggers pivot or stop, not a concealed workaround.

## Commercial Boundary

USD $15 as a one-time purchase is a **commercial hypothesis**, not yet a publishable promise. Prompt 005 must establish a lawful provider/account model and an approved encrypted provider route. Prompt 006 must define the exact entitlement, numeric allowance, device count, updates, hosted operability/EOL, refunds, taxes, support, and remedy with a three-year cost model.

Until both gates pass:

- no checkout, paid beta, presale, “buy now” store copy, or commercial provider traffic is allowed;
- do not promise unlimited checks, lifetime hosting, every future major version, permanent reports, or included provider accounts;
- do not imply that a software purchase overrides provider rules, quotas, availability, or data terms;
- the approved fallback is a properly licensed alternative behind the provider adapter or a regenerated native/local architecture—not account rotation.

The intended value metric is a durable personal entitlement to the approved core feature set, not an unbounded recurring external-service liability.

## Success Metrics and Initial Outcomes

These are provisional **targets**, not achieved results or market evidence. Prompt 003 must test and revise them with defined adult participants and synthetic/authorized materials.

| ID | Target outcome | Measure and cohort | Initial target | Failure response |
| --- | --- | --- | --- | --- |
| M-01 | Users understand the product category. | Unprompted post-task question after prototype use. | At least 90% say it compares supplied code and does not search the Internet. | Rewrite onboarding/scope and retest. |
| M-02 | Users do not interpret similarity as a verdict. | Scenario-based comprehension question. | At least 90% reject “similarity proves misconduct.” | Block launch copy and redesign guidance. |
| M-03 | Users understand external processing. | Pre-submit comprehension check. | At least 90% identify that code leaves the device for an external provider. | Redesign disclosure and consent before implementation. |
| M-04 | Users understand bearer-link sensitivity. | Result-screen comprehension check. | At least 90% know anyone with the link may access submitted code. | Redesign result warning and sharing actions. |
| M-05 | Pair workflow is self-explanatory. | Moderated synthetic Pair Check without coach intervention. | At least 85% complete file grouping and final review correctly. | Fix information architecture before UI build. |
| M-06 | Batch grouping preserves submission intent. | Synthetic multi-project grouping task. | At least 90% place every file in the intended logical group. | Redesign group model and retest edge cases. |
| M-07 | The first result is easy to retrieve. | Synthetic end-to-end prototype task. | At least 85% reach and deliberately open the correct report action unaided. | Improve state/result hierarchy before beta. |
| M-08 | Proposed UI language stays responsible. | Automated copy inventory plus human release review. | 100% of shipped strings pass the terminology standard; zero forbidden claim escapes. | Fail the build/release. |
| M-09 | Users see value before payment. | Behaviorally anchored $15 concept research with qualified target adults. | At least 60% select the bounded paid concept over no purchase and accurately restate its limits; Prompt 003 fixes sample, method, and confidence treatment before collection. | Rework value/offer or stop; do not treat compliments as purchase evidence. |
| M-10 | The $15 offer is supportable. | Prompt 006 conservative three-year unit economics. | Greater than 0 approved three-year contribution margin under conservative use/support/refund assumptions. | Change allowance, architecture, price, or stop. |
| M-11 | The critical workflow is accessible. | Keyboard, screen-reader, contrast, zoom, reduced-motion, and automated WCAG 2.2 AA checks on supported surfaces. | 100% of blocking checks pass with zero critical/serious unresolved accessibility findings. | Fail the release and remediate. |

Participant counts, recruitment criteria, confidence treatment, and research limitations belong in the Prompt 003 research protocol. No metric can be marked met from team opinion alone.

## Assumptions Requiring Validation

| ID | Assumption | Owning prompt | Until validated |
| --- | --- | --- | --- |
| C-A01 | The named personas have the stated grouping/submission problem and prefer an extension workflow. | Prompt 003 | Treat personas and thresholds as hypotheses, not market evidence. |
| C-A02 | Current provider concepts, language codes, grouping, base-code behavior, reports, and limits support the scenarios. | Prompt 004 | Do not expose provider-specific claims or values in approved UI copy. |
| C-A03 | Written commercial terms allow a paid automated product and a supportable account model. | Prompt 005 | No sale, live commercial traffic, credential model, or provider branding. |
| C-A04 | An approved encrypted submission and report route is available. | Prompt 005 | Do not accept sensitive source or claim protected provider transport. |
| C-A05 | A bounded $15 offer can fund provider, payment, tax, hosting, support, refund, fraud, and update costs. | Prompt 006 | Price remains a hypothesis; no unlimited/lifetime promise. |
| C-A06 | Exact processing, retention, deletion, incident, and user-rights behavior is lawful and implementable. | Prompts 007–009 | Do not publish privacy/deletion guarantees. |
| C-A07 | MOSS/Stanford names or marks may be used descriptively under written brand terms. | Prompt 005 | Keep the public product/provider wording generic and use the non-affiliation disclaimer where relevant. |
| C-A08 | Chrome/MV3 can support validated file/group workflows with least privilege and accessible recovery. | Prompts 003 and 010–012 | Do not request broad permissions or promise untested browser behavior. |

## Product Decision Rules

1. **Truth before conversion:** if simpler marketing would misstate corpus, provider, privacy, availability, security, or interpretation, use the accurate claim.
2. **Authority before convenience:** if authority or consent is unclear, stop before transfer.
3. **Human review before accusation:** if a design encourages verdict-like interpretation, redesign it.
4. **Written rights before provider work:** if commercial authorization is missing or ambiguous, do not build or send live provider-dependent traffic.
5. **Encrypted path before sensitive transfer:** if an approved encrypted provider route is unavailable, pivot or stop.
6. **Measured scope before promises:** if limits/economics are unresolved, do not advertise unlimited or lifetime hosted use.
7. **Small permission surface:** if a feature requires broad browsing/page access, prove necessity or remove it from MVP.

## Traceability and Acceptance

| Charter requirement | Downstream owner |
| --- | --- |
| Personas, jobs, workflows, comprehension, and willingness-to-pay | Prompt 003 |
| Provider facts, language registry, reports, limits, and current policy | Prompt 004 |
| Commercial rights, account strategy, transport, data, brand, and support terms | Prompt 005 |
| Exact $15 entitlement and economics | Prompt 006 |
| Data inventory, consent, retention, and deletion | Prompts 007–008 |
| Threats, abuse, architecture, and permissions | Prompts 009–012 |
| Copy inventory, components, E2E, accessibility, and release enforcement | Later implementation and release prompts |

Prompt 002 is accepted when the charter verifier passes, every proposed UI string follows the vocabulary standard, all unsupported claims remain outside the approved copy block, and product/design/engineering can answer the following consistently:

- Who is this for? Adults submitting code they own or are explicitly authorized to use.
- What does it do? Organizes two or more supplied code submissions and returns a provider-hosted similarity report link.
- What does it not do? Search the Internet, accept general documents, prove misconduct, or make automated decisions.
- What can be sold now? Nothing until the commercial and unit-economics gates approve exact terms.

## Verification Record

| Test | Coverage |
| --- | --- |
| P002-T01 | Required charter structure is unique and ordered. |
| P002-T02 | Approved UI copy is strict UTF-8, escape/duplicate-key-safe JSON with a closed versioned schema and canonical strings. |
| P002-T03 | Similarity terminology is the default, the sole plagiarism use is a negating disclaimer, and accusation/certainty claims are absent. |
| P002-T04 | Adult/authority audience, jobs, scenarios, definitions, minor-data boundary, and exclusions are section-correct. |
| P002-T05 | External processing, supplied-corpus scope, bearer-link handling, edge states, and provider-brand gating are explicit. |
| P002-T06 | The $15 one-time-purchase hypothesis remains behind authorization, encryption, and economics gates. |
| P002-T07 | All eleven initial outcomes are unique, measurable, and clearly labeled as unachieved targets. |
| P002-T08 | Fence-aware Markdown, strict UTF-8, immutable-reference, final-newline, and contained local-link hygiene pass. |
| P002-T09 | Every tracked/untracked proposed file is size-bounded and ASCII-scanned; UTF-16 text is decoded/scanned then rejected, non-binary text is strict-UTF-8-scanned, and verification is read-only. |

The dependency-free command `powershell.exe -NoProfile -ExecutionPolicy Bypass -File scripts/verify-product-charter.ps1` passed 9/9 cases on 2026-07-29. The complete relevant suite also reran the Prompt 001 verifier successfully.

Prompt 002 defines copy and product policy but adds no application/frontend runtime, so browser wiring is not applicable yet. Future UI prompts must consume the approved copy inventory and add component plus packaged-extension tests rather than claiming this charter test exercised a nonexistent interface.
