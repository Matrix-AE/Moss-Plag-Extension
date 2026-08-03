# Entitlements, Webhooks, and License Tokens

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 079 |
| Module | `apps/api/commerce/entitlements.js` |
| Offer | v2.0.0 ($15 / 15 runs / max 2 files) |
| Payment ADR | [`../adr/0075-payment-merchant-architecture.md`](../adr/0075-payment-merchant-architecture.md) |

## Threat Model

Extension code is inspectable. Local booleans, embedded keys, and universal codes are ineffective. Backend endpoints enforce allowance, device binding, and status even when clients are altered.

## Webhooks

- HMAC-SHA256 over `{timestamp}.{body}` with server-only webhook secret
- Reject bad signatures, altered payloads, replays (event id), and clock skew (> 300s)
- Process idempotently; duplicate `sessionId` purchases converge without double-crediting

## Entitlement Transitions

| Event | Effect |
| --- | --- |
| `checkout.session.completed` | Active entitlement with 15 runs |
| `charge.refunded` | Status `refunded`, remaining 0 |
| `charge.dispute.created` | Status `disputed`, remaining 0 |
| Support override | Audited status/remaining change |

## License Tokens

Short-lived, scoped tokens (`userId` + optional `deviceId`). Verification rejects wrong-user, device mismatch, expiry. Optional offline grace is explicit and versioned (default **0**).

## Constraints

- Never ship signing/processor secrets
- Client-claimed remaining counts are always rejected
- Auditable transition log without source bytes

## Verification

`tests/prompt-079-entitlements-webhooks.test.js`
