#!/usr/bin/env bash
# tests/test_skill.sh — validates design-to-code/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"

cat > spec.json << 'EOF'
{
  "name": "Card",
  "props": { "title": "string", "count": 4 },
  "children": [
    { "name": "h2", "children": ["{{ title }}"] },
    { "name": "p", "children": ["Count: {{ count }}"] }
  ]
}
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[design-to-code] generating SFC from spec..."
OUT=$($RUN --spec spec.json --output Card.vue)
echo "$OUT"
echo "$OUT" | grep -q '"componentCount": 3' || { echo "FAIL: expected 3 components (Card, h2, p)"; exit 1; }

test -f Card.vue || { echo "FAIL: Card.vue was not created"; exit 1; }
grep -q '<script setup lang="ts">' Card.vue || { echo "FAIL: missing script setup block"; exit 1; }
grep -q "interface Props" Card.vue || { echo "FAIL: missing Props interface"; exit 1; }
grep -q "title: string;" Card.vue || { echo "FAIL: title should infer as string"; exit 1; }
grep -q "count: number;" Card.vue || { echo "FAIL: count should infer as number (numeric value 4)"; exit 1; }
grep -q "<card" Card.vue || { echo "FAIL: Card should render kebab-case as <card>"; exit 1; }
grep -q "<style scoped>" Card.vue || { echo "FAIL: missing style block"; exit 1; }

echo "[design-to-code] checking overwrite protection without --force..."
if $RUN --spec spec.json --output Card.vue 2>/dev/null; then
  echo "FAIL: should refuse to overwrite without --force"
  exit 1
fi

echo "[design-to-code] checking --force allows overwrite..."
$RUN --spec spec.json --output Card.vue --force > /dev/null

echo "PASS: all design-to-code skill checks passed"
