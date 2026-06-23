#!/usr/bin/env bash
# tests/test_skill.sh — validates plan/scripts/run.ts produces well-formed output
# Runs under `bun` if available (production runtime), else falls back to
# `node --experimental-strip-types` (Node >=22) for CI environments without Bun.
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SKILL_DIR"

if command -v bun >/dev/null 2>&1; then
  RUN="bun scripts/run.ts"
else
  RUN="node --experimental-strip-types scripts/run.ts"
fi

echo "[plan] running with sample task..."
OUTPUT=$($RUN --task "Add caching to user lookup" --scope . --depth shallow)

echo "[plan] checking required sections present..."
for section in "# Implementation Plan" "## Summary" "## Affected Files" "## Steps" "## Risks" "## Open Questions" "## Suggested Follow-up Skills"; do
  if ! echo "$OUTPUT" | grep -qF "$section"; then
    echo "FAIL: missing section '$section'"
    exit 1
  fi
done

echo "[plan] checking --task is required..."
if $RUN 2>/dev/null; then
  echo "FAIL: script should exit non-zero when --task is omitted"
  exit 1
fi

echo "[plan] checking risk keyword detection..."
RISK_OUTPUT=$($RUN --task "Migrate payment schema" --depth shallow)
if ! echo "$RISK_OUTPUT" | grep -q "second reviewer"; then
  echo "FAIL: risk keywords did not trigger risk warning"
  exit 1
fi

echo "PASS: all plan skill checks passed"
