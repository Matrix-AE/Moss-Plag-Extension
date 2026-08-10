# How to Load and Verify the Extension Locally

## Production vs local

| Audience | API |
| --- | --- |
| Chrome Web Store / production build | Hosted Railway API — default `https://mossapi-production.up.railway.app` |
| Customers installing from the store | **Nothing local** — only Chrome + the online Railway API |

`npm run build:extension` ships **hosted-only** host permissions (no localhost).

## Build (store / production)

```bash
npm install
npm run icons:extension
npm run build:extension
npm run check:extension
npm run zip:extension
```

Unpacked output: `apps/extension/.output/chrome-mv3`  
Store zip: under `apps/extension/.output/` (see `zip:extension`).

## Account login

Use a real inbox. Create account requires a strong password entered twice, then a six-digit OTP
from `team@matrix-ae.com`. Google and Microsoft buttons require their OAuth variables on Railway;
see [`email-password-auth.md`](./email-password-auth.md).

## Load in Chrome / Edge (dev verify)

1. Open `chrome://extensions` (or `edge://extensions`).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select `apps/extension/.output/chrome-mv3`.
5. Pin the extension.
6. Click the toolbar icon — the **popup** opens directly (no Side Panel, no new tab).
7. Once the popup reaches the portal, click **Open run window**. Choose files there, not in the
   popup: Chrome closes a toolbar popup the moment a file chooser takes focus.

## What to click through

| Surface | Verify |
| --- | --- |
| Popup (~380×580, scroll inside) | Email/password + OTP or Google/Microsoft → paywall (free demo once per PC, Pair $15/15 runs/2 files, or Batch $50/50 runs multi-file/folder, no upload yet) → **Connect Moss User ID** → **Open run window** |
| Run window | Step 1 language dropdown (picking it is the confirmation — no confirm button), step 2 file tiles showing the chosen names, step 3 consents with **Start** right below them and a second Start at the top. Selecting a file must never blank the window. |
| Hosted result path | With Railway healthy, Start creates a job on the hosted API, uploads both files, hands off the Moss userid, finalizes, and polls status. On success it shows a real report link. Nothing auto-opens. |
| Offline demo fallback | If the hosted API is unreachable, Start explains status. **Run offline demo instead** still produces a local `report.html` link labelled as a demo (no MOSS query). |
| Past results | Successful runs appear under **Past results** on this device for reopen/copy/share. |
| Stuck-run safety | A run that stops making progress closes itself at its deadline with an error, a reference, and recovery actions. |
| Moss ID step | Extension shows instructions only — it does **not** email Stanford. Portal stays locked until a numeric ID is saved (masked + local vault cipher; never sync). |
| Settings (embedded options) | Origins and permissions copy (`storage`, `alarms`, `identity`) |
| Themes | Popup forces dark brand tokens; settings still follow OS preference |

## Go-live checklist pointer

Railway deploy: [`deploy-railway.md`](./deploy-railway.md)

## Automated gates

```bash
npm test
npm run check:extension
npm run test:e2e:chrome   # real Chrome, walks popup → run window → Start (add -- --shots shots/)
```
