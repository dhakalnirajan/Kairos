#!/usr/bin/env bash
# tests/test_skill.sh — validates git-workflow/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
git init -q
git config user.email "test@example.com"
git config user.name "Test"
mkdir -p src
echo "export const x = 1;" > src/a.ts
git add src/a.ts
git commit -q -m "chore: init"
git checkout -q -b feat/sample-feature

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[git-workflow] testing commit message with nothing staged (expect error)..."
if $RUN --commit-message 2>/dev/null; then
  echo "FAIL: should error with nothing staged"
  exit 1
fi

echo "[git-workflow] staging a new file and generating commit message..."
echo "export const y = 2;" > src/b.ts
git add src/b.ts
OUT=$($RUN --commit-message)
echo "$OUT"
echo "$OUT" | grep -q '"type": "feat"' || { echo "FAIL: new file should classify as feat"; exit 1; }

echo "[git-workflow] checking branch name validation on conforming branch..."
OUT2=$($RUN --check-branch)
echo "$OUT2"
echo "$OUT2" | grep -q '"valid": true' || { echo "FAIL: feat/sample-feature should be valid"; exit 1; }

echo "[git-workflow] checking branch name validation fails on bad branch..."
git checkout -q -b randomBranchName
set +e
$RUN --check-branch >/dev/null 2>&1
CODE=$?
set -e
if [ "$CODE" -ne 1 ]; then
  echo "FAIL: expected exit 1 for invalid branch name"
  exit 1
fi

echo "[git-workflow] checking PR description generation..."
git checkout -q feat/sample-feature
git commit -q -m "feat(src): add b.ts"
OUT3=$($RUN --pr-description --base main)
echo "$OUT3" | grep -q '"commitCount"' || { echo "FAIL: missing commitCount"; exit 1; }

echo "PASS: all git-workflow skill checks passed"
