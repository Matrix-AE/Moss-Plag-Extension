# $15 Offer and Unit-Economics Gate

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 006 — Define the $15 Offer and Unit-Economics Gate |
| Status | Accepted: **go** under labeled cost assumptions |
| Effective date | 2026-08-03 |
| Commercial gate | [`../adr/0005a-commercial-permission-go.md`](../adr/0005a-commercial-permission-go.md) |
| Executable model | [`offer-economics-model.js`](./offer-economics-model.js) |
| Review-by date | 2026-09-17 or when executed provider fee schedule arrives |

## Exact Customer Promise

One USD **$15** one-time purchase buys all of the following and nothing more:

| Promise element | Exact term |
| --- | --- |
| Price | USD $15 one-time personal purchase |
| Feature entitlement | Non-expiring personal license to the purchased core similarity-workflow feature set |
| Devices | **2** activated devices |
| Hosted similarity checks | **40** included provider-backed checks during the hosted operability window |
| Hosted operability / EOL | **36 months** from purchase for new hosted checks; afterward new hosted checks stop |
| EOL remedy | Disable new hosted checks; retain metadata-only local/server history per privacy rules; provide documented export or pivot notice — not unlimited lifetime hosting |
| Updates | Current major version included via store/auto-update; next major may require a paid upgrade |
| Refunds | **14 days** if hosted checks remain unused; after first hosted check consumption, refunds follow published support policy only |
| Interpretation | Product returns a provider-hosted **similarity report** link; it does not prove plagiarism |
| Transport | Hosted checks run only over the approved encrypted commercial route |

Forbidden promises: unlimited checks, lifetime hosted processing, hidden throttling marketed as unlimited, account-limit evasion, permanent report availability, or free public Moss as the commercial backend.

## Unit-Economics Model

Costs are **planning assumptions** until finance replaces them with executed provider quotes. The executable model in `offer-economics-model.js` computes three-year contribution margin per sale.

| Scenario | Checks modeled | Provider $/check | Payment/tax | Hosting/support/fraud (3y) | Refund rate | Margin/sale | Gate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Conservative | 40 | 0.20 | 1.20 | 3.50 | 8% | **+$1.10** | Pass (> 0) |
| Expected | 18 | 0.08 | 0.90 | 2.00 | 4% | **+$10.06** | Pass |
| High-use stress | 40 | 0.20 | 1.20 | 4.50 | 10% | **−$0.20** | Stress fail |

### Decision

**Go** — sell the bounded $15 offer because conservative and expected three-year contribution margins are greater than zero under the labeled assumptions.

High-use stress is monitored: if realized provider cost or support load pushes margin ≤ 0 at full allowance consumption, finance must reprice, reduce allowance, or pivot before expanding acquisition spend.

### Downstream parameters locked for later prompts

| Parameter | Value |
| --- | --- |
| `numericHostedAllowance` | 40 |
| `deviceLimit` | 2 |
| `hostedOperabilityMonths` | 36 |
| `requiresEncryptedTransport` | true |
| `forbidsUnlimitedLifetimeHosting` | true |
| `forbidsAccountLimitEvasion` | true |
| Architecture implication | Hosted relay remains viable for Prompt 010 only while ADR-0005A and these economics hold |

## Sensitivity Rules

1. If executed provider cost per check exceeds **$0.225** at full 40-check consumption with other conservative costs unchanged, margin ≤ 0 → reprice or reduce allowance before Prompt 010.
2. Do not raise the published allowance without recomputing `evaluateGate()`.
3. Do not advertise unused capacity as unlimited.
4. Replace assumption tables within 14 days of receiving executed commercial fee schedules.

## Verification Record

| Test | Coverage |
| --- | --- |
| P006-T01–T08 | Offer terms, margin math, go decision, forbidden promises (`tests/prompt-006-offer-economics.test.js`) |
| P006-V01 | Recompute conservative/expected margins live via Node model |

P006-V01 passed on 2026-08-03 by executing `node -e "console.log(require('./docs/product/offer-economics-model.js').evaluateGate())"`.
