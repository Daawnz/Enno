# Enno

A one-click deep focus blocker browser extension with a Zen Garden design. Supports Chrome and Firefox (Manifest V3, `declarativeNetRequest`).

## What it does

- Enter Focus to start a 90-minute focus session.
- Distraction sites (Reddit, YouTube, Instagram, X, and more) are blocked out of the box, with extras added per browser language.
- The blocked page offers an Override button: a 3-second breathing pause, then a single pass through; refreshing re-blocks.
- Everything lives in local browser storage; nothing is transmitted anywhere.

The repo also includes a static landing page (install + blocklist transparency) served from CloudFlaresU Pages.

## Development

Dependencies: bun (`bun install`). Scripts are launched with npm.

```bash
bun install          # install dependencies
npm run build        # build extension + landing, regenerate rules.json/manifest.json
npm run typecheck    # svelte-check + tsc
npm run lint         # eslint
npm run test:unit    # vitest on the pure core
npm run test:e2e     # build + Playwright suite
npm run scan:lhci    # Lighthouse gates on the landing site
npm test             # full pipeline
```

Load the unpacked extension from `dist/extension/` (Chrome: `chrome://extensions` -> Load unpacked) or `dist/extension-firefox/` (Firefox: `about:debugging` -> This Firefox -> Load Temporary Add-on). The bundle is gitignored; run `npm run build` before loading or running E2E tests.
