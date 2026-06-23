#!/usr/bin/env bash
# tests/test_skill.sh — validates skill-creator/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

mkdir -p "$WORKDIR/skills/skill-creator/scripts"
cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/skills/skill-creator/scripts/run.ts"
cd "$WORKDIR/skills/skill-creator"

if command -v bun >/dev/null 2>&1; then
  RUN="bun scripts/run.ts"
else
  RUN="node --experimental-strip-types scripts/run.ts"
fi

echo "[skill-creator] scaffolding a new skill..."
OUT=$($RUN --name api-rate-limiter --description "Checks API endpoints for missing rate limiting" --category analysis)
echo "$OUT"
echo "$OUT" | grep -q '"manifestValid": true' || { echo "FAIL: generated manifest should be valid"; exit 1; }

test -f "$WORKDIR/skills/api-rate-limiter/SKILL.md" || { echo "FAIL: SKILL.md not created"; exit 1; }
test -f "$WORKDIR/skills/api-rate-limiter/scripts/run.ts" || { echo "FAIL: run.ts stub not created"; exit 1; }
test -d "$WORKDIR/skills/api-rate-limiter/tests" || { echo "FAIL: tests dir not created"; exit 1; }
grep -q 'name: "api-rate-limiter"' "$WORKDIR/skills/api-rate-limiter/SKILL.md" || { echo "FAIL: manifest name field wrong"; exit 1; }

echo "[skill-creator] checking the scaffolded stub script actually runs (and fails as designed)..."
cd "$WORKDIR/skills/api-rate-limiter"
set +e
if command -v bun >/dev/null 2>&1; then
  bun scripts/run.ts >/dev/null 2>&1
else
  node --experimental-strip-types scripts/run.ts >/dev/null 2>&1
fi
STUB_CODE=$?
set -e
if [ "$STUB_CODE" -eq 0 ]; then
  echo "FAIL: unedited stub should exit non-zero (not-implemented)"
  exit 1
fi
cd "$WORKDIR/skills/skill-creator"

echo "[skill-creator] checking invalid name rejected..."
if $RUN --name "Bad_Name" --description "x" --category analysis 2>/dev/null; then
  echo "FAIL: should reject invalid name"
  exit 1
fi

echo "[skill-creator] checking invalid category rejected..."
if $RUN --name valid-name --description "x" --category bogus 2>/dev/null; then
  echo "FAIL: should reject invalid category"
  exit 1
fi

echo "[skill-creator] checking overwrite protection..."
if $RUN --name api-rate-limiter --description "x" --category analysis 2>/dev/null; then
  echo "FAIL: should refuse to overwrite without --force"
  exit 1
fi

echo "PASS: all skill-creator skill checks passed"
