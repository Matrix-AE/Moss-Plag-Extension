# How to Load and Verify the Extension Locally

## Production vs local

| Audience | API |
| --- | --- |
| Chrome Web Store / production build | `https://api.mossworkflow.dev` only — see [`deploy-api-mossworkflow.md`](./deploy-api-mossworkflow.md) |
| Developer machine | Optional loopback with `VITE_MOSS_USE_LOCAL_API=1` + `npm run api:start` |

`npm run build:extension` ships **hosted-only** host permissions (no localhost).

## Build

```bash
npm install
npm run icons:extension
npm run build:extension
npm run check:extension
```

Unpacked output: `apps/extension/.output/chrome-mv3`

## Optional local API (developers only)

Production builds ignore loopback. To exercise the API on your PC:

```bash
# Terminal A — mock (safe) or live (quota)
npm run api:start
# or: npm run api:start:live

# Terminal B — WXT dev with loopback opt-in
set VITE_MOSS_USE_LOCAL_API=1
npm run dev --workspace @moss/extension
```

`ALLOW_PUBLIC_MOSS_TCP=1` (via `api:start:live`) is **forbidden in production**. Never enable it in CI.

## Deterministic demo login

A fixed local demo account is seeded into `chrome.storage.local` on popup load:

| Field | Value |
| --- | --- |
| Email / username | `demo@mossworkflow.test` |
| Password | `DemoTest1!` |

Use **Sign in** with those credentials. Create-account also works for other local-only emails (password ≥ 6 characters). Demo auth never leaves the device.

## Load in Chrome / Edge

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `apps/extension/.output/chrome-mv3`.
5. Pin the extension.
6. Click the toolbar icon — the **popup** opens directly (no Side Panel, no new tab).

## What to click through

| Surface | Verify |
| --- | --- |
| Popup (~320×580, scroll inside) | Sign in with demo credentials → paywall ($15 / 15 runs / max 2 files, no upload yet) → **Connect Moss User ID** (enter registration email, see exact `registeruser` / `mail …` body, ack, paste numeric ID e.g. `936770554`) → Pair Check portal (language, two file pickers, Advanced options, Account / masked provider ID, preflight, consents, Start Pair Check) |
| Hosted result path | With `api.mossworkflow.dev` deployed and healthy, Start creates a job on the hosted API, uploads both files, hands off the Moss userid, finalizes, and polls status. On success it shows a real report link. Nothing auto-opens. |
| Offline demo fallback | If the hosted API is unreachable, Start explains deploy status. **Run offline demo instead** still produces a local `report.html` link labelled as a demo (no MOSS query). |
| Past results | Successful runs appear under **Past results** on this device for reopen/copy/share. |
| Stuck-run safety | A run that stops making progress closes itself at its deadline with an error, a reference, and recovery actions. |
| Moss ID step | Extension shows instructions only — it does **not** email Stanford. Portal stays locked until a numeric ID is saved (masked + local vault cipher; never sync). |
| Settings (embedded options) | Origins and permissions copy (`storage`, `alarms` only) |
| Themes | Popup forces dark brand tokens; settings still follow OS preference |

## Go-live checklist pointer

Full hosted deploy steps: [`deploy-api-mossworkflow.md`](./deploy-api-mossworkflow.md)

## Automated gates

```bash
npm test
npm run check:extension
```

Provider/protocol work uses the mock loopback server only in Node tests. Live public MOSS is manual/opt-in and must never run in CI.
