# Security policy

NasDash is a self-hosted application that can access infrastructure monitoring APIs and Docker hosts. Please report suspected vulnerabilities privately so maintainers have time to investigate and prepare a fix before technical details become public.

## Supported versions

| Version | Support status |
| --- | --- |
| Latest published release and `main` | Supported |
| Older releases | Best effort; upgrading may be required |
| Third-party forks or unofficial images | Not supported by the NasDash maintainers |

## Reporting a vulnerability

Use the repository's [private vulnerability reporting form](https://github.com/lucas-lepajollec/nasdash/security/advisories/new).

If private reporting is not available, open a minimal issue asking the maintainer for a private contact channel. Do not include exploit code, credentials, tokens, private URLs, configuration files or other sensitive details in a public issue.

Please include, when possible:

- the affected NasDash version, image tag or commit;
- the deployment method and relevant environment details;
- clear reproduction steps and the security impact;
- sanitized logs, requests or a minimal proof of concept;
- any known workaround.

You should receive an acknowledgement within seven days and an initial assessment within fourteen days. Remediation and disclosure timing depend on severity, complexity and release coordination. Please allow a reasonable remediation window before publishing details.

## Operational security questions

Configuration mistakes, inaccessible integrations and general support requests are not vulnerabilities. Use a normal GitHub issue for those cases after removing passwords, API tokens, cookies, private addresses and the contents of the persistent `data/` directory.

For deployment guidance, see [README.md](README.md), [access rules](https://docs.nasdash.lucas-homelab.fr/en/docs/guide/authentication-roles) and [backup procedures](https://docs.nasdash.lucas-homelab.fr/en/docs/operations/backup).

## Trust boundaries

- NasDash may contact only service and device endpoints explicitly saved by an administrator. Viewer-supplied ping URLs are matched against that exact configured set.
- TLS certificates are verified for credential-bearing HTTPS integrations unless an administrator explicitly enables self-signed acceptance for that connection. Prefer a private CA with `NODE_EXTRA_CA_CERTS`; never disable verification globally. Service pings carry no credentials and accept self-signed certificates for their configured targets.
- Docker socket or TCP access is equivalent to privileged infrastructure access. Keep it on a trusted network, use the least-privileged proxy available, and never expose an unauthenticated Docker API.
- Uploaded logos, custom CSS and the persistent `data/` directory are administrator-controlled data. Backups therefore need the same confidentiality as the live deployment.
