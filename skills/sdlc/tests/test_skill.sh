#!/usr/bin/env bash
# tests/test_skill.sh — validates sdlc/scripts/run.ts orchestration
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SKILLS_ROOT="$(dirname "$SKILL_DIR")"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

# Mirror the real skills/ layout so sibling skill resolution works.
mkdir -p "$WORKDIR/skills/sdlc/scripts" "$WORKDIR/skills/plan/scripts" "$WORKDIR/skills/testing/scripts" "$WORKDIR/skills/code-review/scripts" "$WORKDIR/skills/security/scripts"
cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/skills/sdlc/scripts/run.ts"
cp "$SKILLS_ROOT/plan/scripts/run.ts" "$WORKDIR/skills/plan/scripts/run.ts"
cp "$SKILLS_ROOT/testing/scripts/run.ts" "$WORKDIR/skills/testing/scripts/run.ts"
cp "$SKILLS_ROOT/code-review/scripts/run.ts" "$WORKDIR/skills/code-review/scripts/run.ts"
cp "$SKILLS_ROOT/security/scripts/run.ts" "$WORKDIR/skills/security/scripts/run.ts"
mkdir -p "$WORKDIR/skills/security/references"
cp "$SKILLS_ROOT/security/references/known-vulnerable.json" "$WORKDIR/skills/security/references/known-vulnerable.json"

cd "$WORKDIR/skills/sdlc"
git init -q "$WORKDIR" 2>/dev/null || true
cd "$WORKDIR"
git init -q
git config user.email "test@example.com"
git config user.name "Test"
mkdir -p src
echo "export const x = 1;" > src/a.ts
git add -A
git commit -q -m "chore: init"

export SDLC_RUNNER="node"
cd "$WORKDIR/skills/sdlc"

if command -v bun >/dev/null 2>&1; then
  RUN="bun scripts/run.ts"
else
  RUN="node --experimental-strip-types scripts/run.ts"
fi

echo "[sdlc] running plan-only stage..."
OUT=$(cd "$WORKDIR" && node --experimental-strip-types skills/sdlc/scripts/run.ts --plan-only --task "Add caching" --skills-dir "$WORKDIR/skills" 2>&1)
echo "$OUT"
echo "$OUT" | grep -q '"stage": "plan"' || { echo "FAIL: missing plan stage marker"; exit 1; }

echo "[sdlc] running verify stage..."
OUT2=$(cd "$WORKDIR" && node --experimental-strip-types skills/sdlc/scripts/run.ts --verify --task "Add caching" --skills-dir "$WORKDIR/skills" 2>&1)
echo "$OUT2"
echo "$OUT2" | grep -q '"ready"' || { echo "FAIL: missing ready field"; exit 1; }
echo "$OUT2" | grep -q '"testing"' || { echo "FAIL: missing testing stage"; exit 1; }
echo "$OUT2" | grep -q '"codeReview"' || { echo "FAIL: missing codeReview stage"; exit 1; }
echo "$OUT2" | grep -q '"security"' || { echo "FAIL: missing security stage"; exit 1; }

echo "[sdlc] checking --task required..."
if node --experimental-strip-types scripts/run.ts --plan-only 2>/dev/null; then
  echo "FAIL: should require --task"
  exit 1
fi

echo "PASS: all sdlc skill checks passed"
