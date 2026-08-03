# Customer Offer v2 — Revalidated $15 Promise

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 073 — Revalidate the Exact $15 Customer Promise |
| Status | Accepted: **go** |
| Offer version | **2.0.0** |
| Module | `apps/api/commerce/customer-offer.js` |
| Supersedes (numeric allowance) | Prompt 006 modeled **40** checks in [`offer-and-unit-economics.md`](./offer-and-unit-economics.md) |
| Preserves | USD $15 price, 2 devices, 36-month hosted window, 14-day unused refund |
| Final load/cost gate | Prompt 095 required before launch |

## Exact Customer Promise (v2)

One USD **$15** one-time purchase buys:

| Element | Term |
| --- | --- |
| Price | USD $15 one-time |
| Included runs | **15** hosted similarity checks |
| Files per run | max **2** files |
| Devices | **2** activated devices |
| Feature entitlement | Non-expiring personal license to purchased core features |
| Hosted operability | **36 months** from purchase for new hosted checks |
| Shutdown remedy | Disable new hosted checks; retain metadata history; documented export/pivot notice |
| Updates | Current major via store/auto-update; next major may require paid upgrade |
| Refunds | **14 days** if hosted runs remain unused |
| Interpretation | Similarity report link — not a plagiarism verdict |

Forbidden: vague fair use, hidden throttle, unlimited lifetime hosting, account evasion, dependence on unavailable beta data.

## Unit Economics (planning assumptions)

| Scenario | Runs | Margin/sale | Gate |
| --- | --- | --- | --- |
| Conservative | 15 | > 0 | Pass |
| Expected | 8 | > 0 | Pass |
| Worst-case | 15 | > 0 | Pass |

Decision: **go**. Product/finance must re-run Prompt 095 on deployed load/cost before launch. Sensitivity: max provider cost per run is computed in `evaluateOfferEconomics().sensitivity`.

## Downstream Surfaces Driven by Offer v2

Capability config, quota rules, terms, checkout copy, support policy, and financial reserve all read `downstreamParameters()` from this module — one approved version only.

## Verification

`tests/prompt-073-customer-offer.test.js`
