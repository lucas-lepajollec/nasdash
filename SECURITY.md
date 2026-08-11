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

For deployment guidance, see [README.md](README.md), [ACCESS_CONTROL.md](ACCESS_CONTROL.md) and [BACKUP_AND_RESTORE.md](BACKUP_AND_RESTORE.md).
