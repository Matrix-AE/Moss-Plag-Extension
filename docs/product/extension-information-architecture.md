# Extension Information Architecture

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 025 — Extension Information Architecture |
| Status | Accepted |
| Surfaces | Popup (320×520), Workspace (≥880×720), Settings (tab) |
| Traceability | MVP workflows W-01–W-04, US-01–US-08, R-001–R-017 |
| Verification | `tests/prompt-025-information-architecture.test.js`, live IA walkthrough |

## Hierarchy

```
Popup (launcher)
├── Status glance (draft / active job / idle)
├── Primary CTA → Open workspace
└── Secondary → Settings

Workspace (task surface — single scroll, no deep nav)
├── Step rail: Select → Group → Configure → Review → Paywall → Progress → Result
├── Primary action always visible in sticky footer
└── Progressive disclosure panels (base code, advanced limits)

Settings (account & policy)
├── Network origins
├── Permissions in use
├── Similarity account (BYO after purchase)
└── Privacy / forget-link / discard drafts
```

Depth rule: at most **one** level beneath the surface. Grouping, consent, payment, and recovery never open a second nested route; they swap the workspace step.

## Popup vs workspace

| Concern | Popup | Workspace |
| --- | --- | --- |
| Job | Open / resume only | Full edit, consent, pay, progress |
| Draft | Show mode + group count | Edit groups and settings |
| Errors | Short status + “Open workspace” | Full recovery copy and actions |
| Payment | Never | Only on Review → Paywall step |
| Primary action | Open workspace | Context-specific (Continue / Confirm / Pay & upload / Open report) |

## Progressive disclosure

| Always visible | Revealed on demand | Never icon-only |
| --- | --- | --- |
| Mode (Pair/Batch), primary CTA, consent checkboxes when on Review | Base-code picker, byte/group limits, BYO userid help | Discard draft, forget report link, cancel in-flight job, “files leave this device” |

Privacy and destructive actions use **text buttons** with consequence copy in the same viewport. Ambiguous icons alone are forbidden for those actions.

## Synthetic / local preview

| Mode | What the user can do | What never happens |
| --- | --- | --- |
| Free demo | Walk Pair/Batch with synthetic fixtures; see Review + fake progress/result | Upload, charge, provider contact |
| Local draft | Select real files, group, configure; persist metadata-safe draft (Prompt 024) | Transfer or payment until Review → Paywall |

Demo and draft share the same step rail so first-run learning transfers to paid use.

## Final-review → paywall transition

1. **Review** — groups, language, disclosures, authority + processing consent (R-006, R-007).
2. Only after both consents: **Continue to payment**.
3. **Paywall** — $15 offer summary (devices, hosted checks, EOL, refund). No upload yet.
4. On successful entitlement: **Pay & upload** becomes available and starts the job.
5. Closing the popup during Paywall loses nothing durable except the in-memory `File` handles; draft shell remains if files were already staged earlier (re-select may be required — copy says so).

Payment is **never** shown before Review, and never in the popup.

## Keyboard order

Shared order across popup and workspace:

1. Skip to primary action (visually hidden link in workspace)
2. Step rail / status badge
3. Main content controls top→bottom, left→right
4. Progressive-disclosure toggles
5. Sticky footer: secondary actions, then **primary CTA**
6. Settings link last in popup; account section last in settings

Consent checkboxes are in tab order **before** the Continue button. Destructive actions are never before the primary CTA in the same focus group.

## Wireframes

Target sizes: popup **320×520**, workspace **880×720**. Each frame lists the primary action and recovery path.

### WF-01 First use — idle popup

```
┌─ 320 ─────────────────────┐
│ Code Similarity Workflow  │
│ [Ready]                   │
│ Start a Pair or Batch     │
│ check in the workspace.   │
│ ┌───────────────────────┐ │
│ │ No active check       │ │
│ └───────────────────────┘ │
│ [ Open workspace ]  ←P    │
│ [ Settings ]              │
└───────────────────────────┘
```

Entry: install → click action. Recovery: reopen popup → same CTA.

### WF-02 Return use — draft present

```
┌─ 320 ─────────────────────┐
│ … Workflow        [Ready] │
│ ┌───────────────────────┐ │
│ │ Draft saved           │ │
│ │ pair · 2 groups       │ │
│ └───────────────────────┘ │
│ [ Resume in workspace ] ←P│
│ [ Settings ]              │
└───────────────────────────┘
```

Entry: popup status. Recovery: Resume → Workspace Select/Group with shell restored.

### WF-03 Free demo / local draft — workspace Select

