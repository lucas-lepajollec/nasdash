# NasDash pre-release audit

Audit date: 2026-08-12

This audit covers the combined release candidate made from the post-demo stabilization, reproducible screenshots, Custom CSS recovery and final security-cleanup branches. It records evidence rather than treating a successful build as proof of every behavior.

## Verdict

**Conditional go for a public versioned release.** No blocking regression or known dependency vulnerability remains in the audited candidate. The remaining release conditions are operational: merge the focused pull requests with green required checks, build the published image from that exact merge, back up the real data volume, smoke-test the published image and create a rollback tag.

The candidate is suitable for public presentation as an open-source self-hosted project. It should not yet be described as free of technical debt.

## Verified matrix

| Area | Evidence | Result |
| --- | --- | --- |
| Unit and API behavior | 31 Vitest files, 134 tests | Pass |
| Production compilation | Next.js production build and TypeScript validation | Pass |
| Browser paths | 14 Playwright tests against a fresh production build | Pass |
| Accessibility smoke coverage | Reduced motion, keyboard navigation, mobile menu and topology dialogs | Pass |
| Authentication | Public/private mode, admin login/logout, viewer restrictions and password-change session invalidation | Pass |
| Custom CSS recovery | A deliberately hidden interface remains recoverable with `?safe-css=1` | Pass, including three repeated targeted runs |
| Docker packaging | Local image build with Node.js 22 | Pass |
| Fresh and upgraded container data | Login, non-root UID/GID and persistent volume reuse | Pass |
| Dependency audit | `npm audit --audit-level=low` | 0 known vulnerabilities |
| Repository privacy scan | Tracked local-data paths, common secret signatures and private identifiers | No secret found; personal development origins removed |
| Patch hygiene | `git diff --check` | Pass |

The owner also completed a manual tour of the deployed NAS instance after the previous hardening merge and confirmed that existing data remained present and no obvious regression was visible. That manual observation complements the automated volume-reuse test; it does not replace a complete integration laboratory.

## Security assessment

### Strengths

- Passwords use salted `scrypt` hashes and session tokens use HMAC-SHA256 signatures.
- Sessions are stored in `HttpOnly`, `SameSite=Lax` cookies and become secure cookies behind HTTPS.
- Password, role and permission changes increment a session version, invalidating previous sessions.
- Mutating routes require an administrator, validate same-origin requests and apply bounded request validation.
- Viewer responses filter confidential configuration, tokens and integration secrets server-side.
- Docker, device, topology, upload and Custom CSS inputs receive route-level validation.
- Ping requests are restricted to the exact endpoints already persisted by an administrator; another path on the same host is rejected.
- The public demo uses isolated fictional data, simulated mutations and no connection to real infrastructure.
- The container runs as a non-root user and reuses its persistent volume across updates.
- Security headers disable framing, MIME sniffing and unnecessary browser capabilities.

### Deployment responsibilities

- Use HTTPS before exposing NasDash outside a trusted network.
- Keep the generated or configured JWT secret stable and protect the persistent data volume.
- Replace initial account passwords immediately and keep the viewer account restricted to the intended surfaces.
- Never expose an unauthenticated Docker API to the public internet; bind a restricted proxy to a private LAN or VPN address.
- Back up and verify the data volume before every upgrade.

## Quality scores

These scores describe the audited candidate, not every possible third-party environment.

| Dimension | Score | Rationale |
| --- | ---: | --- |
| Security architecture | 9.0/10 | Server-side authorization, request bounds, secret filtering, CSRF/SSRF defenses and hardened sessions are covered by tests. |
| Data safety and upgrades | 9.2/10 | Atomic writes, backups, legacy backfill and real volume reuse are covered; the final published image still needs the release-day NAS smoke test. |
| Self-hosting readiness | 9.1/10 | Non-root image, health checks, persistent storage and operational guides are in place. |
| Functional confidence | 8.9/10 | Unit, production browser and container suites cover the critical paths, while live third-party integrations remain environment-dependent. |
| Demo and presentation | 8.8/10 | Isolated demo, repeatable reset and reproducible desktop/mobile captures are available. |
| Documentation | 8.8/10 | Installation, access control, backup, testing, troubleshooting, demo and customization are documented; contributor API internals can still grow. |
| Accessibility | 8.2/10 | Important keyboard and reduced-motion paths are tested, but no complete WCAG conformance audit is claimed. |
| Maintainability | 7.2/10 | Architecture and regression coverage improved substantially, but the historical lint/type debt remains significant. |
| Overall release readiness | **8.8/10** | Strong public release candidate once the focused PRs, published image test and version tag are complete. |

## Known non-blocking debt

- The full ESLint run still reports 193 errors and 171 warnings in legacy UI code. The largest groups are explicit `any` types, unescaped JSX text and effect/state patterns. The high-signal render-purity, component-creation and topology declaration-order findings discovered during this audit were fixed. The remaining set needs a dedicated, behavior-preserving refactor rather than bulk automatic edits.
- ESLint is therefore not yet a required CI gate. Unit, build, browser and container checks remain the merge blockers.
- Browser automation currently targets Chromium only. Firefox and WebKit coverage would increase confidence but is not required for the first release.
- No formal load or long-duration soak test has been run.
- Glances, Proxmox, Tailscale and remote Docker behavior depends on external versions, permissions and network health. Troubleshooting guidance distinguishes configuration errors from temporary unavailability, but a local CI fixture cannot prove every real deployment.
- Automated code coverage thresholds are not enforced. Critical paths are selected by risk rather than a target percentage.

## Release-day gate

1. Open the final integration pull request, which contains the reviewed focused commits without duplicating them in separate merges.
2. Merge it only after both required GitHub checks pass and confirm the merge commit contains the stabilization, screenshots, Custom CSS and cleanup changes.
3. Create and verify a complete backup of the production data volume.
4. Let GitHub build `ghcr.io/lucas-lepajollec/nasdash:latest` from the merged commit.
5. Pull that exact published image on the NAS and run the manual smoke checklist.
6. Confirm account access, Home, Docker, Networks, Widgets, Calendar, settings, persisted data and integration error classification.
7. Create a version tag and GitHub release with the previous working image/tag recorded as the rollback reference.

If any required check or real-instance smoke step fails, stop the release and fix it in a new focused branch. Do not bypass the protected `main` rules.
