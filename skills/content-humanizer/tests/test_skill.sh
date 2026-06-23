#!/usr/bin/env bash
# tests/test_skill.sh — validates content-humanizer/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

mkdir -p "$WORKDIR/scripts" "$WORKDIR/references"
cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/scripts/run.ts"
cp "$SKILL_DIR/references/tell-phrases.json" "$WORKDIR/references/tell-phrases.json"
cd "$WORKDIR"

cat > draft.md << 'EOF'
In today's fast-paced world, teams need tools that work. Moreover, our platform is seamlessly integrated with everything. Furthermore, it is robust and scalable. Additionally, it offers unprecedented value. Consequently, teams love it.
EOF

cat > natural.md << 'EOF'
We shipped the feature last week. It broke twice in staging before we caught the race condition. After the fix, things have been stable for three days, though we're still watching the error rate closely since the load patterns this week are unusual.
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun scripts/run.ts"
else
  RUN="node --experimental-strip-types scripts/run.ts"
fi

echo "[content-humanizer] scanning formulaic draft..."
OUT=$($RUN --file draft.md)
echo "$OUT"
echo "$OUT" | grep -q "stock-opener" || { echo "FAIL: should detect stock opener"; exit 1; }
echo "$OUT" | grep -q "hype-phrase" || { echo "FAIL: should detect hype phrase"; exit 1; }
echo "$OUT" | grep -q '"transitionDensityFlagged": true' || { echo "FAIL: should flag high transition density"; exit 1; }

echo "[content-humanizer] scanning naturally varied text (expect fewer/no flags)..."
OUT2=$($RUN --file natural.md)
echo "$OUT2"
echo "$OUT2" | grep -q '"transitionDensityFlagged": false' || { echo "FAIL: natural text should not flag high transition density"; exit 1; }

echo "[content-humanizer] checking --file required..."
if $RUN 2>/dev/null; then
  echo "FAIL: should require --file"
  exit 1
fi

echo "PASS: all content-humanizer skill checks passed"
