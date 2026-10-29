# NasDash public demo fixtures

This directory is the only data source used by the public showcase container.
Every value must remain fictional: no private address copied from a real setup,
credential, token, password hash, uploaded logo, or personal calendar entry.

`npm run demo` starts the isolated demo with hot reload on
<http://localhost:2505> without building an image or copying files into
`data/`. It remains loopback-only unless `npm run demo:lan` is used.
`npm run demo:docker` performs the production-like container check.
The Docker profile has no volume, host PID namespace, Docker socket, Docker
proxy, or route to a real NasDash installation. Each server starts from these
fixtures. A visitor’s temporary workspace belongs to its browser tab and can
survive reloads and worker changes; the explicit Reset action restores the
fixtures. Legacy cookie-only API clients do not have distributed persistence.

## Arranging the demo by hand

Start a local demo that records its edits, arrange pages, widgets and the look in
the browser, then copy the result into these fixtures:

```bash
NASDASH_DEMO_AUTHORING_DIR=.project-local/demo-authoring npm run demo
npm run demo:authoring:apply
```

Pages, appearance settings, services and the network map come back; integrations,
devices and Docker hosts stay as written here. Review the diff before committing.
Never set `NASDASH_DEMO_AUTHORING_DIR` on the public demo: it would record
visitors' edits.
