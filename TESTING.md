# Testing NasDash

NasDash uses two complementary test layers:

- `npm test` runs the fast unit and API contract suite with Vitest.
- `npm run test:e2e` starts an isolated NasDash instance and runs the critical browser paths with Playwright Chromium.

## Browser tests

Install Chromium once after `npm ci` or when Playwright is updated:

```bash
npx playwright install chromium
```

Then run:

```bash
npm run test:e2e
```

The E2E server listens on `127.0.0.1:2510`, uses `.next-e2e` for its local Next.js artifacts, and recreates `.e2e/data` before each run. It can therefore run beside a normal `npm run dev` process on port 2499. It never reads or writes the normal `data/` directory. Its users, passwords, JWT secret, configuration changes and uploaded files are disposable test-only state.

The initial suite covers:

- anonymous viewer access in public mode;
- server-side rejection of anonymous writes;
- admin login through the real login page;
- settings persistence and reload through the API;
- custom-tab layout persistence;
- viewer read access and write rejection;
- anonymous rejection and browser redirection in private mode.

For a production-mode run, build first and set `NASDASH_E2E_SERVER_MODE=production` before `npm run test:e2e`. The continuous-integration workflow uses this mode.

## Isolated data directory

The server uses `<project>/data` by default. `NASDASH_DATA_DIR` can point it to another persistent directory; this is primarily intended for automated tests and advanced deployments. A relative value is resolved from the NasDash working directory.
