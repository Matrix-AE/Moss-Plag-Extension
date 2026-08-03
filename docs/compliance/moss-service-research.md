# Official MOSS Service and Protocol Research

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 004 — Official MOSS Service and Protocol Verification |
| Status | Research complete for planning; human review required before any live traffic |
| Source access date | 2026-08-03 |
| Method | Read-only retrieval of primary public sources; no account registration; no MOSS TCP/submission traffic |
| Product charter | [`../product/product-charter.md`](../product/product-charter.md) |
| MVP PRD | [`../product/mvp-prd.md`](../product/mvp-prd.md) |
| Next gate | Prompt 005 commercial permission and account strategy ADR |

Evidence labels used below:

- **Verified** — stated by a dated primary source linked in this document.
- **Client-observed** — visible in the official public Perl client or scripts index; not independently confirmed by the service homepage prose.
- **Unverified / inferred** — derived from legacy client behavior or secondary clients; must not drive product claims until corroborated in writing or by authorized testing.
- **Unknown** — not established by the checked public sources.

## Primary Sources Consulted

| ID | Source | Owner | Accessed |
| --- | --- | --- | --- |
| S1 | [Official MOSS service page](https://theory.stanford.edu/~aiken/moss/) | Stanford / Alex Aiken | 2026-08-03 |
| S2 | [Official Moss submission scripts index](http://moss.stanford.edu/general/scripts.html) | Stanford Moss service | 2026-08-03 |
| S3 | [Official public Perl client (`mossnet`)](http://moss.stanford.edu/general/scripts/mossnet) | Stanford / UC Regents copyright notice in script | 2026-08-03 |
| S4 | [Similix Corporation site](https://www.similix.com/) | Similix Corporation | 2026-08-03 |

No live sockets were opened to `moss.stanford.edu:7690`. No registration email was sent. No result URLs were fetched.

## Verified Service Facts

### Purpose and interpretation

| Fact | Label | Source |
| --- | --- | --- |
| Moss measures software similarity and is commonly used for programming-class plagiarism review support. | Verified | S1 |
| Moss does not automatically determine plagiarism; a human must inspect highlighted code. | Verified | S1 |
| Similarity scores are not proof of plagiarism. | Verified | S1 |
| Relying solely on similarity scores is a misuse of Moss. | Verified | S1 |

### Acceptable use and commercial boundary

| Fact | Label | Source |
| --- | --- | --- |
| Anyone may obtain a Moss account. | Verified | S1 |
| Moss is for non-commercial use. | Verified | S1 |
| Commercial uses of Moss require contacting Similix Corporation. | Verified | S1 |
| Public materials checked here do not grant a paid browser extension rights to automate, resell, or bundle Moss. | Verified (negative) | S1, S4 |

S4 resolved to a nearly empty public page on the access date and did not publish self-serve commercial terms, pricing, TLS endpoints, SLA, or reseller rights. Written commercial terms remain unknown.

### Registration and accounts

| Fact | Label | Source |
| --- | --- | --- |
| Registration is performed by emailing `moss@moss.stanford.edu`. | Verified | S1 |
| The registration body must appear as `registeruser mail username@domain`. | Verified | S1 |
| Account registrations remain email-based; the email-based *submission* service has been discontinued. | Verified | S2 |
| Users replace a lost script by obtaining a new account or copying the current script and transferring the numeric `$userid`. | Verified | S2 |
| The placeholder userid in the published script is numeric (`987654321`). | Client-observed | S2, S3 |

### Quotas and capacity

| Fact | Label | Source |
| --- | --- | --- |
| The service enforces a limit of 100 submissions per day per user. | Verified | S1 (Nov 13, 2022 update) |
| Overload can cause connection or result difficulties; users are told to retry later. | Verified | S1 |
| No SLA, uptime commitment, or concurrency contract appears on the checked official pages. | Verified (negative) | S1, S2 |

### Languages (homepage prose)

Homepage prose on 2026-08-03 lists:

> C, C++, Java, C#, Python, Visual Basic, Javascript, FORTRAN, ML, Haskell, Lisp, Scheme, Pascal, Modula2, Ada, Perl, TCL, Matlab, VHDL, Verilog, Spice, MIPS assembly, a8086 assembly, a8086 assembly, HCL2.

| Fact | Label | Source |
| --- | --- | --- |
| The homepage language list is the user-facing registry to prefer for product capability claims. | Verified policy choice | S1 |
| The homepage text repeats “a8086 assembly” and does not publish protocol language codes next to each name. | Verified | S1 |
| Mapping display names to protocol codes is not fully specified by the homepage. | Unknown from S1 alone | S1 |

### Results, privacy, and retention

| Fact | Label | Source |
| --- | --- | --- |
| Results are HTML pages listing similar pairs and highlighting matching passages. | Verified | S1 |
| Results contain copies of submitted code accessible to anyone with the result URL. | Verified | S1 |
| Stanford assumes no liability for submissions. | Verified | S1 |
| Result URLs contain a random integer and are intended only for the submitter. | Verified | S1 |
| Result directories are not intended to be browsed or indexed by robots. | Verified | S1 |
| Results are typically deleted after about 14 days and may be deleted earlier under load. | Verified | S1 |
| Deleted results can be regenerated only by resubmitting the job. | Verified | S1 |

### Base code and shared matches

| Fact | Label | Source |
| --- | --- | --- |
| Moss can eliminate matches to expected shared code such as libraries or instructor-supplied code. | Verified | S1 |
| Base-file elimination improves results but is not usually necessary for useful information. | Client-observed | S3 |
| Base-file support does not guarantee that every expected false positive is removed. | Product inference aligned with charter; not a homepage absolute | S1 + charter |

## Client-Observed Protocol Notes

These notes come from the published `mossnet` script and scripts index. They describe the **public legacy client**, not a written Stanford API contract. Treat them as implementation research until Prompt 005 authorizes a transport and Prompt 013+ hardens an adapter.

### Transport

| Observation | Label | Source |
| --- | --- | --- |
| Default peer is `moss.stanford.edu` port `7690` over TCP. | Client-observed | S3 |
| The published client uses raw TCP sockets (`IO::Socket::INET`) with no TLS. | Client-observed | S3 |
| Whether any commercial or alternate endpoint offers TLS is unknown from public pages. | Unknown | S1–S4 |
| Client-selected arbitrary hosts/ports exist as hidden `-s`/`-p` overrides for script testing. | Client-observed | S3 |
| Product architecture must not expose client-selected provider host/port controls. | Product constraint from plan/threat model | Plan |

### Command sequence (legacy client)

Observed order after connect:

1. `moss <userid>`
2. `directory <0|1>`
3. `X <0|1>` (experimental server flag)
4. `maxmatches <N>`
5. `show <N>`
6. `language <code>` then read `yes`/`no`
7. zero or more `file <id> <lang> <size> <filename>` plus raw file bytes
8. `query 0 <comment>`
9. read one response line (expected to be the result URL)
10. `end`

| Observation | Label | Source |
| --- | --- | --- |
| Authentication is a single numeric userid token in the first command. | Client-observed | S3 |
| Base files are uploaded with file id `0`. | Client-observed | S3 |
| Ordinary files are uploaded with ascending ids starting at `1` in the official script. | Client-observed | S3 |
| Directory mode is a boolean flag; the official script still increments file ids per path and relies on directory semantics described in comments. | Client-observed / partially unverified server behavior | S3 |
| Defaults in the script: language `c`, maxmatches `10`, show `250`, directory off, experimental off. | Client-observed | S3 |
| Comments are attached via `query 0 <comment>`. | Client-observed | S3 |
| Control-character rejection for userid/comment/filename is not implemented in the published script. | Client-observed defect | S3 |

### Grouping rules (legacy client comments)

| Rule | Label | Source |
| --- | --- | --- |
| Without `-d`, each file is treated as its own program. | Client-observed | S3 |
| With `-d`, files in a directory are taken as part of the same program and matches are organized by directory. | Client-observed (comment contract) | S3 |
| Exact server-side grouping algorithm, path normalization, and Windows path behavior are not specified beyond the client comments. | Unverified | S3 |
| Product logical submissions must not trust user-controlled paths alone; explicit group membership remains required. | Product constraint | MVP PRD R-003 |

### Language-code registry divergence

| Registry | Codes / names observed | Label |
| --- | --- | --- |
| Homepage prose (S1) | Display names including TCL, Verilog, HCL2; repeats a8086; no `ascii`/`prolog`/`plsql` codes shown | Verified display list |
| `mossnet` `@languages` (S3) | `c cc java ml pascal ada lisp scheme haskell fortran ascii vhdl perl matlab python mips prolog spice vb csharp modula2 a8086 javascript plsql` | Client-observed; **no `verilog`** |
| Community Node client README (secondary; not primary policy) | Adds `verilog` among codes | Secondary only; not authoritative |

| Implication | Label |
| --- | --- |
| Product must treat language capability as dated provider configuration, not a hard-coded forever list. | Verified process requirement |
| Do not ship UI claims for a language until the approved provider configuration confirms both display name and protocol code. | Product constraint |
| Homepage vs `mossnet` divergence (for example Verilog/HCL2/TCL vs script codes) is an open verification item. | Unknown / open |

## Implementation Assumptions (Not Yet Product Truth)

| ID | Assumption | Why it is only an assumption | Downstream owner |
| --- | --- | --- | --- |
| A-01 | Public Moss remains reachable at `moss.stanford.edu:7690` for authorized non-commercial clients. | Observed only in legacy client; no authorized product traffic performed. | Prompt 005 + adapter |
| A-02 | Official credentials are numeric user ids replaced into `$userid`. | Scripts index and placeholder support this; format validation rules beyond “number in script” are unpublished. | Prompt 005 |
| A-03 | One successful query response line is a bearer result URL. | Client prints the server’s first post-query line; URL scheme/host allowlist is not formally published beyond historical use. | Prompts 005, 009 |
| A-04 | Directory mode plus path naming can represent multi-file projects. | Client comments claim it; server edge cases unverified. | Prompts 011, adapter |
| A-05 | Base files via id `0` match homepage “eliminate expected shared code” behavior. | Compatible reading of S1+S3; not independently retested here. | Adapter tests with mock only until authorized |
| A-06 | Experimental (`X 1`) server must stay off for production. | Client warns of instability; no product need established. | Architecture defaults |

## Policy Risks

| ID | Risk | Severity | Notes |
| --- | --- | --- | --- |
| PR-01 | Launching a paid extension against the public non-commercial service without written rights. | Launch-blocking | S1 explicitly restricts commercial use. |
| PR-02 | Using free/BYO accounts, pooling, or rotation to support paid customers. | Launch-blocking | Evades the enforced 100/day/user limit and violates charter. |
| PR-03 | Sending source over raw TCP without an approved encrypted route. | Launch-blocking for self-serve confidential code | Public client has no TLS; commercial TLS unknown. |
| PR-04 | Treating bearer report URLs as private or revocable from the extension. | High | S1 states anyone with the URL can access copies. |
| PR-05 | Promising 14-day report availability. | High | S1 says typically ~14 days and may delete earlier. |
| PR-06 | Shipping a stale language list that disagrees with the homepage or commercial endpoint. | Medium | Homepage and `mossnet` already diverge. |
| PR-07 | Automating registration emails or scraping issued ids. | High | Registration is a user/email process; automation is outside MVP and likely policy-hostile. |
| PR-08 | Using Stanford/Moss marks in paid store copy without brand permission. | High | No public brand license found in S1–S4. |

## Open Questions Requiring Written Clarification

These must be answered under Prompt 005 before provider-dependent implementation or sale.

| ID | Question |
| --- | --- |
| Q-01 | May a paid browser extension submit similarity jobs on behalf of customers? |
| Q-02 | Is customer-supplied (BYO) numeric Moss userid allowed inside a commercial paid wrapper? |
| Q-03 | Is a managed commercial identity allowed, and may it be shared across licensed customers? |
| Q-04 | What exact event consumes one of the 100 daily submissions, and what is the reset timezone/window? |
| Q-05 | What file-count, byte-size, concurrency, and automation limits apply commercially? |
| Q-06 | Is TLS (or another approved encrypted transport) available for submission and report access; which hosts/ports/URL schemes are authorized? |
| Q-07 | What retention, deletion, incident, DPA, and support terms apply? |
| Q-08 | May the product deep-link to result pages, and may it programmatically fetch/inspect them? |
| Q-09 | What fees and quotas make a bounded $15 entitlement sustainable? |
| Q-10 | May “Moss,” “MOSS,” or Stanford names/marks appear in the paid listing, and what disclaimer is required? |
| Q-11 | What is the authoritative protocol language-code registry for the approved endpoint, including Verilog/HCL2/TCL/ascii/prolog/plsql? |
| Q-12 | Confirm directory-mode grouping semantics for nested paths, archives expanded client-side, and duplicate basenames. |

## Product Implications for Downstream Prompts

1. Prompt 005 starts from a default of **no commercial use of public Moss** until written rights exist.
2. Prompt 006 cannot assume unlimited or public-Moss-backed lifetime hosting.
3. Language UI must remain configuration-driven after an approved registry is fixed.
4. Result UX must keep bearer-link and estimated-availability warnings from the charter.
5. CI and local tests must continue using a mock provider; live Moss smoke tests require separate human authorization.
6. Raw TCP to `moss.stanford.edu:7690` is research input only, not an approved production architecture.

## Verification Record

| Test | Coverage |
| --- | --- |
| P004-T01–T10 | Structure, evidence labels, source links, quota/commercial/privacy facts, protocol notes, open questions, no-traffic attestation (`tests/prompt-004-moss-service-research.test.js`) |
| P004-V01 | Manual/automated recheck of material claims against S1–S3 on 2026-08-03 via read-only HTTP(S) fetches (`node scripts/verify-moss-sources.js`) |
| P004-V02 | Human review required before any live Moss traffic or managed-account implementation |

P004-V01 passed on 2026-08-03. No MOSS TCP traffic occurred.

### No-traffic attestation

Prompt 004 research performed on 2026-08-03 did **not**:

- open a TCP connection to port 7690;
- send `moss`, `file`, or `query` commands;
- register a Moss account;
- download or open a real Moss result URL containing submitted code.

Any future live verification must be separately authorized, quota-aware, non-sensitive, and recorded outside ordinary product fixtures.
