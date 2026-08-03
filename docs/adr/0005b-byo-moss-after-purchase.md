# ADR 0005B — BYO Moss Account After Purchase

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 005 account-model refinement |
| ADR ID | ADR-0005B |
| Status | Accepted decision: **go** with **customer BYO Moss userid** |
| Decision date | 2026-08-03 |
| Supersedes (credential section) | Managed-credential selection in [`0005a-commercial-permission-go.md`](./0005a-commercial-permission-go.md) |
| Preserves from ADR-0005A | Commercial go, no pooling/rotation, no registration automation, encrypted production transport, contracts outside git |
| Review-by date | 2026-09-17 |

## Context

The product owner attests written commercial permission to operate this paid workflow and directs that **customers register their own Moss accounts after purchase**, then supply the issued numeric userid to the extension. Official Moss registration remains an email process controlled by the customer—not by Matrix-AE automation.

Public Moss materials still state that Moss itself is free and for non-commercial use, and that commercial Moss uses should contact Similix. This product’s paid wrapper/automation rights rest on the owner-attested commercial permission; the customer’s Moss userid remains their own provider identity subject to Moss’s per-user limits (including the public 100 submissions/day/user enforcement described in Prompt 004 research).

Launch audience remains adults 18+ per the product charter. “Student” in marketing colloquial use does not expand MVP scope to minors or institutional roster workflows.

## Decision

**Go — Bring-Your-Own (BYO) numeric Moss userid after purchase.**

### Post-purchase onboarding flow

1. Customer purchases the $15 personal entitlement and activates a device (≤ 2).
2. Product shows Moss registration instructions (see approved help copy below) and links to the official Moss page.
3. Customer emails `moss@moss.stanford.edu` themselves and receives a Moss account/script containing a numeric userid.
4. Customer pastes **only** the numeric userid into the product; never an email password.
5. Product stores the userid as a secret (server-side preferred; if cached locally, encrypted and never synced), validates numeric format, and uses it only on the approved encrypted submission path.
6. Product still enforces the Prompt 006 allowance (**40** hosted checks / 36-month hosted window) in addition to whatever limit Moss applies to that userid.

### Permanently forbidden

- Automating Moss registration email or scraping issued ids
- Asking for the customer’s email account password
- Shared, pooled, or rotated Moss accounts across customers
- Using Matrix-AE free/public accounts to serve paying customers
- Client-selected Moss hosts/ports or raw public TCP as production transport

## Approved help copy — Registering for Moss

Source adapted from the [official Moss service page](https://theory.stanford.edu/~aiken/moss/) (accessed for product research; wording must stay accurate). Show after purchase, before first hosted submit.

<!-- moss-registration-help:start -->
```json
{
  "schemaVersion": 1,
  "locale": "en-US",
  "title": "Register for a Moss account",
  "summary": "After purchase, you connect your own Moss userid. We never register Moss for you and we never ask for your email password.",
  "officialNotice": "Moss is provided for the educational community, is free to register, and its public service terms state it is for non-commercial use. Commercial Moss licensing is handled by Similix Corporation. This paid extension’s commercial wrapper rights are separate and are maintained by Matrix-AE under written permission.",
  "steps": [
    "Open your own email app.",
    "Send a message to moss@moss.stanford.edu.",
    "Put exactly these two lines in the body, replacing the address with yours:",
    "registeruser",
    "mail you@example.com",
    "When Moss replies with your account/script, copy only the numeric userid into this extension.",
    "If you already have a Moss account, reuse that userid—do not share it with anyone else."
  ],
  "warnings": [
    "Anyone with your Moss userid may be able to submit using your provider quota—treat it like a password.",
    "Moss enforces per-userid submission limits (publicly described as 100/day/user). This product also enforces your purchased allowance of 40 hosted checks.",
    "We are not Stanford or Moss, and this extension is not an official Stanford product."
  ],
  "primaryLinkLabel": "Official Moss information page",
  "primaryLinkUrl": "https://theory.stanford.edu/~aiken/moss/"
}
```
<!-- moss-registration-help:end -->

## Credential Model Decision (replacement)

| Model | Decision |
| --- | --- |
| Customer BYO numeric Moss userid after purchase | **Selected** |
| Managed Matrix-AE commercial credentials as default MVP | Deferred / not required for MVP onboarding |
| Shared/pooled/rotated accounts | Permanently forbidden |
| Registration automation | Forbidden |

## Encrypted-Transport Decision (unchanged)

Production submissions use only the approved encrypted route. Raw TCP to `moss.stanford.edu:7690` remains forbidden for product traffic. Missing encrypted route ⇒ no-launch.

## Economics note

BYO reduces Matrix-AE’s direct provider marginal cost versus managed credentials, but does **not** authorize unlimited checks. Prompt 006’s customer promise (40 checks, 2 devices, 36-month hosted window) remains binding. Recompute unit economics if support load rises because customers mishandle registration.

## Downstream wiring

| Artifact | Change |
| --- | --- |
| Privacy data map D-07 | Customer-supplied Moss userid secret (not Matrix-AE managed id) |
| Extension settings | “Connect Moss userid” + registration help surface |
| API | Validate numeric userid; envelope-encrypt at rest; never log full userid |
| Workers | Use per-job/per-user userid from vault; still allowlisted egress |

## Owners and Sign-Off

| Role | Decision | Date |
| --- | --- | --- |
| Product | BYO after purchase selected | 2026-08-03 |
| Engineering | Implement userid connect + help; no registration bots | 2026-08-03 |
| Compliance | Disclose Moss terms + non-affiliation; encrypted transport still required | 2026-08-03 |

## Verification Record

| Test | Coverage |
| --- | --- |
| P005B-T01–T06 | BYO selection, help copy schema, forbids, encryption (`tests/prompt-005b-byo-moss.test.js`) |
