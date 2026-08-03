# Provider Onboarding, Fallback, and Kill Switches

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 074 |
| Module | `apps/api/provider/onboarding.js` |
| Credential model | BYO numeric Moss userid after purchase (ADR-0005B) |
| Related | [`credential-vault.md`](./credential-vault.md), [`commercial-enable-checklist.md`](./commercial-enable-checklist.md) |

## Onboarding Flow

1. Customer purchases and activates a device.
2. Product shows Moss registration help (customer emails Moss themselves).
   Popup gate `moss-id` renders the legacy two-line body (`registeruser` / `mail <email>`) via
   `@moss/ui/moss-id` — the extension never auto-sends mail.
3. Customer pastes **only** the numeric userid.
4. `connect` validates numeric format, stores encrypted/local-vault ref, returns **masked** display.
5. Comparison portal unlocks only after a connected Moss userid (`resolveOnboardingGate`).
6. `replace` / `deleteCredential` are tenant-scoped (IDOR denied).

## Forbidden Automation

- Automated Moss registration
- Email password requests
- Shared/pooled credential rotation
- Silent processor/adapter switches (material changes require new disclosure/consent)

## Kill Switch and Disabled Mode

Operations can `tripKillSwitch` without an emergency client release:

- New submissions blocked (`provider-disabled`)
- Drafts and existing report links preserved
- Support path remains open
- Maintenance copy explains temporary unavailability
- `clearKillSwitch` re-enables after review

## Adapter Selection

Allowed adapters: `mock`, `commercial-encrypted`. Silent switches are rejected. Changing adapters requires new disclosure/consent.

## Stale Clients

Clients with outdated consent versions receive `consent-upgrade-required` while drafts are preserved.

## Verification

`tests/prompt-074-provider-onboarding.test.js`
