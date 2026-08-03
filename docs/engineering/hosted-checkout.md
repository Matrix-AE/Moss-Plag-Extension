# Secure Hosted Checkout

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 080 |
| Module | `apps/api/commerce/checkout.js` |
| Offer | v2.0.0 |
| Terms / privacy / consent | Prompts 076–078 |
| Entitlements | Prompt 079 |

## Flow

1. User reaches checkout only from final review (local draft intact).
2. Server creates hosted Checkout Session bound to customer, product, price, and offer version — **client price ignored**.
3. Display tax note, refund window, allowance, and terms version.
4. Handle success, cancel, decline, duplicate webhook, and delay.
5. Return to intact local review; **do not** auto-start job/upload.
6. First authenticated job/upload starts only after explicit confirm **and** active entitlement.

## Constraints

- Trust no client price/entitlement
- Allowlist return origins
- Log no checkout secret or payment detail
- **Zero pre-entitlement** job or source upload

## Verification

`tests/prompt-080-hosted-checkout.test.js`
