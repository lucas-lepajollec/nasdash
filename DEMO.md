# Public demo

NasDash uses one repository and one application for both self-hosted production
and the public showcase. The demo is a runtime profile, not a fork and not a
second backend.

## Isolation model

When `NASDASH_DEMO_MODE=true`:

- the server reads only the tracked fictional files in `demo/fixtures`;
- a configured `NASDASH_DATA_DIR` is deliberately ignored;
- the visitor receives a synthetic demo administrator profile without login;
- settings, custom CSS, categories, topology and Docker actions remain usable;
- changes are isolated by a random browser cookie, kept only in server memory
  and discarded after 30 minutes of inactivity;
- service probes, device statistics, system latency and Docker APIs return
  deterministic simulations without contacting the configured URLs;
- background infrastructure monitoring is not started;
- Docker logs are fictional but fully inspectable;
- account management, uploads and real service links stay blocked.

The Docker demo adds another layer: its container filesystem is read-only, it
drops all Linux capabilities, has no host PID namespace, volume, Docker socket
or Docker proxy, and uses an internal Docker network. A fixed unprivileged
Nginx reverse proxy is the only service attached to both that network and the
published port.

## Fast local development

Run the isolated showcase directly with Next.js and hot reload:

```bash
npm run demo
```

Open <http://localhost:2505>. This command sets the server-only demo profile
for its child process and never copies files into `data/`. Use
`NASDASH_DEMO_PORT` to select another port when needed.

## Production-like Docker check

Build and run the hardened container through the npm shortcut:

```bash
npm run demo:docker
```

Open <http://localhost:2505>. Stop it with:

```bash
npm run demo:docker:down
```

## GitHub and hosting

Do not create a second repository. After this branch is reviewed and merged,
`main` remains the single source of truth for both editions.

For a hosted showcase, create a second project at the hosting provider and
connect it to the same GitHub repository. Configure this project only with:

```text
NASDASH_DEMO_MODE=true
NASDASH_JWT_SECRET=<a random deployment secret>
```

Do not attach a persistent data volume, Docker socket, private-network
connector, VPN or real NasDash environment variables to the public project.
The provider can deploy `main` automatically while pull requests receive
isolated preview deployments.

Vercel is a possible target because no state must survive, but a recycled
instance may reset a visitor sandbox before the 30-minute inactivity limit.
It is not marked as supported until a real preview deployment, interactive
mutations and streaming routes have been exercised there. A conventional
Docker host can use `docker-compose.demo.yml` directly.

### First Vercel deployment

1. Push the demo feature branch and open a pull request against `main`.
2. Wait for the GitHub tests and production build to pass, then merge the pull
   request.
3. In Vercel, choose **Add New > Project**, import the existing `nasdash`
   repository and keep `main` as the Production Branch.
4. Keep the project root at the repository root, select the **Next.js** preset
   and leave the standard install/build/output settings unchanged.
5. Add `NASDASH_DEMO_MODE=true` for Production and Preview. Also add a random
   `NASDASH_JWT_SECRET` for both environments as defense in depth; never reuse
   the secret from a real NasDash installation.
6. Deploy, then exercise configuration changes, reset, Docker actions/logs,
   network topology, mobile layout and the `/api/health` endpoint on the
   generated preview URL.

Once connected, Vercel automatically creates a Preview deployment for branch
pushes and a Production deployment for updates merged into `main`. No second
GitHub repository and no manual file synchronization are required.
