# NasDash public release plan

This document tracks the work required to present NasDash publicly as a polished, trustworthy self-hosted project. It complements the technical roadmap: the focus here is release readiness, demonstration, documentation and maintainable customization.

## Stable baseline

- Hardened release merged into `main` at `bb4c3b4`.
- Unit, production browser and container persistence suites pass in GitHub Actions.
- Published images: `ghcr.io/lucas-lepajollec/nasdash:latest` and `sha-bb4c3b4`.
- A real NAS upgrade preserved the existing configuration and data.
- `main` is protected by required pull requests and CI checks.

## Phase 1 — Targeted stabilization

Fix confirmed production issues without reopening broad speculative refactors.

- [x] Redirect clearly to login after the current administrator changes their own password.
- [ ] Confirm that default-password warnings disappear after both built-in accounts are updated.
- [ ] Resolve or document the observed Glances 404/timeout configuration case.
- [ ] Triage Dependabot updates individually; never merge major upgrades automatically.
- [ ] Record any new issue with exact reproduction steps before changing code.

Exit criteria: no known blocking regression, no unexplained security warning and all required PR checks green.

## Phase 2 — Deterministic public demo

- [ ] Define a completely fictitious homelab identity and dataset.
- [ ] Exclude credentials, private addresses, personal names and real infrastructure details.
- [ ] Make destructive Docker actions unavailable or clearly simulated.
- [ ] Keep demo data isolated from the normal persistent data directory.
- [ ] Provide a repeatable reset mechanism.
- [ ] Cover the demo startup and primary navigation with Playwright.

Exit criteria: anyone can launch or visit the demo without access to the owner’s infrastructure, and every reset returns to the same polished state.

## Phase 3 — Reproducible visual assets

- [ ] Script desktop and mobile screenshots with fixed viewports and seeded data.
- [ ] Capture Home, Docker, Networks, Widgets and the most useful settings views.
- [ ] Keep a consistent theme, ordering and state across every image.
- [ ] Optimize image sizes and provide meaningful alternative text.
- [ ] Replace outdated README visuals only after reviewing the generated set.

Exit criteria: screenshots can be regenerated after UI changes and accurately represent the public demo.

## Phase 4 — Complete documentation and Custom CSS contract

- [ ] Create task-oriented installation, update, rollback and backup guides.
- [ ] Document Docker, Glances, Proxmox, Tailscale and common troubleshooting cases.
- [ ] Document accounts, public/private mode and viewer permissions.
- [ ] Publish supported CSS variables and stable customization hooks.
- [ ] Add copy-ready Custom CSS recipes with screenshots.
- [ ] Provide preview, reset and recovery guidance for invalid custom styles.
- [ ] Separate user, operator and contributor documentation.

Exit criteria: a new user can install, customize, update and recover NasDash without relying on private project context.

## Phase 5 — Public release gate

- [ ] Run the complete unit, production E2E and container matrix.
- [ ] Perform a final security, accessibility, self-hosting and documentation audit.
- [ ] Test the published image on a backed-up real installation.
- [ ] Review remaining known debt and document non-blocking limitations.
- [ ] Create a versioned GitHub release with honest release notes.
- [ ] Prepare the public project description and Reddit post from verified capabilities only.

Exit criteria: no known blocker, documented residual debt, reproducible demo and visuals, green CI, tested upgrade path and published rollback reference.

## Working method

Each change should use a focused branch and pull request:

```text
Issue or confirmed need → focused branch → tests → pull request → required CI → review → merge
```

Avoid combining unrelated features into a large release branch. `main` remains deployable, major dependency updates receive dedicated validation, and screenshots or documentation claims must never exceed what the real application and demo can prove.
