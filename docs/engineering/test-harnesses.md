# Test Infrastructure and Protocol Harnesses

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 020 |
| Module | `packages/testing/harness.js` |
| Status | Accepted offline placeholder harness |

## Layers

| Layer | Offline | Live Moss |
| --- | --- | --- |
| Unit | yes | never |
| Contract | yes | never |
| Component | yes | never |
| Extension E2E | yes (fake API) | never in CI |
| API integration | yes (memory queue/db fakes) | never |
| Worker | yes (fake transport) | never |
| Protocol TCP harness | placeholder now | full mock in Prompt 055 |

## Rules

- CI sets no Moss credentials and must not open egress to `moss.stanford.edu`.
- Authorized manual smoke remains outside default `npm test`.
- Seeded defect: fake transport returns `ambiguous` on timeout mode for recovery tests.

## Verification

`tests/prompt-020-harness.test.js`
