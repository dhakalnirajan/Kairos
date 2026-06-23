#!/usr/bin/env bash
# tests/test_skill.sh — validates deployment/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p src
cat > src/server.ts << 'EOF'
const port = process.env.PORT;
const dbUrl = process.env.DATABASE_URL;
const secret = process.env.JWT_SECRET;
EOF

cat > .env.example << 'EOF'
PORT=3000
DATABASE_URL=postgres://localhost/db
EOF

cat > package.json << 'EOF'
{ "scripts": { "build": "tsc" } }
EOF

cat > Dockerfile << 'EOF'
FROM node:latest
COPY . .
RUN npm install
CMD ["node", "server.js"]
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[deployment] checking readiness report..."
OUT=$($RUN --scope .)
echo "$OUT"

echo "$OUT" | grep -q "JWT_SECRET" || { echo "FAIL: JWT_SECRET should be flagged as undocumented"; exit 1; }
if echo "$OUT" | python3 -c "import json,sys; d=json.load(sys.stdin); sys.exit(0 if 'PORT' not in d['envVars']['undocumented'] else 1)" 2>/dev/null; then
  : # PORT correctly not flagged
else
  echo "FAIL: PORT is documented and should not be flagged"
  exit 1
fi
echo "$OUT" | grep -q '"buildScript": true' || { echo "FAIL: build script should be detected"; exit 1; }
echo "$OUT" | grep -q "latest" || { echo "FAIL: should flag :latest base image"; exit 1; }
echo "$OUT" | grep -q "USER directive" || { echo "FAIL: should flag missing USER directive"; exit 1; }
echo "$OUT" | grep -q "dockerignore" || { echo "FAIL: should flag missing .dockerignore"; exit 1; }

echo "[deployment] checking --skip-docker..."
OUT2=$($RUN --scope . --skip-docker)
echo "$OUT2" | grep -q '"docker": null' || { echo "FAIL: --skip-docker should produce null docker field"; exit 1; }

echo "[deployment] checking --scope required..."
if $RUN 2>/dev/null; then
  echo "FAIL: should require --scope"
  exit 1
fi

echo "PASS: all deployment skill checks passed"
