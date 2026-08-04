# API app

HTTPS / loopback HTTP API for auth, jobs, entitlement, signed uploads, and BYO Moss userid vaulting.

## Local pair-check server

```bash
npm run start --workspace @moss/api
# or from repo root:
npm run api:start          # mock MOSS loopback (default)
npm run api:start:live     # gated public TCP to moss.stanford.edu:7690
```

Listens on `http://127.0.0.1:8787` by default for local development.

Production deploy checklist: [`../../docs/engineering/deploy-api-mossworkflow.md`](../../docs/engineering/deploy-api-mossworkflow.md).

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Liveness + `submitMode` |
| `POST /v1/jobs` | Create pair job (idempotent) |
| `POST /v1/jobs/:id/credentials` | Vault BYO Moss userid for the job |
| `POST /v1/jobs/:id/uploads` | Upload exactly two files (base64) |
| `POST /v1/jobs/:id/finalize` | Queue submission |
| `GET /v1/jobs/:id` | Status + opaque result metadata |
| `POST /v1/jobs/:id/result/reveal` | Owner reveal of https report URL |
| `POST /v1/jobs/:id/result/forget` | Forget stored URL (not provider revocation) |

All `/v1/*` routes require header `X-Owner-User-Id`.

`ALLOW_PUBLIC_MOSS_TCP=1` is required for live public MOSS and is refused when `NODE_ENV=production`.
