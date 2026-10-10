# Reproducible demo screenshots

The README and documentation screenshots must come from the isolated public demo, never from a real NasDash installation.

## Generate the set

Install dependencies and Playwright Chromium, then run:

```bash
npm ci
npx playwright install chromium
npm run demo:capture
```

The script starts its own demo server on `127.0.0.1:2511`, freezes the browser and demo-calendar time, disables decorative motion and writes optimized JPEG files to `docs/assets/screenshots/`. A complete run replaces the set only after every view succeeds; `manifest.json` records the product version, source commit, capture date, dimensions and SHA-256 hashes. The legacy `public/nasdash.png` preview is also replaced with the same fictional Home view. It refuses to reuse an existing server so a normal or personal NasDash instance cannot be captured accidentally.

Captures always use English (`?lang=en`) and close the public-demo intro dialog before the first screenshot. The compact demo chip in the corner may remain visible.

Use `NASDASH_CAPTURE_PORT` if port `2511` is unavailable. The generated runtime uses only tracked fictional fixtures, an isolated in-memory visitor session and a capture-only secret.

## Captured views

- Desktop Home in the default NasDash theme, with the intro dialog closed.
- Desktop Docker, Networks, Widgets, Machines, Calendar, appearance settings and the theme gallery.
- The free-grid page editor and its searchable widget library.
- Theme and layout variants of Home: GitHub Light, Apple Dark, Dracula, Nord, Cyberpunk, and a dock/titles variant.
- Mobile Home and Docker views at a fixed phone viewport.

Review every image before committing it. Confirm that it contains only `.demo.invalid` links, fictional names and simulated infrastructure, English interface copy, and no open intro dialog. Regenerate the complete set after a layout or fixture change so documentation never combines incompatible UI states.

## Synchronize the supporting repositories

After reviewing the complete set, copy it into the landing and documentation clones:

```bash
node scripts/sync-demo-screenshots.mjs --landing ../../sites/nasdash --docs ../../docs/nasdash
```

Use the paths of your own clones. Both arguments are optional individually. The command verifies the version and every image hash before writing. It gives the landing image a content-hash filename to bypass stale browser, image-optimizer and social-card caches, updates the shared landing hero/social-preview dimensions and its legacy PNG, then copies the full set and manifest to the documentation's `public/screenshots/`. All four site/documentation languages share English demo screenshots and localized descriptions.

Home/theme/layout captures include the complete page; Docker and other views use 1920 × 1080, and phones use 390 × 844. The clock and calendar use 10 October 2026 at noon in Paris. Machine readings remain simulated and vary with server time. Screenshots must be refreshed after each visible product change. Publishing the three repositories remains a separate step.
