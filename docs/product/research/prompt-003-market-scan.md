# Prompt 003 Official-Source Market Scan

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 003 - MVP Workflows and Product Requirements |
| Research type | Current-market desk research using official primary sources only |
| Source access date | 2026-07-29 |
| Status | Evidence snapshot; not user research, legal advice, commercial authorization, or willingness-to-pay validation |
| Product hypothesis evaluated | USD $15 one-time personal entitlement for a guided supplied-corpus code-similarity workflow |

## Method and Evidence Rules

This scan covers direct supplied-corpus code-similarity products, MOSS interfaces, broader code-integrity platforms, and adjacent file-comparison tools. Sources are limited to official provider pages, official documentation, and publisher-controlled project repositories. No aggregator, reseller, review site, or unattributed pricing source is used.

The following labels control interpretation:

- **Observed claim** means the linked source displayed the feature, limit, price, or policy on the access date. Product and performance claims remain vendor-authored unless the source is project documentation.
- **Inference** means a product implication derived from observed facts. It is not presented as a vendor statement or measured user behavior.
- **Unknown** means the public sources did not establish the fact, the pages conflicted, or a contract/account-only source would be needed.

Prices are point-in-time snapshots and may vary by currency selection, billing period, region, tax, promotion, seat count, usage, or negotiated contract. Except where a source expressly states US dollars, the tables preserve the `$` symbol shown by the vendor. No checkout was completed and no sales quotation or private agreement was obtained.

This research does not authorize commercial use of MOSS, any MOSS account, or any third-party hosted service. Open-source client or interface licensing does not grant rights to an external provider. Account pooling, credential sharing, account rotation, or quota evasion is outside the product charter and is not a commercial strategy.

## Direct and Near-Direct Alternatives

### MOSS

**Observed claims**

- MOSS compares the similarity of programs and returns HTML pages listing similar pairs with highlighted matching passages.
- It can exclude expected shared code such as instructor-supplied base code.
- The public service is described as free and available for non-commercial use; commercial users are directed to contact Similix Corporation.
- The public service enforces a limit of 100 submissions per day per user.
- MOSS states that similarity scores are not proof of plagiarism and require human review.
- Submitted code is copied into results that anyone holding the result URL can access. Reports are typically deleted after about 14 days but may disappear earlier.

