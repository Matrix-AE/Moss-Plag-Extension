# Infrastructure (scaffold)

Deployment manifests and environment templates belong here. Never commit provider credentials,
payment secrets, or customer Moss userids.

## Hosted API cutover

Production checklist: [`../docs/engineering/deploy-api-mossworkflow.md`](../docs/engineering/deploy-api-mossworkflow.md)

| Host | Role |
| --- | --- |
| `https://api.mossworkflow.dev` | Pair jobs, vault, status, reveal |
| `https://uploads.mossworkflow.dev` | Upload payloads |

Local `npm run api:start` / `api:start:live` is for developers only. Store builds must not depend on
loopback.
