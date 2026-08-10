# NasDash backup and restore

NasDash is self-hosted: all persistent configuration, local accounts, encrypted
credentials, encryption keys, session secrets, and uploaded logos live in the
`data/` directory. A usable backup must preserve that entire directory, not only
`config.json`.

Backups contain secrets. Store them with the same care as the live `data/`
directory and never commit them to Git. The default `backups/` directory is
excluded by `.gitignore`.

## Create a backup

Stop NasDash first so all files belong to one consistent snapshot:

```bash
docker compose stop nasdash
npm run data:backup
docker compose start nasdash
```

The command creates a timestamped directory under `backups/`. To choose another
destination, for example a mounted NAS backup volume:

```bash
npm run data:backup -- --output /mnt/backups/nasdash-2026-08-10
```

## Restore a backup

Restoration replaces the active `data/` directory and therefore requires both a
stopped application and the explicit `--force` flag:

```bash
docker compose stop nasdash
npm run data:restore -- --from /mnt/backups/nasdash-2026-08-10 --force
docker compose start nasdash
```

Before replacement, NasDash renames the current directory to a timestamped
`data.pre-restore-*` recovery directory. Keep it until login, configuration,
logos, topology, and integrations have been verified.

If the application runs from a different working directory, use `--source` for
backup or `--target` for restore. Never restore while NasDash is running.
