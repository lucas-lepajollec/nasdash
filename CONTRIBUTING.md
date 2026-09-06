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

For Docker integration work, use a constrained `docker-socket-proxy` as described in the README. Never expose an unauthenticated Docker socket or proxy to the internet.

## Validate your change

Run the checks relevant to your change before opening a pull request. The complete pre-merge path is:

```bash
npm test
npm run build
npx playwright install chromium
npm run test:e2e
docker build --tag nasdash:smoke .
npm run test:container -- nasdash:smoke
```

`npm run lint` is useful while editing touched files, but the repository still has pre-existing lint debt and does not yet use the full-project lint result as a merge gate. Do not expand that debt in changed code.

See [TESTING.md](TESTING.md) for isolated fixtures, production-mode browser tests, and container smoke-test details.

## Pull requests

1. Create a short-lived branch such as `feat/service-filter`, `fix/docker-timeout`, or `docs/compose-example`.
2. Use clear conventional commit messages, for example `fix: handle unavailable Docker hosts`.
3. Push the branch to your fork and open a GitHub pull request against `main`.
4. Explain the problem, the chosen approach, user-visible effects, validation performed, and any remaining limitation.
5. Add or update tests and documentation when behavior changes.
6. Respond to review feedback with new commits; do not rewrite a branch while it is actively being reviewed unless coordinated with the maintainer.

GitHub is NasDash's public review and contribution surface. Forgejo is the maintainer's authoritative Git forge. Accepted contributions are integrated into the authoritative history without rewriting their reviewed commits, then mirrored back to GitHub. GitHub marks the original pull request as merged when those commits reach `main`.

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
