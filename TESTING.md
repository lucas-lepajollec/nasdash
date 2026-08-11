# Testing NasDash

NasDash uses two complementary test layers:

- `npm test` runs the fast unit and API contract suite with Vitest.
- `npm run test:e2e` starts an isolated NasDash instance and runs the critical browser paths with Playwright Chromium.
- `npm run test:container -- <image>` verifies a built image, initial login, the non-root UID/GID and reuse of its persistent volume.

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

- the operating-system reduced-motion preference, including decorative animation loops, delays, transitions and smooth scrolling;
- keyboard accessibility of the dashboard and settings dialog, including names, focus trapping, Escape, focus restoration, accessible integration fields, keyboard operation of custom selects and rendering of the General, Devices, Tailscale, Clock, Calendar and Weather settings pages;
- mobile-menu rendering without conditional React hooks or browser page errors;
- keyboard accessibility of the network topology editor dialog without persisting a topology change;
- anonymous viewer access in public mode;
- server-side rejection of anonymous writes;
- admin login through the real login page;
- settings persistence and reload through the API;
- category and service creation/editing with the real UI payload shape;
- Docker-tab actions remaining admin-only while staying independent from the widget-only Start/Stop button visibility setting;
- Docker log requests rejecting unbounded or invalid `tail` values before contacting the remote host;
- custom-tab layout persistence;
- viewer read access and write rejection;
- admin logout after the initial dashboard requests settle, single-owner EventSource cleanup, session removal and full reload to the login page;
- anonymous rejection and browser redirection in private mode, including protection of the logo listing and stored logo files.

For a production-mode run, build first and set `NASDASH_E2E_SERVER_MODE=production` before `npm run test:e2e`. The continuous-integration workflow uses this mode.

When a Playwright run fails in GitHub Actions, the workflow uploads `playwright-report/` and `test-results/` as a diagnostic artifact retained for 14 days. These files contain the HTML report and any trace, screenshot or video retained by Playwright for the failed path.

The E2E runner owns only the isolated server it starts. It refuses to run if port 2510 is already occupied and explicitly releases its process tree on Windows, Linux and macOS.

## Manual release test

Run this checklist on the real development instance before merging the hardening branch. Back up `data/` first: unlike the E2E suite, these checks intentionally exercise the normal persistent configuration.

- [ ] Log in and out as an administrator; verify public/private mode and viewer read-only permissions.
- [ ] On Home, create, edit, move and delete a temporary category and service; check links, search, layouts and the mobile view.
- [ ] In Docker, test both a reachable host and an intentionally unreachable host; verify containers, details, logs, images and volumes. Run start/stop/restart only on a disposable container, and confirm that an offline host is distinguishable from invalid credentials or settings.
- [ ] In Networks, generate or load the topology, then create, edit, move, link and delete temporary items on a backed-up configuration. Reload the page and verify persistence.
- [ ] Enable, disable, reorder and resize widgets. Exercise Clock, Calendar, Weather, Tailscale, Devices and Docker settings, including custom selects with mouse and keyboard, then save and reload.
- [ ] Check appearance settings, themes and backgrounds on desktop and mobile widths.
- [ ] Restart NasDash (or its container) and verify that users, services, layouts, widgets and network topology are still present.
- [ ] For any failure, record the exact reproduction steps, the page and account type, a screenshot, browser-console output and the corresponding server log lines.

Do not perform destructive Docker actions on valuable containers, images or volumes. Use disposable resources for action tests.

## Monitoring failure classification

`src/lib/monitoringError.test.ts` protects the log-severity contract used by the Glances and Proxmox adapters:

- timeouts, refused connections, unreachable hosts and temporary DNS failures are retryable warnings;
- missing or invalid settings, authentication failures, TLS failures and missing API endpoints are errors requiring intervention;
- invalid payloads and unexpected remote HTTP failures remain errors.

This classification changes only the server log severity and guidance. Device online/offline state, polling retries and collected metrics remain covered by their existing behavior.

## Resilience and recovery contracts

The unit suite also protects the less visible failure modes introduced by self-hosting:

- calendar downloads and Docker log streams are stopped as soon as their real payload exceeds the 2 MiB limit, even without a trustworthy `Content-Length` header;
- missing or empty local JWT and encryption secrets are replaced with a persistent random 256-bit value and reused after restart;
- an invalid `config.json` is copied byte-for-byte beside the original as `config.json.corrupt-<timestamp>` before NasDash writes a recoverable default;
- an existing recovery copy is never silently overwritten.

If NasDash cannot preserve an invalid `config.json`, it uses a fallback configuration in memory but deliberately leaves the original file untouched. This favors recoverability over an automatic destructive repair.

## Container smoke test

Build an image and test it with:

```bash
docker build --tag nasdash:smoke .
npm run test:container -- nasdash:smoke
```

The script creates uniquely named temporary containers and a temporary Docker volume. It verifies a fresh start, healthcheck, admin login, runtime UID/GID `1001:1001`, required data files and persistence after the container is replaced. Its own containers and volume are removed in a `finally` cleanup; existing NasDash containers and volumes are never targeted.

## Isolated data directory

The server uses `<project>/data` by default. `NASDASH_DATA_DIR` can point it to another persistent directory; this is primarily intended for automated tests and advanced deployments. A relative value is resolved from the NasDash working directory.
