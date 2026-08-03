# How to Load and Verify the Extension Locally

## Build

```bash
npm install
npm run icons:extension
npm run build:extension
npm run check:extension
```

Unpacked output: `apps/extension/.output/chrome-mv3`

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
| Moss ID step | Extension shows instructions only — it does **not** email Stanford. Portal stays locked until a numeric ID is saved (masked + local vault cipher; never sync). |
| Settings (embedded options) | Origins and permissions copy (`storage`, `alarms` only) |
| Themes | Popup forces dark brand tokens; settings still follow OS preference |

## Dev loop (optional)

```bash
npm run dev --workspace @moss/extension
```

WXT prints a path to load unpacked; reload the extension after changes.

## Automated gates

```bash
npm test
npm run check:extension
```

Provider/protocol work (Prompts 051+) is covered by Node tests with the mock loopback server — not by live Stanford MOSS traffic.
