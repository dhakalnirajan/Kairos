#!/usr/bin/env bash
# tests/test_skill.sh — validates simplify/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p src

cat > src/complex.ts << 'EOF'
function messy(a, b, c, d, e, f) {
  if (a) {
    if (b) {
      if (c) {
        for (let i = 0; i < d; i++) {
          if (e && f) {
            console.log("deep");
          } else if (e || f) {
            console.log("also deep");
          }
        }
      }
    }
  }
  return a;
}

function clean(x) {
  return x + 1;
}
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[simplify] scanning file with one messy and one clean function..."
OUT=$($RUN --scope src/complex.ts --threshold-complexity 3 --threshold-depth 2 --threshold-params 2)
echo "$OUT"

echo "$OUT" | grep -q '"function": "messy"' || { echo "FAIL: messy() should be flagged"; exit 1; }
if echo "$OUT" | grep -q '"function": "clean"'; then
  echo "FAIL: clean() should not be flagged at these thresholds"
  exit 1
fi

echo "[simplify] checking --scope is required..."
if $RUN 2>/dev/null; then
  echo "FAIL: should require --scope"
  exit 1
fi

echo "[simplify] checking --top limits results..."
OUT2=$($RUN --scope src/complex.ts --threshold-complexity 1 --threshold-depth 1 --threshold-params 0 --top 1)
COUNT=$(echo "$OUT2" | grep -c '"function"')
if [ "$COUNT" -ne 1 ]; then
  echo "FAIL: --top 1 should limit to 1 finding, got $COUNT"
  exit 1
fi

echo "PASS: all simplify skill checks passed"
