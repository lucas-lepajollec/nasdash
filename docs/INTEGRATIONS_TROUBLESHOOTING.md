# Integration and monitoring troubleshooting

NasDash distinguishes temporary reachability failures from configuration errors. Temporary failures are logged as retryable warnings; invalid credentials, missing endpoints and malformed responses remain visible as errors.

Before changing NasDash configuration, test the target from the same network namespace as the NasDash container. A service reachable from a laptop may still be blocked by Docker networking, DNS or a host firewall.

## Glances

### Supported endpoint discovery

For a base URL such as `http://glances-host:61208`, NasDash tries these endpoints in order and caches the first working one:

```text
/api/5/all
/api/4/all
/api/3/all
/api/2/all
```

You may also enter the complete working `/api/<version>/all` URL. Do not use the browser dashboard URL if it returns HTML instead of JSON.

### Test from the NasDash container

Replace the example hostname with the value resolvable from the container:

```bash
docker exec nasdash node -e "fetch('http://glances-host:61208/api/4/all').then(async r => { console.log(r.status, r.headers.get('content-type')); console.log((await r.text()).slice(0, 200)); }).catch(console.error)"
```

- `200` with JSON: the endpoint is usable.
- `404`: the selected API version is absent; test the other versions or provide only the base URL so NasDash can discover it.
- `401` or `403`: verify Glances authentication and the `username:password` value configured in NasDash.
- Timeout, `ECONNREFUSED` or `ENETUNREACH`: Glances is stopped, overloaded, bound to another interface, or blocked between the containers/hosts.
- HTML instead of JSON: the URL targets the web interface or a reverse-proxy error page rather than the REST endpoint.

Intermittent timeouts paired with Glances errors such as `OSError: [Errno 24] No file descriptors available` indicate a failure inside the Glances process. Restart and update that service, inspect its resource limits and logs, then repeat the endpoint test. NasDash will continue retrying automatically and intentionally records this state as a warning rather than a permanent configuration error.

## Proxmox VE

- Use the API base URL, normally `https://HOST:8006`.
- Prefer a dedicated token with the minimum read permissions required for the selected node, VM, container or storage.
- A `401` or `403` is a credential/permission error, not an offline host.
- A timeout or connection refusal is retryable and usually means the host or port is temporarily unavailable.
- NasDash accepts local self-signed Proxmox certificates, but a reverse proxy or hostname mismatch can still cause TLS errors.

## Docker hosts

- The bundled Compose example expects `docker-proxy:2375` from the NasDash container.
- A remote proxy must bind only to a private LAN or VPN address and be protected by a firewall.
- Never expose an unauthenticated Docker API to the internet.
- `401`, `403` and malformed proxy responses point to configuration or permissions; timeouts and unreachable hosts are retryable warnings.

See the remote Docker example in [the README](../README.md#remote-docker-hosts).

## Tailscale

- The tailnet, OAuth client ID and OAuth client secret must belong to the same Tailscale configuration.
- Store the client secret only through NasDash settings; it is encrypted at rest and masked in API responses.
- Confirm that the OAuth client can list devices in the requested tailnet.
- The public demo never contacts Tailscale and never accepts real credentials.

## What to include in a bug report

Record the integration type, NasDash version/image digest, the redacted configured URL, HTTP status or network error code, whether the failure is permanent or intermittent, and the relevant remote-service logs. Never publish passwords, tokens, cookies, private keys or an unredacted `data/` directory.
