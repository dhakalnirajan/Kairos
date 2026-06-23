#!/usr/bin/env bash
# tests/test_skill.sh — validates testing/scripts/run.ts
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

echo "[testing] forcing pytest framework with no pytest installed (expect graceful JSON, non-crash)..."
OUT=$($RUN --framework pytest 2>&1) || true
echo "$OUT" | tail -8
echo "$OUT" | grep -q '"framework": "pytest"' || { echo "FAIL: missing framework field"; exit 1; }

echo "[testing] checking schema fields present for vitest path..."
echo '{"devDependencies":{"vitest":"^1.0.0"}}' > package.json
OUT2=$($RUN --framework vitest 2>&1) || true
for field in '"framework"' '"passed"' '"failed"' '"skipped"' '"failures"' '"coverage"'; do
  echo "$OUT2" | grep -q "$field" || { echo "FAIL: missing field $field"; exit 1; }
done

echo "PASS: all testing skill checks passed"
