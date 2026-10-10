#!/bin/sh
# NasDash Docker entrypoint
# Initialise les fichiers de données depuis les exemples si absent

DEFAULTS_DIR="/app/defaults"
DATA_DIR="/app/data"

if [ "${NASDASH_DEMO_MODE:-false}" = "true" ]; then
  echo "[NASDASH] Public demo mode: using isolated temporary fictional data."
  exec "$@"
fi

echo "[NASDASH] Updating configuration templates..."

# Toujours mettre à jour les fichiers d'exemples dans le volume monté pour qu'ils soient de la dernière version
for file in config.example.json services.example.json topology.example.json calendar.example.json custom_tabs.example.json users.example.json; do
  if [ -f "$DEFAULTS_DIR/$file" ]; then
    cp "$DEFAULTS_DIR/$file" "$DATA_DIR/$file"
  fi
done

# Fonction utilitaire d'initialisation
init_file() {
  TARGET="$DATA_DIR/$1"
  EXAMPLE="$DATA_DIR/$2"
  if [ ! -f "$TARGET" ]; then
    if [ -f "$EXAMPLE" ]; then
      cp "$EXAMPLE" "$TARGET"
      echo "[NASDASH] ✅ Created: $1 (from $2)"
    else
      echo "[NASDASH] ⚠️  Missing example for $1"
    fi
  else
    echo "[NASDASH] ✓  $1 already exists"
  fi
}

# S'assurer que le dossier data et logos existent
mkdir -p "$DATA_DIR/logos"

# Initialiser chaque fichier depuis son exemple si absent
init_file "config.json"      "config.example.json"
init_file "services.json"    "services.example.json"
init_file "topology.json"    "topology.example.json"
init_file "calendar.json"    "calendar.example.json"
init_file "custom_tabs.json" "custom_tabs.example.json"
init_file "users.json"       "users.example.json"

echo "[NASDASH] Starting the application..."
exec "$@"
