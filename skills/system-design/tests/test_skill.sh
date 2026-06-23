#!/usr/bin/env bash
# tests/test_skill.sh — validates system-design/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$SKILL_DIR"

if command -v bun >/dev/null 2>&1; then
  RUN="bun scripts/run.ts"
else
  RUN="node --experimental-strip-types scripts/run.ts"
fi

echo "[system-design] generating component diagram..."
OUT=$($RUN --diagram component --node "API:service" --node "DB:database" --edge "API->DB:reads/writes")
echo "$OUT"
echo "$OUT" | grep -q "graph TD" || { echo "FAIL: missing graph TD"; exit 1; }
echo "$OUT" | grep -q "reads/writes" || { echo "FAIL: missing edge label"; exit 1; }

echo "[system-design] rejecting dangling edge reference..."
if $RUN --diagram component --node "API:service" --edge "API->Nonexistent" 2>/dev/null; then
  echo "FAIL: should reject edge referencing undeclared node"
  exit 1
fi

echo "[system-design] generating sequence diagram..."
OUT2=$($RUN --diagram sequence --actor Client --actor API --message "Client->API: POST /upload")
echo "$OUT2"
echo "$OUT2" | grep -q "sequenceDiagram" || { echo "FAIL: missing sequenceDiagram"; exit 1; }
echo "$OUT2" | grep -q "POST /upload" || { echo "FAIL: missing message label"; exit 1; }

echo "[system-design] generating capacity worksheet with known values..."
OUT3=$($RUN --capacity --qps 500 --avg-item-size-kb 200)
echo "$OUT3"
echo "$OUT3" | grep -q "QPS: 500" || { echo "FAIL: QPS not reflected"; exit 1; }
if echo "$OUT3" | grep -q "_(estimate)_" && echo "$OUT3" | grep -A1 "## Traffic" | grep -q "_(estimate)_"; then
  echo "FAIL: QPS was provided, should not show as estimate"
  exit 1
fi

echo "[system-design] generating capacity worksheet with no values (expect placeholders)..."
OUT4=$($RUN --capacity)
echo "$OUT4" | grep -q "_(estimate)_" || { echo "FAIL: should show estimate placeholders when no values given"; exit 1; }

echo "[system-design] checking mutual exclusivity..."
if $RUN --diagram component --capacity 2>/dev/null; then
  echo "FAIL: should reject both --diagram and --capacity"
  exit 1
fi

echo "PASS: all system-design skill checks passed"