```
┌─ 880 ──────────────────────────────────────────┐
│ Similarity workspace          Demo | Local draft│
│ Select → Group → Configure → Review → …         │
│ ┌ Pair ○  Batch ○ ┐  [Load demo fixtures]      │
│ Drop or choose submissions (supported sources) │
│ … file list …                                  │
│ Footer: [Discard]              [ Continue ] ←P │
└────────────────────────────────────────────────┘
```

Entry: Open workspace. Recovery: Discard clears draft; Continue blocked until ≥2 groups with files.

### WF-04 Pair grouping

Workspace Group step with exactly two submission slots. Primary: Continue. Recovery: E-ONE / E-EMPTY banners with text, not icons.

### WF-05 Batch grouping

Same rail; N≥2 group cards; “Add group”. Flat twenty-file drop stays grouped (E-FLAT). Primary: Continue.

### WF-06 Configure (+ base code disclosure)

Language select, optional “Mark base code” disclosure. Primary: Continue to review.

### WF-07 Review + consent (pre-paywall)

```
│ Review this exact corpus                       │
│ Groups / language / file counts (no source)    │
│ ☑ I have authority to submit these files       │
│ ☑ I understand files leave this device         │
│ [Back]              [ Continue to payment ] ←P │
```

Primary disabled until both boxes checked (E-CONSENT).

### WF-08 Paywall (payment only before upload)

```
│ Unlock hosted checks — $15                     │
│ 2 devices · 40 hosted checks · EOL / refund    │
│ Files have not been uploaded yet.              │
│ [Back to review]     [ Pay & unlock upload ] ←P│
```

Entry: only from Review with consent. Recovery: Back keeps draft; no charge.

### WF-09 Accounts — settings / BYO

```
│ Similarity account                             │
│ After purchase, connect your numeric Moss id   │
│ (ADR-0005B help copy). Never email/password.   │
│ [ Connect account ]                            │
```

Entry: Settings. Recovery: disconnect / discard drafts as text actions.

### WF-10 Processing

Progress step with status from opaque job id. Primary: “Open workspace” from popup; in workspace primary is disabled (“Working…”). Recovery: E-TIMEOUT / E-OFFLINE panels with explicit safe actions.

### WF-11 Results

Result card with opaque report open/copy, bearer-secret + human-review warnings, **Forget link** as labeled text button. Primary: Open report.

### WF-12 Failures

Dedicated failure step (offline-before-send / sent-without-result / invalid files / mixed language). Primary recovery action is the left-most labeled button; never a sole icon.

## Requirement → entry → recovery map

| ID | Requirement (short) | Entry | Recovery |
| --- | --- | --- | --- |
| R-001 | Pair check | Workspace mode → Pair | WF-04; E-ONE banner |
| R-002 | Batch check | Workspace mode → Batch | WF-05; add group |
| R-003 | Multi-file groups | Group step | E-FLAT keep groups |
| R-004 | Base code | Configure disclosure | Unmark via text control |
| R-005 | One language | Configure | E-MIXED block |
| R-006 | Pre-submit review | Review step | Back to Group/Configure |
| R-007 | Consent | Review checkboxes | E-CONSENT block |
| R-008 | Report link only | Result step | Forget-link text action |
| R-009 | Similarity wording | All result copy | — |
| R-010 | Offline / timeout | Progress/Failure | Distinct panels; no blind retry |
| R-011 | Unsupported formats | Select | E-INVALID reject |
| R-014 | Draft recovery | Popup resume | Discard draft text |
| R-015 | Popup + workspace | Action icon / Open | WF-01/02 |
| US-08 | Free demo | Load demo fixtures | No upload/payment |
| Paywall | Payment before upload | WF-08 only after Review | Back; no upload |
| Account | BYO after purchase | Settings | Disconnect text |

## Live walkthrough checklist

Walk at 320×520 and 880×720:

1. First-use popup → workspace demo fixtures → Review (consent) → confirm Paywall is reachable only then → stop without paying.
2. Local draft Pair → close popup → reopen → Resume.
3. Batch + flat files → groups preserved.
4. Consent incomplete → Continue disabled.
5. Offline failure copy → no “retry send”.
6. Result warnings + Forget link labeled.
7. Settings account help visible as text.

### Verification record

| ID | Result |
| --- | --- |
| P025-L01 | Live facilitator walk on 2026-08-03 at `http://127.0.0.1:4175/`: early paywall blocked (`paywall-too-early`); Review primary disabled until consents; after grant, Paywall WF-08 showed “Files have not been uploaded yet” and “Pay & unlock upload”. No provider traffic. |

## Prototype

Executable scenario map: `docs/product/research/ia-prototype/ia-model.js`  
Facilitator UI: `docs/product/research/ia-prototype/index.html`
