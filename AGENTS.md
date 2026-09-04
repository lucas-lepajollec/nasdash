# NasDash agent guide

This file is public repository guidance for maintainers and AI agents. Inspect the current branch, working tree, code, configuration and documentation before changing anything. Preserve unrelated work.

## Product boundaries

NasDash is a self-hosted cockpit for homelab services, infrastructure telemetry and Docker operations. Treat Docker access, credentials, topology, persistent data and network exposure as security-sensitive. Public demos must remain fictional and isolated.

## Development

- Install reproducibly with `npm ci`; use `npm install` only when intentionally changing dependencies.
- Local development: `npm run dev`; trusted-LAN development: `npm run dev:lan`.
- Validate normal changes with `npm test` and `npm run build`.
- Keep user-facing copy complete in English, French, Spanish, and German; run `npm run check:i18n` after interface changes.
- Use `npm run test:e2e` and the container checks documented in `TESTING.md` when the affected surface requires them.
- Keep the Docker Compose example, ports, volumes, environment variables and persistence guidance synchronized with the real configuration.

## Repository expectations

- Update tests, `README.md`, focused documentation and `CHANGELOG.md` when behavior or user-facing compatibility changes.
- Never commit `.env` values, real `data/`, backups, private addresses, tokens or infrastructure inventories.
- Follow `CONTRIBUTING.md` for pull requests and `SECURITY.md` for vulnerabilities.
- GitHub is the public review surface; maintainers integrate the exact accepted result into authoritative Forgejo history.

Local machine notes belong in ignored `AGENTS.override.md` and `.project-local/`, never in this public file.
