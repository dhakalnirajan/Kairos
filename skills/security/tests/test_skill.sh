#!/usr/bin/env bash
# tests/test_skill.sh — validates security/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

mkdir -p "$WORKDIR/scripts" "$WORKDIR/references"
cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/scripts/run.ts"
cp "$SKILL_DIR/references/known-vulnerable.json" "$WORKDIR/references/known-vulnerable.json"
cd "$WORKDIR"
mkdir -p src
cat > src/queries.ts << 'EOF'
export function getUser(id) {
  return db.query(`SELECT * FROM users WHERE id = ${id}`);
}
export function getUserSafe(id) {
  return db.query("SELECT * FROM users WHERE id = ?", [id]);
}
const AWS_KEY = "AKIAABCDEFGHIJKLMNOP";
EOF

cat > package.json << 'EOF'
{ "dependencies": { "lodash": "4.17.15" } }
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun scripts/run.ts"
else
  RUN="node --experimental-strip-types scripts/run.ts"
fi

echo "[security] scanning for secrets and SQL injection..."
OUT=$($RUN --scan src/queries.ts --code-only 2>&1) || true
echo "$OUT"
echo "$OUT" | grep -q '"category": "sql-injection"' || { echo "FAIL: should detect SQL injection"; exit 1; }
echo "$OUT" | grep -q '"category": "secret"' || { echo "FAIL: should detect AWS key"; exit 1; }
if echo "$OUT" | grep -q '"line": 5,'; then
  echo "FAIL: parameterized query should not be flagged as injection"
  exit 1
fi

echo "[security] checking dependency scan..."
OUT2=$($RUN --scan . --deps-only 2>&1) || true
echo "$OUT2"
echo "$OUT2" | grep -q '"category": "vulnerable-dependency"' || { echo "FAIL: should flag outdated lodash"; exit 1; }

echo "[security] checking exit code reflects critical findings..."
set +e
$RUN --scan src/queries.ts --code-only >/dev/null 2>&1
CODE=$?
set -e
if [ "$CODE" -ne 1 ]; then
  echo "FAIL: expected exit 1 with critical secret finding, got $CODE"
  exit 1
fi

echo "PASS: all security skill checks passed"
