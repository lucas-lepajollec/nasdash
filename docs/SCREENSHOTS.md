# Reproducible demo screenshots

The README and documentation screenshots must come from the isolated public demo, never from a real NasDash installation.

## Generate the set

Install dependencies and Playwright Chromium, then run:

```bash
npm ci
npx playwright install chromium
npm run demo:capture
```

The script starts its own demo server on `127.0.0.1:2511`, freezes the browser and demo-calendar time, disables decorative motion and writes optimized JPEG files to `docs/assets/screenshots/`. It refuses to reuse an existing server so a normal or personal NasDash instance cannot be captured accidentally.

Captures always use English (`?lang=en`) and close the public-demo intro dialog before the first screenshot. The compact demo chip in the corner may remain visible.

Use `NASDASH_CAPTURE_PORT` if port `2511` is unavailable. The generated runtime uses only tracked fictional fixtures, an isolated in-memory visitor session and a capture-only secret.

## Captured views

- Desktop Home in the default NasDash theme, with the intro dialog closed.
- Desktop Docker, Networks, Widgets, settings and the theme gallery.
- Theme and layout variants of Home: GitHub Light, Apple Dark, Dracula, Nord, Cyberpunk, and a dock/titles variant.
- Mobile Home and Docker views at a fixed phone viewport.

Review every image before committing it. Confirm that it contains only `.demo.invalid` links, fictional names and simulated infrastructure, English interface copy, and no open intro dialog. Regenerate the complete set after a layout or fixture change so documentation never combines incompatible UI states.
