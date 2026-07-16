#!/usr/bin/env bash
# Smoke test for scripts/sync-ingest-prompts.mjs
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Snapshot generated outputs before sync.
cp packages/app/features/admin/contestCursorPrompt.ts "$TMP_DIR/before-single.ts"
cp packages/app/features/admin/contestCursorBatchPrompt.ts "$TMP_DIR/before-batch.ts"

yarn sync-ingest-prompts >/dev/null

# Idempotent second run must not rewrite files.
OUTPUT="$(yarn sync-ingest-prompts 2>&1)"
echo "$OUTPUT" | grep -q 'already in sync'

# Outputs must match pre-sync content (markdown sources unchanged).
diff -q packages/app/features/admin/contestCursorPrompt.ts "$TMP_DIR/before-single.ts"
diff -q packages/app/features/admin/contestCursorBatchPrompt.ts "$TMP_DIR/before-batch.ts"

# Generated files must export the expected constants.
grep -q 'export const CURSOR_INGEST_PROMPT' packages/app/features/admin/contestCursorPrompt.ts
grep -q 'export const CURSOR_INGEST_BATCH_PROMPT' packages/app/features/admin/contestCursorBatchPrompt.ts

echo "sync-ingest-prompts smoke test: OK"
