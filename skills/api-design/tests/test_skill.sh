#!/usr/bin/env bash
# tests/test_skill.sh — validates api-design/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[api-design] linting endpoints..."
OUT=$($RUN --lint --endpoint "GET /users -> 200" --endpoint "POST /user -> 200" --endpoint "DELETE /users/{id} -> 200")
echo "$OUT"
echo "$OUT" | grep -q "looks singular" || { echo "FAIL: should flag singular path segment"; exit 1; }
echo "$OUT" | grep -q "POST typically returns 201" || { echo "FAIL: should flag POST status convention"; exit 1; }
echo "$OUT" | grep -q "DELETE typically returns 204" || { echo "FAIL: should flag DELETE status convention"; exit 1; }
if echo "$OUT" | grep -A2 '"endpoint": "GET /users -> 200"' | grep -q '"severity"'; then
  echo "FAIL: well-formed GET /users -> 200 should not be flagged"
  exit 1
fi

echo "[api-design] diffing specs for breaking changes..."
cat > old.json << 'EOF'
{
  "paths": {
    "/users": {
      "get": {
        "responses": { "200": { "content": { "application/json": { "schema": { "properties": { "id": {"type": "string"}, "name": {"type": "string"} } } } } } }
      },
      "post": {
        "requestBody": { "content": { "application/json": { "schema": { "required": ["name"] } } } }
      }
    },
    "/legacy": {
      "get": {}
    }
  }
}
EOF

cat > new.json << 'EOF'
{
  "paths": {
    "/users": {
      "get": {
        "responses": { "200": { "content": { "application/json": { "schema": { "properties": { "id": {"type": "integer"}, "name": {"type": "string"}, "email": {"type": "string"} } } } } } }
      },
      "post": {
        "requestBody": { "content": { "application/json": { "schema": { "required": ["name", "email"] } } } }
      }
    }
  }
}
EOF

OUT2=$($RUN --diff --old old.json --new new.json)
echo "$OUT2"
echo "$OUT2" | grep -q "Endpoint removed" || { echo "FAIL: should flag removed /legacy endpoint"; exit 1; }
echo "$OUT2" | grep -q "now required but was not before" || { echo "FAIL: should flag newly required field"; exit 1; }
echo "$OUT2" | grep -q "type changed" || { echo "FAIL: should flag response field type change"; exit 1; }
echo "$OUT2" | grep -q "email.*added\|added.*email" || { echo "FAIL: should report added field as non-breaking"; exit 1; }

echo "[api-design] checking required args..."
if $RUN --lint 2>/dev/null; then
  echo "FAIL: should require at least one --endpoint"
  exit 1
fi
if $RUN --diff --old old.json 2>/dev/null; then
  echo "FAIL: should require both --old and --new"
  exit 1
fi

echo "PASS: all api-design skill checks passed"
