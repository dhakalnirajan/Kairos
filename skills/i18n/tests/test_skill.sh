#!/usr/bin/env bash
# tests/test_skill.sh — validates i18n/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p src/components locales

cat > src/components/Greeting.vue << 'EOF'
<template>
  <div>
    <h1>Welcome Back</h1>
    <p>{{ $t('greeting.message') }}</p>
    <button>Sign Out Now</button>
  </div>
</template>
EOF

cat > locales/en.json << 'EOF'
{ "auth": { "login": { "title": "Sign in", "subtitle": "Welcome" } } }
EOF
cat > locales/es.json << 'EOF'
{ "auth": { "login": { "title": "Iniciar sesion" } } }
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[i18n] finding hardcoded strings..."
OUT=$($RUN --find-hardcoded --scope src/components)
echo "$OUT"
echo "$OUT" | grep -q "Welcome Back" || { echo "FAIL: should flag 'Welcome Back'"; exit 1; }
echo "$OUT" | grep -q "Sign Out Now" || { echo "FAIL: should flag 'Sign Out Now'"; exit 1; }

echo "[i18n] checking translation key gaps..."
OUT2=$($RUN --check-keys --base locales/en.json --target locales/es.json)
echo "$OUT2"
echo "$OUT2" | grep -q "auth.login.subtitle" || { echo "FAIL: should flag missing subtitle key"; exit 1; }

echo "[i18n] checking mutual exclusivity..."
if $RUN --find-hardcoded --check-keys --scope src --base locales/en.json --target locales/es.json 2>/dev/null; then
  echo "FAIL: should reject both flags together"
  exit 1
fi

echo "[i18n] checking required args for check-keys..."
if $RUN --check-keys --base locales/en.json 2>/dev/null; then
  echo "FAIL: should require --target"
  exit 1
fi

echo "PASS: all i18n skill checks passed"
