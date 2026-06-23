#!/usr/bin/env bash
# tests/test_skill.sh — validates accessibility/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p src/components
cat > src/components/UploadForm.vue << 'EOF'
<template>
  <form>
    <input type="text" id="filename" />
    <label for="description">Description</label>
    <input type="text" id="description" />
    <img src="icon.png" />
    <div @click="submit">Submit</div>
    <button @click="cancel">Cancel</button>
  </form>
</template>
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[accessibility] scanning Vue template..."
OUT=$($RUN --scope src/components/UploadForm.vue)
echo "$OUT"

echo "$OUT" | grep -q "missing alt attribute" || { echo "FAIL: should flag missing alt"; exit 1; }
echo "$OUT" | grep -q "click handler but no keyboard handler" || { echo "FAIL: should flag clickable div"; exit 1; }

# filename input has no label -> should be flagged
FILENAME_FLAGGED=$(echo "$OUT" | python3 -c "
import json,sys
data = json.load(sys.stdin)
findings = data['findings']
flagged_lines = [f['line'] for f in findings if 'input' in f['issue']]
print(3 in flagged_lines)
" 2>/dev/null || echo "skip")
if [ "$FILENAME_FLAGGED" = "False" ]; then
  echo "FAIL: filename input (no label) should be flagged"
  exit 1
fi

# description input HAS a matching label -> should not be flagged
if echo "$OUT" | grep -A2 '"line": 5,' | grep -q "no associated label"; then
  echo "FAIL: description input has a matching label and should not be flagged"
  exit 1
fi

# button is semantic, should not be flagged as clickable-non-semantic
BUTTON_COUNT=$(echo "$OUT" | grep -c '<button>' || true)
if [ "$BUTTON_COUNT" -gt 0 ]; then
  echo "FAIL: semantic <button> should not be flagged"
  exit 1
fi

echo "[accessibility] checking --scope required..."
if $RUN 2>/dev/null; then
  echo "FAIL: should require --scope"
  exit 1
fi

echo "PASS: all accessibility skill checks passed"
