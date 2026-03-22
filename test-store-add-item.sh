#!/usr/bin/env bash

set -euo pipefail

if [[ $# -lt 3 || $# -gt 6 ]]; then
  echo "Usage: $0 <base_url> <nonce> <cart_token> [product_id] [variation_json] [cookie_jar]"
  echo "Example (Level Up): $0 https://example.it YOUR_NONCE YOUR_CART_TOKEN"
  echo 'Example (Boss Mode): $0 https://example.it YOUR_NONCE YOUR_CART_TOKEN 4088 "[{"attribute":"attribute_macinatura-caffe-moka-espresso","value":"Chicchi"},{"attribute":"attribute_pa_macinatura-caffe-filtro","value":"Filtro"}]" cookies.txt'
  exit 1
fi

BASE_URL="${1%/}"
NONCE="$2"
CART_TOKEN="$3"
PRODUCT_ID="${4:-4166}"
VARIATION_JSON="${5:-[{\"attribute\":\"attribute_macinatura-caffe-moka-espresso\",\"value\":\"Chicchi\"}]}"
COOKIE_JAR="${6:-cookies.txt}"

curl -i \
  -c "$COOKIE_JAR" \
  -b "$COOKIE_JAR" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -H "Nonce: ${NONCE}" \
  -H "Cart-Token: ${CART_TOKEN}" \
  -X POST \
  --data "{\"id\":${PRODUCT_ID},\"quantity\":1,\"variation\":${VARIATION_JSON}}" \
  "${BASE_URL}/wp-json/wc/store/v1/cart/add-item"
