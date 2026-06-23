#!/usr/bin/env bash
# tests/test_skill.sh — validates tdd/scripts/run.ts cycle behavior
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p src
cat > src/date.ts << 'EOF'
export function parseDate(s: string): Date | null {
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[tdd] writing first test (expect red, since assertion is a deliberate placeholder)..."
OUT1=$($RUN --behavior "parseDate returns null for invalid input" --target src/date.ts --framework vitest 2>&1) || true
echo "$OUT1"
echo "$OUT1" | grep -q '"target": "src/date.ts"' || { echo "FAIL: missing target in output"; exit 1; }

echo "[tdd] checking second behavior on same target is blocked while unresolved..."
if $RUN --behavior "parseDate handles ISO 8601" --target src/date.ts --framework vitest 2>/dev/null; then
  STATUS=$(cat .tdd-state.json | grep -o '"status": "[a-z]*"' | head -1)
  if echo "$STATUS" | grep -q "red\|broken"; then
    echo "FAIL: second cycle should have been blocked"
    exit 1
  fi
fi

echo "[tdd] checking --status reports recorded state..."
STATUS_OUT=$($RUN --status --target src/date.ts)
echo "$STATUS_OUT" | grep -q "status" || { echo "FAIL: --status did not report state"; exit 1; }

echo "PASS: all tdd skill checks passed"
