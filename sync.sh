#!/usr/bin/env bash

set -euo pipefail

usage() {
  cat <<'USAGE'
Usage:
  ./sync.sh <host> [remote_theme_path]

Examples:
  ./sync.sh user@example.com /var/www/html/wp-content/themes/kaffen-child
  REMOTE_THEME_PATH=/var/www/html/wp-content/themes/kaffen-child ./sync.sh user@example.com

Optional:
  DRY_RUN=1 ./sync.sh user@example.com /var/www/html/wp-content/themes/kaffen-child
USAGE
}

if [[ "${1:-}" == "-h" || "${1:-}" == "--help" ]]; then
  usage
  exit 0
fi

if [[ $# -lt 1 || $# -gt 2 ]]; then
  usage
  exit 1
fi

HOST="$1"
REMOTE_THEME_PATH="${2:-${REMOTE_THEME_PATH:-}}"

if [[ -z "${REMOTE_THEME_PATH}" ]]; then
  echo "Error: missing remote theme path."
  echo "Pass it as second parameter or set REMOTE_THEME_PATH."
  usage
  exit 1
fi

# Remove trailing slash for clean path joining.
REMOTE_THEME_PATH="${REMOTE_THEME_PATH%/}"

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
THEME_DIR="${ROOT_DIR}/wp-content/themes/kaffen-child"

FILES=(
  "page-templates/landing-coffee-box.php"
  "assets/css/eva-coffee-box.css"
  "assets/js/eva-coffee-box.js"
  "functions.php"
)

for file in "${FILES[@]}"; do
  if [[ ! -f "${THEME_DIR}/${file}" ]]; then
    echo "Error: local file not found: ${THEME_DIR}/${file}"
    exit 1
  fi
done

RSYNC_OPTS=(
  -avz
  --progress
  --human-readable
  --mkpath
)

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  RSYNC_OPTS+=(--dry-run)
fi

echo "Syncing files to ${HOST}:${REMOTE_THEME_PATH}"
if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "DRY_RUN enabled: no files will be changed on remote"
fi

rsync "${RSYNC_OPTS[@]}" \
  --files-from=<(printf '%s\n' "${FILES[@]}") \
  "${THEME_DIR}/" \
  "${HOST}:${REMOTE_THEME_PATH}/"

echo "Sync complete."