Source: [MOSS official service page](https://theory.stanford.edu/~aiken/moss/).

**Unknowns**

- Current commercial price, minimum commitment, permitted customer segment, and authorized account model.
- Whether a paid extension may automate submissions, resell or bundle processing, link directly to reports, or ask end users to bring their own account.
- Approved encrypted submission and report transport, processing roles, deletion commitments, support, incident handling, concurrency, and SLA.
- Permitted use of MOSS, Stanford, and related names or marks in a paid listing.

**Inference for the product**

The $15 offer cannot launch on the public non-commercial service. Written commercial authorization and an approved encrypted route remain hard gates. A result URL, base code, and multi-file comparison are baseline provider capabilities rather than unique product value.

### AutoMOSS

**Observed claims**

- The official MOSS page lists AutoMOSS as a contributed web UI with additional features.
- The publisher repository describes automation for detecting code similarities across collections of computer-science assignments.
- It is MIT-licensed and can be run locally after environment setup, either directly or with Docker.

Sources: [MOSS community-contribution listing](https://theory.stanford.edu/~aiken/moss/), [AutoMOSS publisher repository](https://github.com/automoss/automoss).

**Unknowns**

- No official hosted plan, current public price, SLA, or consumer extension was found in the checked repository material.
- The repository license does not answer whether any particular MOSS service use is commercially authorized.

**Inference for the product**

A web interface around MOSS already exists as free source. The proposed extension must demonstrate materially lower setup and grouping friction for its personal audience; interface availability alone does not establish paid differentiation.

### JPlag

**Observed claims**

- JPlag finds pairwise similarities across multiple programs and calculates them locally; its documentation says source code and results are not uploaded.
- It provides a CLI, Java API, local report viewer, base-code support, old/new submission roots, thresholds, exclusions, and CSV export.
- The current repository lists numerous supported languages, requires Java SE 25 to run or build, and is GPL-3.0 licensed.
- A logical submission may be a single file or a recursively read directory.

Sources: [JPlag publisher repository](https://github.com/jplag/JPlag), [JPlag usage documentation](https://github.com/jplag/JPlag/wiki/1.-How-to-Use-JPlag).

**Unknowns**

- No official hosted SaaS price, processing SLA, or personal-service entitlement was found.
- Whether and how GPL-licensed code could be distributed or combined with the product requires a separate dependency and licensing review.

**Inference for the product**

JPlag is a credible local-provider fallback and raises the privacy standard, but adopting it would change the provider-hosted-result architecture. Its availability also means the paid value must be workflow convenience and support rather than exclusive access to a similarity engine.

### Dolos

**Observed claims**

- Dolos offers a free web application, CLI, JavaScript library, and self-hosting path; its source is MIT-licensed.
- The web workflow accepts a ZIP, detects a language from extensions, queues analysis, and produces an interactive report that can be shared through a secret link.
- If an archive mixes languages, the hosted workflow analyzes files in the dominant language unless the user selects another language.
- Report history is held in browser local storage. A user retaining the secret link can delete the hosted dataset/report; old reports are periodically removed.
- The hosted instance is described as a free service for schools and universities. Its documentation says submitted files/reports are not shared or used commercially by Team Dodona.

Sources: [Dolos official product page](https://dolos.ugent.be/), [Dolos introduction](https://dolos.ugent.be/docs/), [Dolos hosted-workflow documentation](https://dolos.ugent.be/docs/server.html).

**Unknowns**

- Commercial proxying or resale rights for the hosted instance, service limits, availability targets, and SLA are not published in the checked pages.
- The public pages do not establish that the free hosted service is intended for this product's independent-adult commercial workflow.

**Inference for the product**

Dolos is the strongest free, modern, low-setup substitute found. ZIP upload, interactive results, local history, deletion, and secret sharing are already available. The extension must validate superior pair/project grouping, pre-transfer review, consent clarity, recovery, and sensitive-link handling rather than relying on modern styling alone.

### CodeGrade

**Observed claims**

- CodeGrade says plagiarism detection is included in every plan, including a free plan for courses of up to 50 students with no expiration or credit card.
- Its code-similarity feature uses JPlag and compares within a current class, across linked prior semesters, and against uploaded external sources.
- The checked feature page lists nine supported languages, highlighted side-by-side comparisons, percentage similarity values, configurable thresholds, and Word/PDF report export.
- Free onboarding is described in an educator/course workflow using an institutional email.

Sources: [CodeGrade code-similarity feature page](https://www.codegrade.com/solutions/code-plagiarism-checker), [CodeGrade Free page](https://www.codegrade.com/landing/free).

**Unknowns**

- Paid-plan prices, non-institutional eligibility, commercial API access, and standalone personal-use terms were not published on the checked pages.

**Inference for the product**

Independent adults outside course administration may remain a distinct segment, but the independent-educator persona already has a substantial free alternative. The free tier prevents using educator demand by itself as evidence for $15 personal willingness to pay.

### Codequiry

**Observed claims**

- The pricing cards displayed Grow at `$29/mo`, Advanced at `$99/mo`, Scale at `$399/mo`, and a Rapid add-on at `$49/mo`.
- The Grow card displayed one team seat, five web-and-AI scans per month, `$3.50` per additional scan, unlimited peer-similarity scans, and dashboard/desktop/API/CLI access.
- The same page says Codequiry is for educators and institutions and that student usage is not permitted.
- The separate API pricing page displayed `$29` per month, unlimited API calls, all plagiarism-detection features, web/database checks, all programming languages, SDKs, and JSON responses.
- The product claims peer comparison, highlighted side-by-side matches, web/database searching, AI-code detection, and multiple similarity engines.

Sources: [Codequiry official pricing](https://codequiry.com/pricing), [Codequiry API pricing](https://codequiry.com/usage/api/pricing), [Codequiry official product page](https://codequiry.com/).

**Conflicts and unknowns**

- The pricing page conflicts with its own embedded service-agreement text: plan cards displayed 5 Grow and 100 Advanced web/AI scans, while the agreement text listed 30 Grow deep checks and 200 Advanced checks.
- "Unlimited API calls" does not establish unlimited completed scans, permitted resale, white-label rights, end-user eligibility, or a right to bundle the service into a one-time-purchase extension.
- Exact API entitlement, overage treatment, retention/corpus behavior, redistribution terms, and contract priority require direct written clarification.

**Inference for the product**

A $15 one-time fee is below one month of the displayed entry subscription, but it cannot sustainably absorb an unresolved recurring API liability. Codequiry is neither an approved integration nor dependable unit-economics evidence until its conflicts and commercial terms are resolved.

### Copyleaks

**Observed claims**

- The Individual pricing page displayed Personal at `$16.99/month` or `$13.99/month` with annual billing. It included multi-file upload and browser extensions for Chrome, Edge, and Firefox.
- The annual Personal display included 1,200 unified credits; the monthly display included 100 unified credits.
- Official API documentation says its plagiarism API scans text, documents, and source code against web, academic, and customer-provided collections, including private data hubs.
- Technical documentation listed many source-code extensions and a 3 MB maximum upload size for source-code files.
- Enterprise/API integration is presented as a sales-led offering rather than a public self-serve API price on the checked general pricing page.

Sources: [Copyleaks official pricing](https://copyleaks.com/pricing), [Copyleaks plagiarism API documentation](https://docs.copyleaks.com/concepts/products/plagiarism-checker-api/), [Copyleaks technical specifications](https://docs.copyleaks.com/reference/data-types/authenticity/technical-specifications/), [Copyleaks API page](https://copyleaks.com/api).

**Unknowns**

- Commercial API price, minimum volume, resale/white-label rights, private-corpus cost, and processing terms.
- The checked pages do not establish that the Personal plan or source-code API implements the same supplied-group structural comparison semantics as MOSS.

**Inference for the product**

The displayed Personal price makes $15 one-time appear inexpensive against one subscription month, but this is only a price anchor. Copyleaks is a broader content-integrity product, and its undisclosed API economics cannot support an unlimited entitlement assumption.

## Adjacent Comparison-Tool Price Anchors

### Diffchecker

**Observed claims**

- The pricing page displayed a free Basic plan and Pro + Desktop at `$15` per user per month.
- Pro + Desktop includes desktop apps for Windows, macOS, and Linux, offline processing where files remain on-device, folder comparison, recursive file trees, and batch comparison.
- Its web product supports saved comparisons and shareable links.

Source: [Diffchecker official pricing](https://www.diffchecker.com/pricing/).

**Limitation**

Diffchecker is an adjacent literal/document/file-comparison utility, not evidence of demand for obfuscation-resistant supplied-corpus code similarity or provider-hosted MOSS reports.

**Inference for the product**

The price shows that comparison-tool vendors charge materially more than $15 over time, while its free tier and offline features set expectations for useful previews and privacy. It does not validate this product's one-time price.

### Beyond Compare 5

**Observed claims**

- Standard was listed at US `$35` per user and Pro at US `$70` per user.
- The license fee is a one-time purchase with no annual renewal fee; minor updates within the major version are free, and major upgrades are generally half price.
- A per-user license covers the person on any number of computers.

Source: [Scooter Software official store](https://www.scootersoftware.com/shop.php?zz=products).

**Limitation**

Beyond Compare is a mature general comparison application, not a code-similarity provider or browser extension.

**Inference for the product**

It demonstrates an established one-time developer-tool license model, but also shows that device count, update scope, and major-version policy must be explicit. Its price cannot be treated as target-audience purchase evidence.

## Chrome Web Store Commercial-Channel Facts

**Observed claims**

- Chrome requires a one-time developer registration fee before publication; the public registration page does not state the amount.
- The Chrome Web Store Developer Agreement covers free and paid products. If a developer charges, the developer assumes responsibility for transactions, authentication, records, and taxes; Google does not provide those functions.
- Chrome's distribution documentation requires in-app purchases to be disclosed in the listing configuration.

Sources: [Chrome developer registration](https://developer.chrome.com/docs/webstore/register/), [Chrome Web Store Developer Agreement](https://developer.chrome.com/docs/webstore/program-policies/terms), [Chrome distribution setup](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution).

**Unknowns**

- Current registration-fee amount, checkout provider, regional availability, tax handling, fraud cost, refund process, license restoration, and account-recovery implementation.

**Inference for the product**

The offer needs its own compliant checkout and entitlement verification. Payment, tax, fraud, refund, support, and license-server costs must be included in Prompt 006 economics; store publication itself does not supply the $15 payment system.

## Cross-Market Findings

### Observed Patterns

1. Free direct alternatives are substantial: the public non-commercial MOSS service, Dolos hosted/self-hosted options, JPlag, AutoMOSS source, and CodeGrade's qualifying free course tier.
2. A provider-hosted or secret result link is not unique; MOSS and Dolos already expose report-link workflows.
3. Local or offline processing is an explicit privacy value in JPlag, self-hosted Dolos, and adjacent Diffchecker.
4. Course-focused platforms provide corpus management beyond a one-off pair check, including prior-term comparison and report export.
5. Commercial APIs and hosted processing generally introduce recurring or undisclosed marginal cost, while the proposed offer is a one-time fee.
6. The personal adult segment is not cleanly served by every institutional product, but it can still use free MOSS, Dolos, JPlag, or general comparison tools.

### Product Implications (Inference)

- The narrow value hypothesis is reduced setup and grouping friction for authorized adults: clear Pair and Batch modes, explicit logical projects, optional base code, exact pre-transfer review, honest progress/recovery, and careful bearer-link handling.
- Modern visual design is expected but insufficient because Dolos already markets a modern, no-install web workflow.
- A durable one-time license can be viable only with bounded provider liability, near-zero marginal local processing, a separately user-funded approved provider model, or another economically proven entitlement. "Unlimited lifetime hosted checks" is unsupported.
- Provider selection must remain behind an adapter and legal/transport gates. A local engine could improve economics and privacy but would require a recorded product-architecture change and dependency-license review.
- Pricing research must test the exact bounded entitlement, not only the `$15` headline.

## Willingness-to-Pay Conclusion

**The market scan does not validate willingness to pay USD $15.** Competitor list prices show that vendors attempt to monetize adjacent and broader workflows, but they do not reveal purchases, retention, conversion, or demand among this product's qualified adult personas. Strong free direct alternatives create material price pressure, and no target-user behavior was observed in this desk scan.

The $15 one-time purchase therefore remains an unvalidated hypothesis. It must not appear as approved store or checkout copy until Prompt 003 behavioral research and Prompt 006 unit economics establish all of the following:

- qualified adults choose the bounded paid concept over both free alternatives and no purchase;
- participants accurately restate corpus, privacy, report-link, and usage limits;
- the entitlement specifies processing allowance, devices, update scope, support, refunds, taxes, hosted-service end-of-life, and remedies;
- conservative three-year contribution margin remains positive under authorized provider and support costs.

Compliments, stated interest, competitor subscription prices, or the existence of paid comparison tools are not substitutes for observed purchase choice.

## Unresolved Commercial Research Register

| ID | Open question | Required evidence | Downstream gate |
| --- | --- | --- | --- |
| MR-U01 | May a paid extension automate or bundle MOSS processing? | Written terms from the authorized commercial rights holder | Prompt 005 |
| MR-U02 | What provider/account model is permitted without sharing, pooling, or rotating credentials? | Written account, end-user, quota, and automation terms | Prompt 005 |
| MR-U03 | Is an approved encrypted submission and report route available? | Documented endpoint/transport terms and technical verification | Prompts 004-005 |
| MR-U04 | What commercial SLA, support, retention, deletion, incident, and DPA terms apply? | Executed or authoritative provider terms | Prompts 005, 007-009 |
| MR-U05 | May provider names and marks appear in a paid listing? | Written brand and attribution permission | Prompt 005 |
| MR-U06 | Do Codequiry's API, scan quotas, and resale rights match its public pages? | Written clarification resolving the page conflicts | Prompts 005-006 if considered |
| MR-U07 | What are Copyleaks' applicable source-code API economics and redistribution terms? | Written commercial quotation and terms | Prompts 005-006 if considered |
| MR-U08 | Can a bounded $15 entitlement fund payment, tax, fraud, support, updates, and provider cost for three years? | Conservative model using approved numeric terms | Prompt 006 |
| MR-U09 | Will qualified adults select this exact bounded offer over free alternatives? | Moderated prototype and behavioral price-choice evidence | Prompt 003 |

## Compact Source Register

All sources were accessed on **2026-07-29**.

| Source | Primary-source owner | Facts checked |
| --- | --- | --- |
| [MOSS official service page](https://theory.stanford.edu/~aiken/moss/) | Stanford/Alex Aiken | Service purpose, human-review warning, languages, report behavior, base code, non-commercial restriction, commercial referral, daily limit, bearer URL, approximate retention, AutoMOSS listing |
| [AutoMOSS repository](https://github.com/automoss/automoss) | AutoMOSS publishers | Web-app purpose, local/Docker setup, MIT license, absence of a documented hosted price in checked material |
| [JPlag repository](https://github.com/jplag/JPlag) and [usage wiki](https://github.com/jplag/JPlag/wiki/1.-How-to-Use-JPlag) | JPlag project | Local processing, supported workflow, runtime, CLI/API/viewer, base code, directories, exports, GPL-3.0 |
| [Dolos product](https://dolos.ugent.be/), [introduction](https://dolos.ugent.be/docs/), and [hosted workflow](https://dolos.ugent.be/docs/server.html) | Team Dodona/Ghent University | Free web app, MIT CLI/library/self-hosting, ZIP and language behavior, queue, secret links, local history, deletion and periodic removal, stated audience/privacy behavior |
| [CodeGrade feature page](https://www.codegrade.com/solutions/code-plagiarism-checker) and [Free plan](https://www.codegrade.com/landing/free) | CodeGrade | JPlag integration, comparison corpus, languages, reports/exports, free 50-student entitlement and institutional workflow |
| [Codequiry pricing](https://codequiry.com/pricing), [API pricing](https://codequiry.com/usage/api/pricing), and [product page](https://codequiry.com/) | Codequiry | Displayed plan/API prices, scan claims, peer comparison, student restriction, included surfaces, and contradictory quota text |
| [Copyleaks pricing](https://copyleaks.com/pricing), [API concept](https://docs.copyleaks.com/concepts/products/plagiarism-checker-api/), [technical specifications](https://docs.copyleaks.com/reference/data-types/authenticity/technical-specifications/), and [API page](https://copyleaks.com/api) | Copyleaks | Displayed Individual prices/credits, browser and multi-file features, source-code API scope, private collections, source extensions and size limit, sales-led API integration |
| [Diffchecker pricing](https://www.diffchecker.com/pricing/) | Diffchecker | Free tier, displayed Pro + Desktop price, offline/privacy, folder/batch comparison, web sharing |
| [Beyond Compare store](https://www.scootersoftware.com/shop.php?zz=products) | Scooter Software | Explicit US-dollar prices, one-time license, devices, minor updates and major-upgrade policy |
| [Chrome registration](https://developer.chrome.com/docs/webstore/register/), [Developer Agreement](https://developer.chrome.com/docs/webstore/program-policies/terms), and [distribution setup](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution) | Google Chrome | Registration-fee requirement, paid-product responsibility, payment/tax obligations, and in-app-purchase disclosure |

