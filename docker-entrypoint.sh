#!/bin/sh
# NasDash Docker entrypoint
# Initialise les fichiers de données depuis les exemples si absent

DATA_DIR="/app/data"

echo "[NASDASH] Vérification des fichiers de données..."

# Fonction utilitaire
init_file() {
  TARGET="$DATA_DIR/$1"
  EXAMPLE="$DATA_DIR/$2"
  if [ ! -f "$TARGET" ]; then
    if [ -f "$EXAMPLE" ]; then
      cp "$EXAMPLE" "$TARGET"
      echo "[NASDASH] ✅ Créé : $1 (depuis $2)"
    else
      echo "[NASDASH] ⚠️  Exemple manquant pour $1 — sera généré au premier démarrage de l'app"
    fi
  else
    echo "[NASDASH] ✓  $1 existe déjà"
  fi
}

# S'assurer que le dossier data et logos existent
mkdir -p "$DATA_DIR/logos"

# Initialiser chaque fichier depuis son exemple
init_file "config.json"      "config.example.json"
init_file "services.json"    "services.example.json"
init_file "topology.json"    "topology.example.json"
init_file "calendar.json"    "calendar.example.json"
init_file "custom_tabs.json" "custom_tabs.example.json"
# users.json est toujours auto-généré par auth.ts au démarrage (comptes admin/viewer)

echo "[NASDASH] Démarrage de l'application..."
exec "$@"
