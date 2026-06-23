#!/usr/bin/env bash
# tests/test_skill.sh — validates refactoring/scripts/run.ts
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

# --- extract-function ---
cat > src1.ts << 'EOF'
function handleRequest(req) {
  const x = req.body;
  const y = x.value;
  return y * 2;
}
EOF

echo "[refactoring] testing extract-function..."
OUT=$($RUN --op extract-function --file src1.ts --range 2:3 --new-name extractXY)
echo "$OUT"
grep -q "extractXY" src1.ts || { echo "FAIL: function not extracted"; exit 1; }
grep -q "extractXY();" src1.ts || { echo "FAIL: call site not inserted"; exit 1; }
echo "$OUT" | grep -q '"op": "extract-function"' || { echo "FAIL: JSON summary missing op"; exit 1; }

# --- rename-symbol ---
cat > src2.ts << 'EOF'
const usr = getUser();
console.log(usr.name);
return usr;
EOF

echo "[refactoring] testing rename-symbol..."
$RUN --op rename-symbol --file src2.ts --old-name usr --new-name user > /dev/null
grep -q "const user = getUser" src2.ts || { echo "FAIL: assignment not renamed"; exit 1; }
grep -q "user.name" src2.ts || { echo "FAIL: reference not renamed"; exit 1; }
if grep -q "usr" src2.ts; then
  echo "FAIL: old name still present after rename"
  exit 1
fi

# --- extract-constant ---
cat > src3.ts << 'EOF'
const headers = { "Content-Type": "application/json" };
fetch("/api", { headers });
EOF

echo "[refactoring] testing extract-constant..."
$RUN --op extract-constant --file src3.ts --line 1 --value "application/json" --new-name CONTENT_TYPE > /dev/null
grep -q "const CONTENT_TYPE" src3.ts || { echo "FAIL: constant not extracted"; exit 1; }
grep -q "CONTENT_TYPE" src3.ts || { echo "FAIL: constant not used in place of literal"; exit 1; }

# --- inline-variable ---
cat > src4.ts << 'EOF'
function calc() {
  const temp = 2 + 3;
  return temp;
}
EOF

echo "[refactoring] testing inline-variable..."
$RUN --op inline-variable --file src4.ts --range 1:4 --old-name temp > /dev/null
if grep -q "const temp" src4.ts; then
  echo "FAIL: inlined variable assignment should be removed"
  exit 1
fi
grep -q "return 2 + 3" src4.ts || { echo "FAIL: variable not inlined"; exit 1; }

# --- required arg validation ---
echo "[refactoring] checking invalid op rejected..."
if $RUN --op bogus --file src1.ts 2>/dev/null; then
  echo "FAIL: should reject unknown op"
  exit 1
fi

echo "PASS: all refactoring skill checks passed"
