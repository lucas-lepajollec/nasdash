import type { DockerFailureCode, DockerFailurePayload } from './dockerErrorContract';

// API error strings remain translation keys. Operational logs use canonical
// English copy, indexed by the same stable failure codes as the API contract.
const COPY = {
  invalid_socket: ['Invalid Docker socket path.', 'Use an absolute mounted .sock path without traversal.'],
  socket_missing: ['Docker socket not found.', 'Check the socket path and container mount.'],
  invalid_url: ['Invalid Docker host address.', 'Enter a complete HTTP(S) URL with the correct Docker port.'],
  access_denied: ['Docker API access denied.', 'Check authentication, proxy configuration and Docker API permissions.'],
  endpoint_not_found: ['Docker API endpoint not found.', 'Check the address, port and whether the target exposes the Docker Engine API.'],
  api_error: ['Docker API returned an HTTP error.', 'Check the Docker or proxy logs on the remote host.'],
  invalid_response: ['Docker API returned an invalid response.', 'Check that the address targets the Docker API, not a web page or an incorrect proxy.'],
  timeout: ['Docker host did not respond before the timeout.', 'It may be stopped, overloaded or temporarily unreachable. NasDash will retry automatically.'],
  name_resolution: ['Docker hostname cannot currently be resolved.', 'If this persists, check the hostname and DNS available to NasDash.'],
  tls_error: ['Docker host TLS connection failed.', 'Check the certificate, hostname and Docker proxy HTTPS configuration.'],
  host_unreachable: ['Docker host is currently unreachable.', 'It may be stopped or its port may be closed. If this persists, check the configured address and port.'],
} satisfies Record<DockerFailureCode, readonly [string, string]>;

export function dockerFailureLogText(failure: DockerFailurePayload): string {
  const [message, hint] = COPY[failure.code];
  const status = failure.error.match(/\bHTTP (\d{3})\b/)?.[1];
  return `[${failure.code}] ${message}${status ? ` HTTP ${status}.` : ''} ${hint}`;
}
