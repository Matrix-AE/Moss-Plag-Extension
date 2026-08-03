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
6. Click the toolbar icon — the **Side Panel** opens directly (no popup, no new tab).

## What to click through

| Surface | Verify |
| --- | --- |
| Side Panel (narrow ~360px and wide ~560–600px) | Mode (Pair/Batch), searchable language list (all capability languages), source/base intake, group preview, Advanced options (M/N/C, file restrictions, derived directory mode, experimental lockout), Account (masked provider ID after entitlement), preflight, review consents, paywall gate, sticky bottom CTA |
| Settings (embedded options) | Origins and permissions copy, including `sidePanel` |
| Themes | Inspect with OS light and dark `prefers-color-scheme` |

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
