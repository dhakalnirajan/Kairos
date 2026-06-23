#!/usr/bin/env bash
# tests/test_skill.sh — validates code-review/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p src
cat > src/login.ts << 'EOF'
export function login(user, pass) {
  try {
    doLogin(user, pass);
  } catch (e) {}
  console.log("login attempted");
  // TODO: add 2FA
}
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[code-review] reviewing file with empty catch, console.log, TODO..."
OUT=$($RUN --files src/login.ts --task "Add password reset flow" 2>&1) || true
echo "$OUT"

echo "$OUT" | grep -q '"severity": "blocking"' || { echo "FAIL: empty catch should be blocking"; exit 1; }
echo "$OUT" | grep -q "console.log" || { echo "FAIL: should flag console.log"; exit 1; }
echo "$OUT" | grep -q "TODO" || { echo "FAIL: should flag TODO"; exit 1; }
echo "$OUT" | grep -q "no test file changes" || { echo "FAIL: should flag missing tests"; exit 1; }
echo "$OUT" | grep -q "does not obviously relate" || { echo "FAIL: should flag scope creep against unrelated task"; exit 1; }

echo "[code-review] checking exit code reflects blocking comments..."
set +e
$RUN --files src/login.ts --task "x" >/dev/null 2>&1
CODE=$?
set -e
if [ "$CODE" -ne 1 ]; then
  echo "FAIL: expected exit 1 when blocking comments present, got $CODE"
  exit 1
fi

echo "PASS: all code-review skill checks passed"
