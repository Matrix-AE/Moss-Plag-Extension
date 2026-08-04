# How to Load and Verify the Extension Locally

## Build

```bash
npm install
npm run icons:extension
npm run build:extension
npm run check:extension
```

Unpacked output: `apps/extension/.output/chrome-mv3`

## Local API (required for real / mock MOSS results)

The popup Pair Check talks to a **loopback API** on `http://127.0.0.1:8787` (not the hosted
`api.mossworkflow.dev` origin during local testing).

### Mock MOSS (default — safe for CI / daily dev)

```bash
npm run api:start
```

Uses an in-process mock MOSS server on loopback. No Stanford traffic. No quota consumed.

### Live public MOSS (explicit opt-in — consumes real quota)

```bash
npm run api:start:live
```

Sets `ALLOW_PUBLIC_MOSS_TCP=1` and submits over cleartext TCP to `moss.stanford.edu:7690` with the
BYO numeric userid from the extension. **Forbidden in production** (ADR-0005B). Never enable this
flag in CI.

Health check: `GET http://127.0.0.1:8787/health` → `submitMode` is `mock-loopback` or `public-raw-tcp`.

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
| Popup (~320×580, scroll inside) | Sign in with demo credentials → paywall ($15 / 15 runs / max 2 files, no upload yet) → **Connect Moss User ID** (enter registration email, see exact `registeruser` / `mail …` body, ack, paste numeric ID e.g. `936770554`) → Pair Check portal (language, two file pickers, Advanced options, Account / masked provider ID, preflight, consents, Start Pair Check decrements remaining runs, SETTINGS footer) |
| Live / mock result path | Start the local API first. After **Start Pair Check** the popup creates a job, uploads both files, hands off the Moss userid to the server vault, finalizes, and polls status. On success it shows an **https** result link (mock: `https://mock.local/...`, live: Stanford). Nothing auto-opens; use **Copy link** or click the link yourself. |
| Offline demo fallback | If the local API is down, Start explains how to launch it. **Run offline demo instead** still produces a local `report.html` link labelled as a demo (no MOSS query). |
| Stuck-run safety | A run that stops making progress closes itself at its deadline with an error, a reference, and recovery actions. Closing and reopening the popup re-applies the same deadline instead of resuming a spinner. |
| Moss ID step | Extension shows instructions only — it does **not** email Stanford. Portal stays locked until a numeric ID is saved (masked + local vault cipher; never sync). Plaintext userid is sent only over loopback HTTP into the API vault at start. |
| Settings (embedded options) | Origins and permissions copy (`storage`, `alarms` only) |
| Themes | Popup forces dark brand tokens; settings still follow OS preference |

## See a real result in the unpacked extension

1. Keep the live API running: `npm run api:start:live`
2. Rebuild and reload:
   ```bash
   npm run build:extension
   ```
   Then in `chrome://extensions` → your extension → **Reload**.
3. Open the toolbar popup:
   - Sign in: `demo@mossworkflow.test` / `DemoTest1!`
   - Unlock $15 → Connect Moss User ID (`936770554` or your id)
   - Confirm language **python**
   - Pick File 1 + File 2 → consents → **Start Pair Check**
4. Wait for phases to finish. Open/copy the Stanford report link (never auto-opens).
5. **Past results** on the portal keeps those links on this device so you can reopen or copy them later (share a link with a student when you want them to see that run).

## Manual live smoke (never in CI)

1. `npm run api:start:live`
2. Rebuild / reload the unpacked extension.
3. Sign in → Unlock → Connect a **real** Moss User ID.
4. Pick two small source files → consent → **Start Pair Check**.
5. Wait for a real `https://…moss.stanford.edu…` report URL.
6. Confirm the link opens only on user click; forget/copy behave honestly.

Expect cleartext TCP and real quota use. Stop the live API when finished.

## Dev loop (optional)

```bash
npm run api:start
npm run dev --workspace @moss/extension
```

WXT prints a path to load unpacked; reload the extension after changes.

## Automated gates

```bash
npm test
npm run check:extension
```

Provider/protocol work uses the mock loopback server only. Live public MOSS is manual/opt-in and
must never run in CI.
