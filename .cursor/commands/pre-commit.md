# Pre-commit checks

Run the full pre-commit quality gate on the current uncommitted changes, in
this order. Do NOT create a commit — stop after reporting; committing happens
only when I explicitly ask afterwards.

## 1. Scope

Run `git status --porcelain` and `git diff` (staged + unstaged) to determine
which files and workspaces (`apps/expo`, `apps/next`, `packages/app`) are
affected. Skip steps that don't apply (e.g. no TS changes → skip typecheck).

## 2. Lint + typecheck

- Read linter diagnostics for every changed file and fix any errors I
  introduced.
- Typecheck affected workspaces (`yarn tsc --noEmit` in `apps/expo` and/or
  `apps/next`). Compare failures against the pre-existing baseline — only new
  errors block.
- If `packages/app` logic changed, run `yarn workspace app test`.

## 3. Tests for new/changed behavior

When the diff adds or modifies **behavior** (not docs-only or pure styling),
ensure it has meaningful automated coverage:

- **New hooks, scripts, or CLI utilities** in `.cursor/hooks/` → add or extend
  a smoke test script alongside (see `pre-commit-gate.test.sh` as the pattern).
  Run it and confirm it passes before stamping.
- **New/changed `packages/app` logic** → add Jest tests when they cover real
  behavior (not trivial getters). Run `yarn workspace app test`.
- **Skip** when the change is docs-only, config-only with no logic, or a
  one-line fix with no testable surface.

## 4. Bugbot review

Launch the Bugbot subagent to review the local uncommitted changes
(`Diff: uncommitted changes`). Triage its findings: fix real bugs it reports
in the changed code; list anything ignored as a false positive with a one-line
justification.

## 5. Docs freshness

Per the policy in `AGENTS.md` and `docs/README.md`:

- If the diff touches a feature covered by a doc in `docs/` (see the index in
  `docs/README.md`), update that doc to match the new behavior — or flag it
  for deletion if superseded.
- Do NOT create new session-log style docs (summaries, changelogs,
  checklists).

## 6. Stamp + report

If all blocking steps pass, write `.cursor/.pre-commit-passed`:

```json
{
  "changes_hash": "<sha256 of `git diff HEAD -- . ':!.cursor/.pre-commit-passed'`>",
  "passed_at": "<ISO timestamp>"
}
```

This stamp is required by the `beforeShellExecution` hook
(`.cursor/hooks/pre-commit-gate.sh`) before any agent-initiated `git commit`.
The hook re-validates the hash — if the tree changes after /pre-commit, run
this command again.

End with a short readiness summary:

- Lint/typecheck/tests: pass or list of remaining issues
- Hook smoke tests: pass or N/A
- Bugbot: findings fixed vs. dismissed
- Docs: updated files or "no docs affected"
- Verdict: "ready to commit" or what still blocks
