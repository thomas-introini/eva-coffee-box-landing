#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 1 || $# -gt 2 ]]; then
  echo "Usage: $0 <base_url> [cookie_jar]"
  echo "Example: $0 https://example.it cookies.txt"
  exit 1
fi

BASE_URL="${1%/}"
COOKIE_JAR="${2:-cookies.txt}"

curl -i \
  -c "$COOKIE_JAR" \
  -b "$COOKIE_JAR" \
  -H "Accept: application/json" \
  "${BASE_URL}/wp-json/wc/store/v1/cart"
