# Contributing to NasDash

Thank you for helping improve NasDash. Focused bug fixes, documentation improvements, accessibility work, tests, and well-scoped features are welcome.

## Before you start

- Search existing GitHub issues and pull requests before opening a duplicate.
- Open an issue before investing in a large feature or architectural change.
- Report suspected vulnerabilities privately through [SECURITY.md](SECURITY.md), not in a public issue.
- Keep a pull request focused on one coherent change and avoid unrelated formatting or dependency churn.

## Local development

Fork and clone the public GitHub repository:

```bash
git clone https://github.com/YOUR-USERNAME/nasdash.git
cd nasdash
npm ci
cp .env.example .env
npm run dev
```

NasDash listens on `http://127.0.0.1:2499` by default. Use `npm run dev:lan` only when another device on a trusted network must reach the development server.

For Docker integration work, use isolated fixtures or an owned test engine through the selected supported transport (Portainer, Dockhand, a constrained `docker-socket-proxy`, or a Docker-compatible API/socket). The proxy in the README is optional. Never expose an unauthenticated Docker socket or proxy to the internet.

## Validate your change

Run the checks relevant to your change before opening a pull request. The complete pre-merge path is:

```bash
npm run check:version
npm run check:i18n
npm run lint
npm run check:audit-policy
npm run audit:dependencies
npm test
npm run build
npx playwright install chromium
npm run test:e2e
docker build --tag nasdash:smoke .
npm run test:container -- nasdash:smoke
```

`npm run lint` enforces the accepted lint baseline and is a required merge gate. Do not add new lint debt; `npm run lint:strict` exposes the full remaining backlog.

See [TESTING.md](TESTING.md) for isolated fixtures, production-mode browser tests, and container smoke-test details.

## Pull requests

1. Create a short-lived branch such as `feat/service-filter`, `fix/docker-timeout`, or `docs/compose-example`.
2. Use clear conventional commit messages, for example `fix: handle unavailable Docker hosts`.
3. Push the branch to your fork and open a GitHub pull request against `main`.
4. Explain the problem, the chosen approach, user-visible effects, validation performed, and any remaining limitation.
5. Add or update tests and documentation when behavior changes.
6. Respond to review feedback with new commits; do not rewrite a branch while it is actively being reviewed unless coordinated with the maintainer.

GitHub is NasDash's public review and contribution surface. Forgejo is the maintainer's authoritative Git forge. Maintainer branches are pushed through Forgejo and mirrored to GitHub for the public PR/check gate. Merge once on GitHub after the required checks pass, then fast-forward that exact accepted merge result into Forgejo and verify live parity. Never create separate merges on the two forges.

## Review expectations

A pull request is ready to integrate when:

- required GitHub checks pass;
- review conversations are resolved;
- the change is scoped, documented, and safe for existing installations;
- persistence, authentication, Docker access, network exposure, and upgrade behavior have been considered when relevant;
- no credentials, private infrastructure data, generated runtime state, or unrelated files are included.

By participating, you agree to follow the [Code of Conduct](CODE_OF_CONDUCT.md). Contributions are made under the repository's [MIT License](LICENSE).

## Maintainer release process

`package.json` is the authoritative product version; `package-lock.json` must match and `npm run check:version` enforces the contract, including the tag name in release CI.

Releases are deliberate milestones, not snapshots of every merge. Prepare a release pull request that updates the declared version, moves completed entries out of `Unreleased` in [CHANGELOG.md](CHANGELOG.md), and documents compatibility, migrations, and rollback when relevant. After all required checks pass, tag the exact accepted `main` commit with an annotated `vMAJOR.MINOR.PATCH` tag and push it through the authoritative Forgejo remote. Verify that the identical tag reaches GitHub and that the versioned container finishes successfully before publishing a draft GitHub release. Never move or reuse a published version tag.

Pushing an approved stable release tag also authorizes its GitHub release publication. After the versioned multi-platform image succeeds, the Docker publication workflow extracts the reviewed dated changelog entry, creates a draft and publishes it. This job alone has `contents: write`; branch builds do not create releases. Existing tags and releases are never replaced. Verify the public release and image after the workflow finishes.

## Documentation ownership

User and operator procedures live on the [dedicated documentation site](https://docs.nasdash.lucas-homelab.fr/en/docs/). Update English, French, Spanish, German and Italian together when behavior changes. Link to the canonical page instead of duplicating installation, backup/restore, access, demo, CSS or troubleshooting guides here. Publish and verify destination pages before retiring links.

Keep the README quick start, community/security/contribution policy, changelog, testing, screenshot/fixture maintenance and source-local module contracts in this repository. Historical audits are dated evidence, not current release certification.

## User experience feedback

Positive and constructive experience reports are welcome through the **User feedback** template in [GitHub Issues](https://github.com/lucas-lepajollec/nasdash/issues/new/choose). Use **Bug report** for reproducible faults and **Feature request** for proposals. Include platform/application versions and sanitized installation settings. Never post generated initial-password lines, credential files, tokens or private infrastructure details. See [first-start troubleshooting](https://docs.nasdash.lucas-homelab.fr/en/docs/getting-started/first-start).
