# How to Load and Verify the Extension Locally

## Build

```bash
npm install
npm run icons:extension
npm run build:extension
npm run check:extension
```

Unpacked output: `apps/extension/.output/chrome-mv3`

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
| Popup (~320×580, scroll inside) | Auth create/sign-in → paywall ($15 / 15 runs / max 2 files, no upload yet) → Pair Check portal (language, two file pickers, Advanced options, Account / masked provider ID, preflight, consents, Start Pair Check decrements remaining runs, SETTINGS footer) |
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
