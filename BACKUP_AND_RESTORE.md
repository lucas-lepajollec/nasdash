# NasDash backup, restore and upgrade

NasDash stores all persistent state in `/app/data`: configuration, local accounts, password hashes, encrypted credentials, encryption keys, session secrets and uploaded logos. Back up the complete data store, not only `config.json`.

Backups contain secrets. Keep them private and never commit them to Git.

## Named Docker volume (recommended Compose example)

The published-image example uses the stable volume name `nasdash-data`.

### Backup

Stop writes, create an archive on the host, then restart NasDash:

```bash
mkdir -p backups
docker compose -f docker-compose.named-volume.yml stop nasdash
docker run --rm \
  --volume nasdash-data:/source:ro \
  --volume "$PWD/backups:/backup" \
  alpine sh -c 'tar -czf /backup/nasdash-data-backup.tar.gz -C /source .'
docker compose -f docker-compose.named-volume.yml start nasdash
```

Rename the archive with a date and keep at least one copy outside the Docker host.

### Restore

Restoration replaces the active volume. First preserve the current state with the backup command above, then select the exact archive and run:

```bash
docker compose -f docker-compose.named-volume.yml stop nasdash
docker run --rm \
  --volume nasdash-data:/target \
  --volume "$PWD/backups:/backup:ro" \
  alpine sh -c 'find /target -mindepth 1 -maxdepth 1 -exec rm -rf {} + && tar -xzf /backup/nasdash-data-backup.tar.gz -C /target'
docker compose -f docker-compose.named-volume.yml start nasdash
```

Verify login, services, logos, topology and integrations before deleting the pre-restore backup archive.

## Bind-mounted `./data` directory

The repository includes tested snapshot tooling for installations that expose their data directory on the host.

### Backup

```bash
docker compose stop nasdash
npm run data:backup
docker compose start nasdash
```

The command creates a timestamped directory below `backups/`. To use another destination:

```bash
npm run data:backup -- --output /mnt/backups/nasdash-2026-08-10
```

### Restore

```bash
docker compose stop nasdash
npm run data:restore -- --from /mnt/backups/nasdash-2026-08-10 --force
docker compose start nasdash
```

Before replacing the target, the tool renames the current directory to `data.pre-restore-*`. Keep that recovery directory until the restored instance has been checked.

Use `--source` for backup or `--target` for restore when the active directory is not `<project>/data`. Never restore while NasDash is running.

## Safe upgrade checklist

1. Create and verify a backup.
2. Keep the current image tag or digest recorded so rollback remains possible.
3. Pull/build the new image.
4. Recreate the containers without deleting the persistent volume.
5. Verify `/api/health`, login, configuration, topology, logos and each configured integration.
6. Keep the backup until the new version has run normally for an appropriate period.

For the published image:

```bash
docker compose -f docker-compose.named-volume.yml pull
docker compose -f docker-compose.named-volume.yml up -d
docker compose -f docker-compose.named-volume.yml ps
docker compose -f docker-compose.named-volume.yml logs --tail 100 nasdash
```

Do not use `docker compose down -v` during an ordinary update: `-v` deletes the named data volume.

## Secrets and key continuity

- If `NASDASH_JWT_SECRET` was configured before first use, restore the same value with the data.
- If it was left empty, `jwt.secret` and `encryption.key` inside the data store provide continuity and must remain in the backup.
- Do not introduce or change `NASDASH_JWT_SECRET` after credentials have already been encrypted unless you plan to re-enter those credentials.
