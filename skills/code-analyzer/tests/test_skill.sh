#!/usr/bin/env bash
# tests/test_skill.sh — validates code-analyzer/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p src

cat > src/a.ts << 'EOF'
import { b } from "./b";
export function a() { return b(); }
EOF
cat > src/b.ts << 'EOF'
import { a } from "./a";
export function b() { return 1; }
EOF
cat > src/c.ts << 'EOF'
import { a } from "./a";
export function c() { return a(); }
export function unusedFn() { return 0; }
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[code-analyzer] checking cycle detection (a <-> b)..."
OUT=$($RUN --scope src --check cycles)
echo "$OUT"
echo "$OUT" | grep -q '"cycles"' || { echo "FAIL: missing cycles key"; exit 1; }
CYCLE_COUNT=$(echo "$OUT" | grep -c '\.ts"' || true)
if [ "$CYCLE_COUNT" -lt 1 ]; then
  echo "FAIL: expected at least one cycle entry"
  exit 1
fi

echo "[code-analyzer] checking unused-exports detection..."
OUT2=$($RUN --scope src --check unused-exports)
echo "$OUT2"
echo "$OUT2" | grep -q "unusedFn" || { echo "FAIL: unusedFn should be flagged as unused"; exit 1; }
if echo "$OUT2" | grep -q '"export": "a"'; then
  echo "FAIL: a() is imported elsewhere, should not be flagged unused"
  exit 1
fi

echo "[code-analyzer] checking hotspots..."
OUT3=$($RUN --scope src --check hotspots --top 2)
echo "$OUT3"
echo "$OUT3" | grep -q '"fanIn"' || { echo "FAIL: missing fanIn field"; exit 1; }

echo "[code-analyzer] checking --scope required..."
if $RUN --check cycles 2>/dev/null; then
  echo "FAIL: should require --scope"
  exit 1
fi

echo "PASS: all code-analyzer skill checks passed"
