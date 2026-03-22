#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 3 || $# -gt 4 ]]; then
  echo "Usage: $0 <base_url> <nonce> <cart_token> [cookie_jar]"
  echo "Example: $0 https://example.it YOUR_NONCE YOUR_CART_TOKEN cookies.txt"
  exit 1
fi

BASE_URL="${1%/}"
NONCE="$2"
CART_TOKEN="$3"
COOKIE_JAR="${4:-cookies.txt}"

curl -i \
  -c "$COOKIE_JAR" \
  -b "$COOKIE_JAR" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Nonce: ${NONCE}" \
  -H "Cart-Token: ${CART_TOKEN}" \
  -X POST \
  --data '{
    "id": 4166,
    "quantity": 1,
    "variation": [
      {
        "attribute": "attribute_macinatura-caffe-moka-espresso",
        "value": "Chicchi"
      }
    ]
  }' \
  "${BASE_URL}/wp-json/wc/store/v1/cart/add-item"
