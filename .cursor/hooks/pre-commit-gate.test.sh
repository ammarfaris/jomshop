#!/usr/bin/env bash
# Smoke tests for pre-commit-gate.sh — run from repo root:
#   bash .cursor/hooks/pre-commit-gate.test.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
GATE="$ROOT/.cursor/hooks/pre-commit-gate.sh"
STAMP="$ROOT/.cursor/.pre-commit-passed"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"; rm -f "$STAMP"' EXIT

cd "$ROOT"
chmod +x "$GATE"

assert_json() {
  local label="$1" json="$2" field="$3" expected="$4"
  local actual
  actual=$(node -e "
    const d = JSON.parse(process.argv[1]);
    process.stdout.write(String(d[process.argv[2]] ?? ''));
  " "$json" "$field")
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL: $label — expected $field=$expected, got $actual"
    exit 1
  fi
  echo "PASS: $label"
}

# 1. Non-commit commands are allowed
out=$(echo '{"command":"git status"}' | "$GATE")
assert_json "git status allowed" "$out" "permission" "allow"

# 2. git commit denied without stamp
out=$(echo '{"command":"git commit -m test"}' | "$GATE")
assert_json "commit denied without stamp" "$out" "permission" "deny"

# 3. git commit allowed with valid stamp
hash=$(git diff HEAD -- . ':!.cursor/.pre-commit-passed' 2>/dev/null | shasum -a 256 | awk '{print $1}')
node -e "
  require('fs').writeFileSync(
    process.argv[1],
    JSON.stringify({ changes_hash: process.argv[2], passed_at: new Date().toISOString() })
  );
" "$STAMP" "$hash"
out=$(echo '{"command":"git commit -m test"}' | "$GATE")
assert_json "commit allowed with valid stamp" "$out" "permission" "allow"

# 4. Stamp invalidated after tree change
echo "// hook test touch" >> "$TMP/touch.txt" 2>/dev/null || true
# Simulate hash mismatch by writing wrong hash
node -e "
  require('fs').writeFileSync(process.argv[1], JSON.stringify({ changes_hash: 'deadbeef' }));
" "$STAMP"
out=$(echo '{"command":"git commit -m test"}' | "$GATE")
assert_json "commit denied on hash mismatch" "$out" "permission" "deny"

echo ""
echo "All pre-commit-gate tests passed."
