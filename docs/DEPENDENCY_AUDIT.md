# Dependency audit

CI runs `npm run check:audit-policy` and `npm run audit:dependencies`.
Production dependencies keep the standard `npm audit --omit=dev --audit-level=moderate` gate.
The full audit also blocks moderate, high and critical findings.

Lucas approved a temporary exception on 10 October 2026 for
[GHSA-vfj7-8cjw-p6xm](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm):
`braces` can exhaust the stack on deeply nested patterns. No patched version was
available at approval time. NasDash uses it only through development ESLint tooling.

The exception applies only to this advisory and its known development dependency
chain (`braces`, `micromatch`, `fast-glob`, `@next/eslint-plugin-next`,
`eslint-config-next`). Every affected lockfile node must be marked development-only;
another advisory, production inclusion, unresolved audit output or a different
dependency chain fails the gate. It expires automatically at **24 October 2026,
00:00 UTC**. The production audit has no exception.

Remove the exception after an upstream fix is available. Do not extend its deadline
without a new explicit approval. The policy tests cover expiry, production inclusion,
new advisories, missing nodes, cycles and malformed audit reports.
