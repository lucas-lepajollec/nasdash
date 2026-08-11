# Server access matrix

NasDash applies viewer permissions in API routes as well as in React. Hiding a tab or widget in the browser is not considered an authorization control.

## Principals

| Request | Public mode | Private mode |
|---|---|---|
| Anonymous | Uses the stored `viewer` allowlists | 401 |
| Authenticated viewer | Uses the viewer's current stored role and allowlists | Same |
| Admin | Full read access | Full read access |
| Deleted user with an old JWT | 401 | 401 |

For backward compatibility, an empty `allowedTabs` or `allowedWidgets` list means unrestricted access within that list. A non-empty list is enforced as an allowlist.

## Resource mapping

Access is granted when at least one listed tab or widget is allowed.

| Backend resource | Tabs | Widgets |
|---|---|---|
| Service ping | `dashboard` | `quickstats`, `networkgraph` |
| Device and system metrics | `dashboard` | `devices`, `quickstats` |
| Local or remote calendar | — | `calendar` |
| Network topology | `networks` | `networkgraph` |
| Tailscale | `networks` | `tailscale` |
| Docker container list | `docker`, `networks` | `dockercontainers` |
| Docker details, logs, images and volumes | `docker` | — |

Mutations remain admin-only. Docker mutations additionally require `allowDockerActions === true` where applicable.

## Configuration filtering

`GET /api/config` returns a cloned, filtered configuration and never mutates the cached server copy.

For every principal, credential values are masked. For non-admin principals, NasDash additionally:

- removes secret categories and their legacy embedded slots;
- removes resources excluded by the viewer allowlists;
- keeps Docker daemon URLs server-side;
- removes device credential markers and the Tailscale client secret;
- removes custom-tab definitions and layouts that are not allowed.

Further URL/IP minimization should be decided per product feature so that legitimate service links and explicitly authorized network views keep working.

## Revocable sessions

Each user has a monotonic `sessionVersion`, also embedded in newly issued JWTs. Existing installations are migrated to version `0`, which keeps pre-migration JWTs compatible because a missing legacy claim is interpreted as `0`.

NasDash increments the stored version when an administrator changes a password, role, tab allowlist or widget allowlist. Every authenticated API request compares the JWT version with the current stored user. A deleted user or mismatched version is rejected immediately, and current role/permission values replace stale claims from the token.
