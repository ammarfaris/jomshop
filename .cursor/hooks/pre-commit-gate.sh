#!/usr/bin/env bash
# Gates agent-initiated `git commit` until /pre-commit has passed.
# Reads JSON from stdin (beforeShellExecution hook payload).
set -euo pipefail

STAMP=".cursor/.pre-commit-passed"

read -r input

command=$(node -e "
  const d = JSON.parse(process.argv[1] || '{}');
  process.stdout.write(d.command || '');
" "$input")

if [[ ! "$command" =~ git[[:space:]]+commit ]]; then
  echo '{"permission":"allow"}'
  exit 0
fi

if [[ ! -f "$STAMP" ]]; then
  cat <<'EOF'
{
  "permission": "deny",
  "user_message": "Run /pre-commit in Agent chat before committing.",
  "agent_message": "Commit blocked: run the /pre-commit command first (lint, typecheck, tests, Bugbot, docs). After it passes, the stamp file .cursor/.pre-commit-passed is written — then retry git commit."
}
EOF
  exit 0
fi

# Invalidate stamp when the working tree changes after /pre-commit ran.
current_hash=$(git diff HEAD -- . ':!.cursor/.pre-commit-passed' 2>/dev/null | shasum -a 256 | awk '{print $1}')
stamp_hash=$(node -e "
  const fs = require('fs');
  try {
    const d = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'));
    process.stdout.write(d.changes_hash || '');
  } catch { process.stdout.write(''); }
" "$STAMP")

if [[ -z "$stamp_hash" || "$current_hash" != "$stamp_hash" ]]; then
  cat <<EOF
{
  "permission": "deny",
  "user_message": "Changes since /pre-commit — run /pre-commit again before committing.",
  "agent_message": "Commit blocked: working tree changed since the last /pre-commit run (hash mismatch). Re-run /pre-commit, then retry git commit."
}
EOF
  exit 0
fi

echo '{"permission":"allow"}'
exit 0
