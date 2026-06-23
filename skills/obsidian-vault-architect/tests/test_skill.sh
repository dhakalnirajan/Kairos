#!/usr/bin/env bash
# tests/test_skill.sh — validates obsidian-vault-architect/scripts/run.ts
set -euo pipefail

SKILL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WORKDIR=$(mktemp -d)
trap 'rm -rf "$WORKDIR"' EXIT

cp "$SKILL_DIR/scripts/run.ts" "$WORKDIR/run.ts"
cd "$WORKDIR"
mkdir -p vault

cat > "vault/Note A.md" << 'EOF'
---
title: "Note A"
created: 2026-01-01
tags: []
---
Links to [[Note B]] and a broken [[Nonexistent Note]]. Tagged #project-status.
EOF

cat > "vault/Note B.md" << 'EOF'
---
title: "Note B"
created: 2026-01-01
tags: []
---
Back-references nothing. Tagged #projectStatus.
EOF

cat > "vault/Orphan.md" << 'EOF'
---
title: "Orphan"
created: 2026-01-01
tags: []
---
No links at all here.
EOF

if command -v bun >/dev/null 2>&1; then
  RUN="bun run.ts"
else
  RUN="node --experimental-strip-types run.ts"
fi

echo "[obsidian-vault-architect] running audit..."
OUT=$($RUN --audit --vault vault)
echo "$OUT"

echo "$OUT" | grep -q "Nonexistent Note" || { echo "FAIL: should flag broken link"; exit 1; }
echo "$OUT" | grep -q "Orphan.md" || { echo "FAIL: should flag orphaned note"; exit 1; }
if echo "$OUT" | grep -q '"orphanedNotes".*Note B' ; then
  echo "FAIL: Note B receives a link, should not be orphaned"
  exit 1
fi
echo "$OUT" | grep -q "projectstatus" || { echo "FAIL: should detect tag inconsistency"; exit 1; }

echo "[obsidian-vault-architect] creating new note matching convention..."
OUT2=$($RUN --new-note --vault vault --title "New Topic")
echo "$OUT2"
test -f "vault/New Topic.md" || { echo "FAIL: new note not created"; exit 1; }
grep -q 'title: "New Topic"' "vault/New Topic.md" || { echo "FAIL: title frontmatter not set correctly"; exit 1; }
grep -q "created:" "vault/New Topic.md" || { echo "FAIL: created frontmatter missing"; exit 1; }

echo "[obsidian-vault-architect] checking duplicate note rejected..."
if $RUN --new-note --vault vault --title "New Topic" 2>/dev/null; then
  echo "FAIL: should refuse to overwrite existing note"
  exit 1
fi

echo "[obsidian-vault-architect] checking required args..."
if $RUN --vault vault 2>/dev/null; then
  echo "FAIL: should require --audit or --new-note"
  exit 1
fi

echo "PASS: all obsidian-vault-architect skill checks passed"
