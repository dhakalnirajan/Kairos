#!/usr/bin/env bash
# tests/test_skill.sh — validates monitoring/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p src/routes
cat > src/routes/upload.ts << 'EOF'
export async function handleUpload(req, res) {
  try {
    doUpload(req);
  } catch (err) {
    res.status(500).send("error");
  }
}

export async function handleDownload(req, res) {
  doDownload(req);
}
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[monitoring] running audit..."
OUT=$($RUN --audit --scope src/routes)
echo "$OUT"
echo "$OUT" | grep -q "does not appear to log" || { echo "FAIL: should flag non-logging catch"; exit 1; }
echo "$OUT" | grep -q "no try/catch" || { echo "FAIL: should flag unguarded async function"; exit 1; }

echo "[monitoring] scaffolding health endpoint..."
OUT2=$($RUN --scaffold health --output src/routes/health.ts)
echo "$OUT2"
test -f src/routes/health.ts || { echo "FAIL: health.ts not created"; exit 1; }
grep -q "status.*ok" src/routes/health.ts || { echo "FAIL: health endpoint missing status field"; exit 1; }

echo "[monitoring] scaffolding metrics module..."
$RUN --scaffold metrics --output src/lib/metrics.ts > /dev/null
test -f src/lib/metrics.ts || { echo "FAIL: metrics.ts not created"; exit 1; }
grep -q "TODO: wire up" src/lib/metrics.ts || { echo "FAIL: missing TODO integration markers"; exit 1; }

echo "[monitoring] checking overwrite protection..."
if $RUN --scaffold health --output src/routes/health.ts 2>/dev/null; then
  echo "FAIL: should refuse to overwrite without --force"
  exit 1
fi

echo "[monitoring] checking invalid scaffold type rejected..."
if $RUN --scaffold bogus --output x.ts 2>/dev/null; then
  echo "FAIL: should reject unknown scaffold type"
  exit 1
fi

echo "PASS: all monitoring skill checks passed"
