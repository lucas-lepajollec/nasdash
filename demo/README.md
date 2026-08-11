# NasDash public demo fixtures

This directory is the only data source used by the public showcase container.
Every value must remain fictional: no private address copied from a real setup,
credential, token, password hash, uploaded logo, or personal calendar entry.

`npm run demo` starts the isolated demo with hot reload on
<http://localhost:2505> without building an image or copying files into
`data/`. `npm run demo:docker` performs the production-like container check.
The Docker profile has no volume, host PID namespace, Docker socket, Docker
proxy, or route to a real NasDash installation. Data is reset from these
fixtures whenever the server starts.
