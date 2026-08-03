# Extension State and Message Architecture

## Document Control

| Field | Value |
| --- | --- |
| Delivery prompt | Prompt 024 — Extension State and Message Architecture |
| Status | Accepted |
| Implementation | `apps/extension/state/*.cjs`, `apps/extension/src/shared/messages.ts` |
| Verification | `tests/prompt-024-extension-state.test.js` |

## Ownership

| Surface | Owns | Must not own |
| --- | --- | --- |
| Popup / workspace / settings | Ephemeral UI, in-memory `File` handles | Durable job truth, draft recovery |
| Service worker | Message routing, alarm-driven purge | Authoritative session memory |
| `storage.local` | Source of truth for draft shells and opaque job ids | Sync replicas, source bytes |
| API client | Transient network calls | Local persistence of secrets or source |

Worker memory is deliberately discarded. Every `state/*` handler reloads through `createStateStore`,
which never treats in-worker scratch as authoritative.

## Persisted schema (`moss.state`)

```json
{
  "schemaVersion": 1,
  "shell": { "installedAt": 0 },
  "draft": {
    "draftId": "opaque",
    "mode": "pair|batch",
    "language": "python",
    "groupCount": 2,
    "flags": { "includeBaseCode": false },
    "createdAt": 0,
    "updatedAt": 0
  },
  "activeJob": {
    "jobId": "opaque",
    "status": "queued",
    "mode": "pair",
    "language": "python",
    "submissionIdempotencyKey": "opaque",
    "updatedAt": 0,
    "terminalAt": null,
    "reportUrlRef": "opaque-optional"
  }
}
```

Forbidden persisted keys (enforced recursively): title, label(s), name(s), path(s), hash(es),
source, File/file/files, displayName, filename(s), reportUrl, content, bytesContent, mossUserId.

## TTL and purge

| Record | TTL | Extra purge points |
| --- | --- | --- |
| Draft shell | 24 hours from `updatedAt` | Discard action, bind-job / upload start |
| Active job after terminal status | 24 hours from `terminalAt` | Manual `state/purge`, hourly alarm |

## Messages (allowlist)

| Action | Payload | Effect |
| --- | --- | --- |
| `shell/ping` | — | Liveness |
| `shell/open-workspace` | — | Focus Side Panel recovery hook (does not open a workspace tab) |
| `shell/status` | — | Coarse installed/draft/job flags |
| `state/get` | — | Load + migrate + purge, return state |
| `state/save-draft` | draft shell | Validate and persist |
| `state/discard-draft` | — | Clear draft |
| `state/bind-job` | opaque job | Bind job, discard draft; same idempotency key reopens without duplicating |
| `state/update-job` | status patch | Update bound job only |
| `state/purge` | — | Force TTL purge |

Unknown actions and malformed envelopes return `{ ok: false, error }` and never throw into the UI.

## Migrations

| From | To | Behaviour |
| --- | --- | --- |
| empty / missing | v1 | Write empty state |
| Prompt 023 `shellInstalledAt` key | v1 | Promote into `shell.installedAt` |
| Valid v1 | v1 | Validate in place |
| Corrupt / unknown schema | v1 | Reset to empty (never invent sensitive recovery) |

## Reopen without duplicate submission

`state/bind-job` compares `submissionIdempotencyKey`. If a non-terminal job with the same key is
already bound, the router returns that binding with `rebound: true` and `duplicated: false`. A
different in-flight job is rejected with `active-job-exists`.

## Storage backend

Only `storage.local`. Attempts to construct the store against any other backend throw. Sync storage
is forbidden because drafts and job ids must not leave the device profile unexpectedly.
