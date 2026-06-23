#!/usr/bin/env bash
# tests/test_skill.sh — validates debug/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p src
cat > src/user.ts << 'EOF'
export function getUser(id: string) {
  const record = { name: "test" };
  return {
    name: record.name,
    id: record.id,
  };
}
EOF

cat > crash.log << 'EOF'
TypeError: Cannot read property 'id' of undefined
    at getUser (src/user.ts:5:5)
    at handleRequest (src/routes/login.ts:12:5)
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[debug] testing trace parsing..."
OUT=$($RUN --symptom "Cannot read property 'id' of undefined" --trace crash.log)
echo "$OUT"
echo "$OUT" | grep -q '"reproduced": true' || { echo "FAIL: expected reproduced true from trace"; exit 1; }
echo "$OUT" | grep -q '"confidence": "high"' || { echo "FAIL: expected high confidence with resolvable file"; exit 1; }

echo "[debug] testing --symptom required..."
if $RUN --trace crash.log 2>/dev/null; then
  echo "FAIL: should require --symptom"
  exit 1
fi

echo "[debug] testing static fallback with no trace/repro..."
OUT2=$($RUN --symptom "getUser fails")
echo "$OUT2" | grep -q '"reproduced": false' || { echo "FAIL: expected reproduced false with no trace/repro"; exit 1; }

echo "PASS: all debug skill checks passed"
