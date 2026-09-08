# Changelog

Notable user-visible changes to NasDash will be recorded here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and published versions will follow [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Security

- Update Next.js to `16.3.4` and pin patched Vitest/js-yaml so the protected dependency audit can pass.

### Changed

- Treat `.env` as an optional advanced override while preserving generated first-start credentials when it is absent.
- Let Docker Compose derive stack and container names, avoiding fixed global names and allowing multiple installations to coexist.
- Keep every copy-ready Compose example on `./data`. A named volume is an optional new-install alternative, not the default: switching an existing folder install to `nasdash-data` leaves the real files unused.

## [0.1.4] - 2026-09-08

### Changed

- Keep the default Compose file literal and copy-ready: it now names the published GHCR image directly and relies on NasDash's persisted first-start credential generation instead of optional interpolation variables.

## [0.1.3] - 2026-09-08

### Changed

- Simplify the default Compose files to the settings NasDash actually needs, while preserving the established Docker host port `2504`, persistence and restricted Docker socket proxy.
- Use matching port `2505` on both sides of the isolated public-demo proxy mapping; the production application remains on `2504:2504`.

## [0.1.2] - 2026-09-08

### Changed

- Compose now pulls the published image and uses Docker's standard all-interface port mapping by default. Use `127.0.0.1:2504:2504` for localhost-only publication; source builds use the explicit build override.
- No configuration or persistent-data migration is required; operators recreating an existing container should review the new LAN-reachable port default.

## [0.1.1] - 2026-09-06

### Security

- Restrict service ping requests to administrator-configured targets instead of accepting arbitrary outbound destinations.
- Restore normal TLS certificate verification for Proxmox requests and document custom-CA trust through the runtime environment.
- Render custom CSS without an HTML injection sink and remove unsafe previews of untrusted logo URLs.

### Changed

- Add complete dependency auditing and a non-regression lint ceiling to the protected quality gates.

## [0.1.0] - 2026-09-06

### Added

- The first deliberately maintained NasDash release line.
- A self-hosted homelab cockpit for services, hosts, Docker, network topology, widgets, tabs and theming.
- A consistent repository, quality, security, and release foundation.
- A maintained English, French, Spanish, and German interface with persisted language selection and locale-aware formatting.
- Versioned configuration and backup formats, atomic persistence, encrypted integration credentials and tested backup/restore tooling.
- Multi-architecture container images with health checks, SBOM, provenance and immutable commit-SHA rollback tags.

Earlier development remains available in Git history; this changelog does not invent releases that were never deliberately published.

[Unreleased]: https://github.com/lucas-lepajollec/nasdash/compare/v0.1.4...HEAD
[0.1.4]: https://github.com/lucas-lepajollec/nasdash/compare/v0.1.3...v0.1.4
[0.1.3]: https://github.com/lucas-lepajollec/nasdash/compare/v0.1.2...v0.1.3
[0.1.2]: https://github.com/lucas-lepajollec/nasdash/compare/v0.1.1...v0.1.2
[0.1.1]: https://github.com/lucas-lepajollec/nasdash/compare/v0.1.0...v0.1.1
[0.1.0]: https://github.com/lucas-lepajollec/nasdash/releases/tag/v0.1.0
