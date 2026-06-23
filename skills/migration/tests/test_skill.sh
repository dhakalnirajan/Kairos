#!/usr/bin/env bash
# tests/test_skill.sh — validates migration/scripts/run.ts
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

echo "[migration] generating add-column migration..."
OUT=$($RUN --generate --name add_user_avatar --add-column "users.avatar_url:text" --output-dir migrations/)
echo "$OUT"
echo "$OUT" | grep -q '"manualReviewRequired": false' || { echo "FAIL: add-column should not require manual review"; exit 1; }

UP_FILE=$(echo "$OUT" | grep -o '"upFile": "[^"]*"' | cut -d'"' -f4)
DOWN_FILE=$(echo "$OUT" | grep -o '"downFile": "[^"]*"' | cut -d'"' -f4)
grep -q "ADD COLUMN avatar_url" "$UP_FILE" || { echo "FAIL: up.sql missing ADD COLUMN"; exit 1; }
grep -q "DROP COLUMN avatar_url" "$DOWN_FILE" || { echo "FAIL: down.sql missing DROP COLUMN"; exit 1; }

echo "[migration] generating drop-column migration (expect manual review flag)..."
sleep 1
OUT2=$($RUN --generate --name drop_legacy --drop-column "users.legacy_field" --output-dir migrations/)
echo "$OUT2"
echo "$OUT2" | grep -q '"manualReviewRequired": true' || { echo "FAIL: drop-column should require manual review"; exit 1; }
DOWN_FILE2=$(echo "$OUT2" | grep -o '"downFile": "[^"]*"' | cut -d'"' -f4)
grep -q "MANUAL REVIEW REQUIRED" "$DOWN_FILE2" || { echo "FAIL: down.sql should contain manual review marker"; exit 1; }

echo "[migration] validating migrations directory (should be clean)..."
OUT3=$($RUN --validate --scope migrations/)
echo "$OUT3"
echo "$OUT3" | grep -q '"issues": \[\]' || { echo "FAIL: expected no validation issues"; exit 1; }

echo "[migration] introducing an orphaned up file and re-validating..."
touch migrations/9999999999_orphan.up.sql
OUT4=$($RUN --validate --scope migrations/)
echo "$OUT4"
echo "$OUT4" | grep -q "no matching down migration" || { echo "FAIL: should flag orphaned up migration"; exit 1; }

echo "[migration] checking required args..."
if $RUN --generate --name x --output-dir migrations/ 2>/dev/null; then
  echo "FAIL: should require at least one change descriptor"
  exit 1
fi

echo "PASS: all migration skill checks passed"
