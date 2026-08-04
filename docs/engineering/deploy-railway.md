# Deploy the Moss pair API on Railway

This runs the same job as your desktop Moss app (talk to Stanford, return a result link),
but on Railway so the Chrome extension can call it.

## 1. Create a Railway project

1. Go to [https://railway.app](https://railway.app) and sign in (GitHub is fine).
2. **New Project** → **Deploy from GitHub repo**.
3. Select **`Matrix-AE/Moss-Plag-Extension`** (or your fork).  
   If the latest Railway files are not on GitHub yet, push `main` first.
4. Railway should detect the root `Dockerfile` + `railway.toml`.

## 2. Set environment variables

In Railway → your service → **Variables**, add:

| Variable | Value | Why |
| --- | --- | --- |
| `NODE_ENV` | `production` | Normal production mode |
| `ALLOW_PUBLIC_MOSS_TCP` | `1` | Talk to public MOSS like the desktop app |
| `ALLOW_HOSTED_PUBLIC_MOSS_TCP` | `1` | Explicit opt-in for hosted cleartext TCP (required with `NODE_ENV=production`) |

Do **not** commit these into git. Set them only in Railway.

> Cleartext TCP to Stanford consumes real Moss quota. Prefer an approved encrypted commercial endpoint when you have one.

## 3. Generate a public HTTPS URL

Railway → service → **Settings** → **Networking** → **Generate domain**.

You will get something like:

`https://fahadramzan-moss-api.up.railway.app`

Open:

`https://YOUR-SUBDOMAIN.up.railway.app/health`

Expect JSON like:

```json
{ "ok": true, "service": "moss-pair-api", "submitMode": "public-raw-tcp", "livePublicTcp": true }
```

### Confirm you deployed the fixed image

In **Build Logs** you must see:

- `building moss-pair-api 2026-08-04-healthfix2`
- `api-module-ok`

In **Deploy Logs** you must see:

- `moss-pair-api-boot rev=2026-08-04-healthfix2`
- `[moss-pair-api] listening`

If you still only see `RUN npm ci --omit=dev` with no `api-module-ok`, Railway is building an **old commit**. Fix:

1. Service → **Settings** → Source → branch **`main`** on `Matrix-AE/Moss-Plag-Extension`
2. **Deploy** → **Clear build cache** (if available) → **Redeploy**

## 4. Point the extension at Railway

Store builds already default to `https://mossapi-production.up.railway.app`.
To override (PowerShell):

```powershell
$env:VITE_MOSS_API_ORIGIN = "https://YOUR-SUBDOMAIN.up.railway.app"
$env:VITE_MOSS_UPLOAD_ORIGIN = "https://YOUR-SUBDOMAIN.up.railway.app"
npm run build:extension
npm run check:extension
```

Then in Chrome:

1. `chrome://extensions` → **Reload** the unpacked build (`apps/extension/.output/chrome-mv3`)
2. Popup → login → unlock → Moss ID → two files → **Start Pair Check**

## 5. What folder is hosted?

Railway builds from the **repo root** using:

- `Dockerfile` (copies `apps/api` + `packages`)
- `railway.toml`
- Start command: `npm run start --workspace @moss/api` → `apps/api/server.js`

You are not hosting the Chrome extension on Railway. The extension stays a Chrome package.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Healthcheck `/health` never becomes healthy | Redeploy latest `Dockerfile` (starts `node apps/api/server.js`). In Railway **Logs**, look for `[moss-pair-api] listening`. Confirm Variables include the three flags below. |
| `/health` shows `submitMode: mock-loopback` | Set both `ALLOW_PUBLIC_MOSS_TCP=1` and `ALLOW_HOSTED_PUBLIC_MOSS_TCP=1`, redeploy |
| Extension says hosted API unreachable | Rebuild with `VITE_MOSS_API_ORIGIN` set to the exact Railway HTTPS URL (no trailing slash needed) |
| CORS errors | Extension origin is `chrome-extension://…` — server already allows that prefix |
| Deploy fails on `npm ci` | Ensure `package-lock.json` is committed at repo root; Dockerfile must copy all of `apps/` and `packages/` |

## Related

- General checklist: [`deploy-api-mossworkflow.md`](./deploy-api-mossworkflow.md)
- Local testing: [`extension-local-testing.md`](./extension-local-testing.md)
