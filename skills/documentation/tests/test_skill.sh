#!/usr/bin/env bash
# tests/test_skill.sh — validates documentation/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p src/utils
cat > src/utils/date.ts << 'EOF'
/**
 * Parses an ISO 8601 date string.
 * Returns null if the string is invalid.
 */
export function parseDate(input: string): Date | null {
  return null;
}

export function formatDate(date: Date): string {
  return "";
}
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[documentation] extracting exports and doc comments..."
OUT=$($RUN --scope src/utils/date.ts 2>/tmp/doc-stderr.txt)
echo "$OUT"
echo "$OUT" | grep -q "parseDate" || { echo "FAIL: missing parseDate"; exit 1; }
echo "$OUT" | grep -q "formatDate" || { echo "FAIL: missing formatDate"; exit 1; }
echo "$OUT" | grep -q "Parses an ISO 8601" || { echo "FAIL: doc comment not extracted for parseDate"; exit 1; }
echo "$OUT" | grep -q "_undocumented_" || { echo "FAIL: formatDate should be marked undocumented"; exit 1; }
echo "$OUT" | grep -q "Documented: 1 / 2" || { echo "FAIL: coverage summary incorrect"; exit 1; }

echo "[documentation] checking stderr coverage JSON..."
cat /tmp/doc-stderr.txt
grep -q '"documented":1' /tmp/doc-stderr.txt || { echo "FAIL: stderr summary missing documented count"; exit 1; }

echo "[documentation] checking --scope is required..."
if $RUN 2>/dev/null; then
  echo "FAIL: should require --scope"
  exit 1
fi

echo "PASS: all documentation skill checks passed"
