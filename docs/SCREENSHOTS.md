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

Use `NASDASH_CAPTURE_PORT` if port `2511` is unavailable. The generated runtime uses only tracked fictional fixtures, an isolated in-memory visitor session and a capture-only secret.

## Captured views

- Desktop Home with the public-demo disclosure visible.
- Desktop Docker, Networks, Widgets and Settings views.
- Mobile Home and Docker views at a fixed phone viewport.

Review every image before committing it. Confirm that it contains only `.demo.invalid` links, fictional names and simulated infrastructure. Regenerate the complete set after a layout or fixture change so documentation never combines incompatible UI states.
