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
5. Pin the extension; open the **popup**, then **Open workspace**.

## What to click through

| Surface | Verify |
| --- | --- |
| Popup | Status glance, open workspace / settings |
| Workspace | Mode (Pair/Batch), language, intake, grouping, base code, settings, preflight, review consents, paywall gate |
| Settings | Origins and permissions copy |

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
