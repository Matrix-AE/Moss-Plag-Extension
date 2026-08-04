# Deploy checklist — `api.mossworkflow.dev`

## Purpose

Ship the hosted API so Chrome Web Store users never run a local Node process. The production
extension talks only to:

| Origin | Role |
| --- | --- |
| `https://api.mossworkflow.dev` | Jobs, credentials vault, status, result reveal |
| `https://uploads.mossworkflow.dev` | Large upload payloads (when enabled) |

Raw public TCP to `moss.stanford.edu:7690` is **forbidden in production** (ADR-0005B). Local
`ALLOW_PUBLIC_MOSS_TCP=1` is a developer opt-in only.

## Railway (recommended starter host)

Step-by-step: [`deploy-railway.md`](./deploy-railway.md)

Deploy `apps/api` via the root `Dockerfile`, set:

- `ALLOW_PUBLIC_MOSS_TCP=1`
- `ALLOW_HOSTED_PUBLIC_MOSS_TCP=1` (required when `NODE_ENV=production` for public MOSS TCP)

Then rebuild the extension with:

`VITE_MOSS_API_ORIGIN=https://your-service.up.railway.app`

## Preconditions (must be true before DNS goes live)

- [ ] Written commercial Moss rights on file (ADR-0005A / enable checklist)
- [ ] Approved **encrypted** commercial MOSS endpoint documented (host, port, TLS, auth)
- [ ] Product / legal / security / ops sign-off on [`commercial-enable-checklist.md`](./commercial-enable-checklist.md)
- [ ] Domain ownership for `mossworkflow.dev` (or chosen production domain)
- [ ] TLS certificates for `api.` and `uploads.` (HTTPS only)
- [ ] Secrets never committed (vault master key, result encryption key, payment keys)

## What to deploy

Entry point today: `apps/api/server.js` (pair job HTTP surface).

Minimum production process:

```bash
# On the host — never set ALLOW_PUBLIC_MOSS_TCP in production
export NODE_ENV=production
export MOSS_API_PORT=8787   # or your platform’s PORT
# Bind behind a reverse proxy that terminates TLS for api.mossworkflow.dev
node apps/api/server.js
```

Recommended layout:

1. Reverse proxy (Caddy / nginx / cloud load balancer) → TLS → loopback Node
2. Managed secrets (KMS / platform secret store) for vault + result encryption keys
3. Persistent job/result store (replace in-memory Maps before public launch)
4. Separate upload service or signed object storage for `uploads.mossworkflow.dev`

## Environment gates

| Variable | Production value |
| --- | --- |
| `NODE_ENV` | `production` |
| `ALLOW_PUBLIC_MOSS_TCP` | **unset / not `1`** |
| Provider transport | `encrypted-allowlisted` only |
| Bind address | Loopback or private NIC; public traffic via HTTPS proxy |

Health check after deploy:

```bash
curl -fsS https://api.mossworkflow.dev/health
```

Expect JSON with `"ok": true` and `"livePublicTcp": false`.

## CORS / extension access

Allow:

- `chrome-extension://<store-extension-id>`
- Exact API origin for same-origin tooling

Require header `X-Owner-User-Id` (or replace with real session auth before launch).

## Extension cutover

Production builds already default to the hosted origin (`apps/extension/src/shared/origins.ts`).

1. Deploy API + TLS
2. Confirm `/health`
3. `npm run build:extension && npm run check:extension && npm run zip:extension`
4. Load / publish the zip — **no localhost host permission** in the store package
5. Smoke: sign-in → purchase → Moss ID → two files → result link

Local loopback is only for developers:

```bash
# Terminal A
npm run api:start

# Terminal B — opt into loopback (never for store builds)
set VITE_MOSS_USE_LOCAL_API=1
npm run build:extension
# or: npm run dev --workspace @moss/extension
```

## Still required before charging customers

These are not finished by deploying the pair HTTP scaffold alone:

- [ ] Real auth (replace demo `chrome.storage` login)
- [ ] Real checkout / entitlements webhooks
- [ ] Durable job + result storage + past-results API
- [ ] Encrypted MOSS adapter wired (no raw TCP)
- [ ] Monitoring, rate limits, backups, incident runbook
- [ ] Chrome Web Store listing, privacy policy URL, payment disclosures

## Rollback

1. Point DNS / proxy away from the bad revision
2. Keep the store extension on the last known-good API
3. If rights or TLS evidence is withdrawn, disable commercial traffic per ADR-0005A kill rules

## Related docs

- [`extension-shell.md`](./extension-shell.md) — CSP / host permissions
- [`extension-local-testing.md`](./extension-local-testing.md) — local-only developer path
- [`commercial-enable-checklist.md`](./commercial-enable-checklist.md) — launch gates
- [`../adr/0010-product-architecture.md`](../adr/0010-product-architecture.md) — hosted relay
