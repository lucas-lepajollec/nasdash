#!/bin/sh
set -eu

if [ "${NASDASH_DEMO_MODE:-false}" = "true" ]; then
  echo "[NASDASH] Public demo mode: using isolated temporary fictional data."
  exec "$@"
fi

# Initialize as the actual user, including Compose user overrides.
umask 077
node /app/scripts/container-bootstrap.mjs
echo "[NASDASH] Starting the application..."
exec "$@"
