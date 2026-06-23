#!/usr/bin/env bash
# tests/test_skill.sh — validates code-generation/scripts/run.ts
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

echo "[code-generation] generating route-handler..."
OUT=$($RUN --template route-handler --name getUserProfile --method GET --path /api/users/:id --output src/routes/user.ts)
echo "$OUT"
test -f src/routes/user.ts || { echo "FAIL: source file not created"; exit 1; }
test -f src/routes/user.test.ts || { echo "FAIL: test stub not created"; exit 1; }
grep -q "export const getUserProfile" src/routes/user.ts || { echo "FAIL: function name not camelCase as expected"; exit 1; }
grep -q "not implemented" src/routes/user.ts || { echo "FAIL: missing not-implemented guard"; exit 1; }

echo "[code-generation] generating ts-class with PascalCase normalization..."
$RUN --template ts-class --name "user_account" --output src/models/account.ts > /dev/null
grep -q "export class UserAccount" src/models/account.ts || { echo "FAIL: class name should be PascalCase"; exit 1; }

echo "[code-generation] generating vue-component..."
$RUN --template vue-component --name uploadProgress --output src/components/UploadProgress.vue --no-test > /dev/null
test -f src/components/UploadProgress.vue || { echo "FAIL: vue component not created"; exit 1; }
if test -f src/components/UploadProgress.test.ts; then
  echo "FAIL: --no-test should skip test stub"
  exit 1
fi
grep -q '<script setup lang="ts">' src/components/UploadProgress.vue || { echo "FAIL: missing script setup block"; exit 1; }

echo "[code-generation] checking invalid template rejected..."
if $RUN --template not-a-real-template --name x --output x.ts 2>/dev/null; then
  echo "FAIL: should reject unknown template"
  exit 1
fi

echo "[code-generation] checking overwrite protection..."
if $RUN --template ts-function --name dup --output src/routes/user.ts 2>/dev/null; then
  echo "FAIL: should refuse to overwrite without --force"
  exit 1
fi

echo "PASS: all code-generation skill checks passed"
