#!/usr/bin/env bash
# tests/test_skill.sh — validates design-md/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SKILL_DIR"

if command -v bun >/dev/null 2>&1; then
  RUN="bun scripts/run.ts"
else
  RUN="node --experimental-strip-types scripts/run.ts"
fi

echo "[design-md] generating with two alternatives..."
OUT=$($RUN --problem "Need rate limiting" --approach "Token bucket in Redis" --alt "Polling" --alt "Fixed window counter")
echo "$OUT" | grep -q "Alternative 1" || { echo "FAIL: missing Alternative 1"; exit 1; }
echo "$OUT" | grep -q "Alternative 2" || { echo "FAIL: missing Alternative 2"; exit 1; }
if echo "$OUT" | grep -q "INCOMPLETE"; then
  echo "FAIL: should not show incomplete marker when alternatives given"
  exit 1
fi

echo "[design-md] generating with no alternatives (expect incomplete marker)..."
OUT2=$($RUN --problem "Need rate limiting" --approach "Token bucket in Redis")
echo "$OUT2" | grep -q "INCOMPLETE" || { echo "FAIL: should show incomplete marker with no alternatives"; exit 1; }

echo "[design-md] checking required args..."
if $RUN --problem "x" 2>/dev/null; then
  echo "FAIL: should require --approach"
  exit 1
fi
if $RUN --approach "x" 2>/dev/null; then
  echo "FAIL: should require --problem"
  exit 1
fi

echo "[design-md] checking all required sections present..."
for section in "## Problem" "## Goals" "## Non-Goals" "## Proposed Approach" "## Alternatives Considered" "## Tradeoffs" "## Open Questions"; do
  echo "$OUT" | grep -qF "$section" || { echo "FAIL: missing section $section"; exit 1; }
done

echo "PASS: all design-md skill checks passed"
