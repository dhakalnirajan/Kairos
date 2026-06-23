#!/usr/bin/env bash
# tests/test_skill.sh — validates performance/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p src/handlers
cat > src/handlers/orders.ts << 'EOF'
export async function listOrders(ids) {
  const results = [];
  for (const id of ids) {
    const order = await db.find(id);
    results.push(order);
  }
  return results;
}
EOF

cat > src/handlers/reports.ts << 'EOF'
import { readFileSync } from "fs";
export function generateReport(req, res) {
  const data = readFileSync("./report-template.txt", "utf-8");
  res.send(data);
}
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[performance] scanning for anti-patterns..."
OUT=$($RUN --scan src/handlers 2>&1)
echo "$OUT"
echo "$OUT" | grep -q '"pattern": "n-plus-one"' || { echo "FAIL: should detect N+1"; exit 1; }
echo "$OUT" | grep -q '"pattern": "sync-io-in-handler"' || { echo "FAIL: should detect sync I/O in handler"; exit 1; }

echo "[performance] testing --measure mode..."
OUT2=$($RUN --measure "echo hi" --runs 2 2>&1)
echo "$OUT2"
echo "$OUT2" | grep -q '"meanMs"' || { echo "FAIL: --measure should report meanMs"; exit 1; }

echo "[performance] checking mutual exclusivity..."
if $RUN --measure "echo hi" --scan src/handlers 2>/dev/null; then
  echo "FAIL: should reject both --measure and --scan together"
  exit 1
fi

echo "PASS: all performance skill checks passed"
