# First installation and Synology permissions

The published image runs as **UID:GID `1001:1001`**, without root privileges. A bind mount keeps its host permissions; image ownership does not change the mounted folder. NasDash does not support `PUID` / `PGID` environment variables. Use Compose's `user` field when another runtime identity is needed.

## Prepare a new Linux bind mount

Before `docker compose up -d`, create the data directory alongside your Compose file:

```bash
mkdir -p ./data
sudo chown 1001:1001 ./data
sudo chmod 700 ./data
```

These commands prepare a **new, empty** directory. For an existing installation, stop NasDash, back up the complete data store and retain its mount. Correct access for the selected identity, including existing files, the `logos` directory, and parent-folder traversal. Do not delete data to fix permissions, run as root, or use `chmod 777`.

## Synology DSM / Container Manager

1. Create a dedicated DSM account and grant it read/write permission on the NasDash data folder in File Station / shared-folder permissions. Check inherited ACLs and explicit deny rules as well as the mount's read/write setting.
2. If SSH access is available, run `id nasdash-user` on the NAS, replacing `nasdash-user` with that account. Record its numeric UID and primary GID; do not assume every NAS uses the same values.
3. Add `user` to the **NasDash service only**, using those numbers. For example, for an account whose UID is `1026` and GID is `100`:

```yaml
services:
  nasdash:
    user: "1026:100"
```

This is a fragment to add to the full Compose file, not a replacement. Keep the same data mount and the existing Docker proxy configuration. Create the host data folder before starting the project. For an existing installation, the selected user must also be able to read its existing account/key files; changing `user` alone does not transfer ownership or fix ACLs.

NasDash checks data access before starting and reports the actual runtime UID:GID. If it cannot create, rename and remove files in the data folder or `logos`, or read existing files, it exits with a permission diagnostic. Correct the access and recreate the container; rebuilding the image cannot fix host-folder permissions. A custom `NASDASH_DATA_DIR` must point to the container-side mounted path.

If an older bundled Compose rejects `env_file.required`, remove the entire optional `env_file` block when not using `.env`. If you deliberately use an existing `.env`, use the supported short form `env_file: .env` instead. Leave the other service settings intact.

See [Synology's mapped-folder permission guidance](https://kb.synology.com/en-us/DSM/tutorial/Docker_container_cant_access_the_folder_or_file), [Docker bind mounts](https://docs.docker.com/engine/storage/bind-mounts/) and [Compose `user`](https://docs.docker.com/reference/compose-file/services/#user). The regression tests exercise Linux Docker UID/GID behavior; they do not substitute for testing on a real DSM installation.

## Initial passwords

```bash
docker compose up -d
docker compose ps
docker compose logs nasdash
```

New accounts are initialized at server startup, before readiness or a browser connection. The generated `admin` and `viewer` passwords appear **once**, only after their hashes have been saved. Container logs include both stdout and stderr; on Synology inspect the NasDash container's startup log, including warning/error output. Do not share initial-password lines in a feedback report.

You can instead set `NASDASH_ADMIN_PASSWORD` and `NASDASH_VIEWER_PASSWORD` through the optional untracked `.env` **before the first start**. These values initialize new accounts; they do not override an existing account's password. Change temporary passwords in Settings after logging in.

Restarting, pulling or rebuilding preserves existing accounts and cannot recover the original plaintext password from its hash. Keep the same data mount; do not switch to an empty volume to regain access.

## Recover a lost password without reinstalling

An operator with local access to the data volume can reset one existing account offline. Back up the complete data store first, then stop NasDash so its in-memory account cache cannot overwrite the update:

```bash
docker compose stop nasdash
docker compose run --rm --no-deps --entrypoint node nasdash scripts/reset-password.mjs admin
docker compose up -d nasdash
```

The terminal asks for a new password and confirmation with input hidden. Use at least 12 characters. The command preserves the other accounts, permissions, settings, signing key and encrypted integrations, and invalidates old sessions for the selected account. It fails without changing accounts if input or storage is invalid. If recovery fails, correct the cause before starting again. The command needs the same volume and runtime UID/GID as NasDash; use an SSH terminal on Synology when its UI cannot attach an interactive terminal. Password arguments are rejected; automated use accepts one line on stdin rather than a password in shell history.

The recovery helper and startup fixes are available in version `0.2.2` or later; the immutable `0.2.1` image retains its original first-login initialization and has no recovery helper. Use `ghcr.io/lucas-lepajollec/nasdash:0.2.2`, a newer release or its recorded digest. Do not mix a newer source checkout with an older pinned container when following these commands.

## Share feedback

Use [GitHub's issue chooser](https://github.com/lucas-lepajollec/nasdash/issues/new/choose): **User feedback** for experience reports, **Bug report** for reproducible problems, and **Feature request** for suggestions. Include the NasDash version, DSM/Container Manager versions and sanitized settings such as the runtime `user` and volume mapping. Remove passwords (including startup log lines), tokens and private infrastructure details. Report security vulnerabilities privately through the repository's Security tab.
