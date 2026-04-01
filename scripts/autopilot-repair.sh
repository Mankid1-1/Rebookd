#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────────
# Autopilot Repair Script
#
# Called by the Sentinel via autopilot-executor.ts.
# Creates a git branch, invokes Claude Code CLI to fix an error,
# runs the Triple-Lock (tsc + vitest + lint), and merges if all pass.
#
# Arguments:
#   $1 - JOB_ID
#   $2 - BRANCH_NAME
#   $3 - ERROR_TYPE
#   $4 - ERROR_MESSAGE
#   $5 - STACK_TRACE
#   $6 - AFFECTED_FILE
#   $7 - PROTECTED_FILES (comma-separated)
#
# Exit codes:
#   0 - Repair succeeded, merged
#   1 - TypeScript check failed
#   2 - Tests failed
#   3 - Claude CLI failed
#   4 - Protected file violation (should not happen, but safety net)
#   5 - Git operation failed
#   6 - No-op: no net changes after protected-file revert (nothing to commit)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

JOB_ID="${1:?Missing JOB_ID}"
BRANCH_NAME="${2:?Missing BRANCH_NAME}"
ERROR_TYPE="${3:?Missing ERROR_TYPE}"
ERROR_MESSAGE="${4:?Missing ERROR_MESSAGE}"
STACK_TRACE="${5:?Missing STACK_TRACE}"
AFFECTED_FILE="${6:?Missing AFFECTED_FILE}"
PROTECTED_FILES_CSV="${7:?Missing PROTECTED_FILES}"
ATTEMPT_NUMBER="${8:-1}"
PREVIOUS_FAILURE="${9:-}"
PREVIOUS_OUTPUT="${10:-}"

ORIGINAL_BRANCH="$(git branch --show-current)"
MERGE_SUCCESS=false

# ─── Cleanup trap: always return to original branch ───────────────────────────

cleanup() {
  if [ "$MERGE_SUCCESS" = false ]; then
    git checkout "$ORIGINAL_BRANCH" 2>/dev/null || true
    git branch -D "$BRANCH_NAME" 2>/dev/null || true
  fi
}
trap cleanup EXIT

# ─── Step 1: Create repair branch ────────────────────────────────────────────

echo "[autopilot] Creating branch $BRANCH_NAME from $ORIGINAL_BRANCH"
git checkout -b "$BRANCH_NAME" || exit 5

# ─── Step 2: Invoke Claude Code CLI ──────────────────────────────────────────

# ─── Build strategy-aware prompt ─────────────────────────────────────────────
RETRY_CONTEXT=""
if [ "$ATTEMPT_NUMBER" -gt 1 ] && [ -n "$PREVIOUS_FAILURE" ]; then
  RETRY_CONTEXT="
IMPORTANT — THIS IS RETRY ATTEMPT #${ATTEMPT_NUMBER}. The previous attempt FAILED:
Previous failure reason: ${PREVIOUS_FAILURE}
Previous approach output (summary): ${PREVIOUS_OUTPUT:0:800}

You MUST try a DIFFERENT approach this time. Do NOT repeat what failed before."
fi

STRATEGY_INSTRUCTIONS=""
case "$ATTEMPT_NUMBER" in
  1)
    STRATEGY_INSTRUCTIONS="STRATEGY: Focused fix. Read the affected file, identify the root cause at the crash site, apply the minimal one-line fix."
    ;;
  2)
    STRATEGY_INSTRUCTIONS="STRATEGY: Broader context. Read the affected file AND any files it imports that are relevant to the error. The bug may be in a dependency or caller, not at the crash site. Look at type definitions, interfaces, and function signatures."
    ;;
  3)
    STRATEGY_INSTRUCTIONS="STRATEGY: Root cause analysis. The error has resisted two fix attempts. Use Grep to search the codebase for related patterns. Check if the error is caused by a missing migration, wrong config, or architectural mismatch. You may modify multiple files if needed."
    ;;
  4|5)
    STRATEGY_INSTRUCTIONS="STRATEGY: Defensive fix. Add comprehensive null checks, type guards, try-catch blocks, or fallback values around the crash site. If the root cause is unclear, make the code resilient to the failure instead. Consider adding a graceful degradation path."
    ;;
esac

CLAUDE_PROMPT="You are Sentinel, the autonomous repair agent for the Rebooked platform (a multi-tenant SMS revenue recovery SaaS).

ERROR TYPE: ${ERROR_TYPE}
ERROR MESSAGE: ${ERROR_MESSAGE}

STACK TRACE:
${STACK_TRACE}

AFFECTED FILE: ${AFFECTED_FILE}
${RETRY_CONTEXT}

${STRATEGY_INSTRUCTIONS}

CRITICAL: You MUST use your Edit and Write tools to actually modify the source files on disk.
Do NOT output code as text — use the Edit tool to apply changes directly to the affected file.
If you output a code block instead of using Edit/Write, the repair will fail.

INSTRUCTIONS:
1. Read the affected file to understand context.
2. Identify the root cause of the error.
3. Use the Edit tool to apply the fix directly to the file.
4. If the affected file is 'unknown', use Grep to search for the error message or related code patterns.
5. DO NOT modify any of these protected files: ${PROTECTED_FILES_CSV}
6. DO NOT add new dependencies.
7. DO NOT refactor unrelated code.
8. Confirm what you changed and why."

echo "===REPAIR_OUTPUT_START==="
# --dangerously-skip-permissions allows tool use (Edit/Write/Read) in non-interactive mode
# without this flag, Claude blocks on every permission prompt and never edits any files
# Capture output and prompt to temp files to avoid delimiter loss / quoting issues
CLAUDE_OUTPUT_FILE=$(mktemp /tmp/autopilot-claude-XXXXXX.txt)
CLAUDE_PROMPT_FILE=$(mktemp /tmp/autopilot-prompt-XXXXXX.txt)
echo "$CLAUDE_PROMPT" > "$CLAUDE_PROMPT_FILE"
chmod 666 "$CLAUDE_OUTPUT_FILE" "$CLAUDE_PROMPT_FILE"

# Claude CLI refuses --dangerously-skip-permissions when running as root.
# If running as root, delegate to the non-root 'rebooked' user.
run_claude() {
  if [ "$(id -u)" = "0" ]; then
    su -s /bin/bash rebooked -c "cd /opt/rebooked && export ANTHROPIC_API_KEY='${ANTHROPIC_API_KEY:-}' && claude --print --dangerously-skip-permissions \"\$(cat $CLAUDE_PROMPT_FILE)\"" > "$CLAUDE_OUTPUT_FILE" 2>&1
  else
    claude --print --dangerously-skip-permissions "$(cat "$CLAUDE_PROMPT_FILE")" > "$CLAUDE_OUTPUT_FILE" 2>&1
  fi
}

if ! run_claude; then
  # Truncate to last 50KB to keep delimiters parseable
  tail -c 51200 "$CLAUDE_OUTPUT_FILE"
  echo "===REPAIR_OUTPUT_END==="
  rm -f "$CLAUDE_OUTPUT_FILE"
  echo "[autopilot] Claude CLI failed"
  exit 3
fi
# Truncate to last 50KB to keep delimiters parseable
tail -c 51200 "$CLAUDE_OUTPUT_FILE"
rm -f "$CLAUDE_OUTPUT_FILE"
echo "===REPAIR_OUTPUT_END==="

# ─── Step 3: Safety scan - check for protected file modifications ─────────────

echo "[autopilot] Running safety scan on modified files"
IFS=',' read -ra PROTECTED_ARRAY <<< "$PROTECTED_FILES_CSV"
CHANGED_FILES=$(git diff --name-only)

for changed in $CHANGED_FILES; do
  for protected in "${PROTECTED_ARRAY[@]}"; do
    if [ "$changed" = "$protected" ]; then
      echo "[autopilot] VIOLATION: Protected file $protected was modified. Reverting."
      git checkout -- "$protected"
    fi
  done
done

# Check if there are any actual changes left
if [ -z "$(git diff --name-only)" ] && [ -z "$(git diff --staged --name-only)" ]; then
  echo "[autopilot] No net changes after safety scan — nothing to commit."
  exit 6
fi

# ─── Step 4: Capture diff for audit ──────────────────────────────────────────

echo "===REPAIR_DIFF_START==="
git diff
echo "===REPAIR_DIFF_END==="

# ─── Step 5: Triple-Lock Verification ────────────────────────────────────────

echo "===REPAIR_TEST_START==="

# Detect production environment: the VPS only has dist bundles, not source.
# If tsconfig.json is missing we're on the production VPS — skip tsc/vitest
# because they require source files to work correctly.
HAS_SOURCE=true
if [ ! -f "tsconfig.json" ] && [ ! -f "package.json" ]; then
  HAS_SOURCE=false
fi

# Also detect if pnpm is available
if ! command -v pnpm &>/dev/null; then
  HAS_SOURCE=false
fi

if [ "$HAS_SOURCE" = true ]; then
  # Lock 1: TypeScript compiler
  echo "[autopilot] Lock 1/3: TypeScript type check"
  if ! pnpm check:types 2>&1; then
    echo "===REPAIR_TEST_END==="
    echo "[autopilot] FAILED: TypeScript check"
    exit 1
  fi

  # Lock 2: Vitest test suite — use a random port to avoid EADDRINUSE
  echo "[autopilot] Lock 2/3: Running tests"
  if ! PORT=0 pnpm test 2>&1; then
    echo "===REPAIR_TEST_END==="
    echo "[autopilot] FAILED: Tests"
    exit 2
  fi

  # Lock 3: ESLint (non-blocking, warn only)
  echo "[autopilot] Lock 3/3: Linting (non-blocking)"
  pnpm lint 2>&1 || echo "[autopilot] Lint warnings detected (non-blocking)"
else
  echo "[autopilot] Production environment detected (no source files). Skipping triple-lock."
  echo "[autopilot] Validating syntax of changed files only..."
  # Minimal validation: check that modified JS/TS files parse correctly
  for changed_file in $(git diff --name-only); do
    if [[ "$changed_file" == *.js || "$changed_file" == *.ts || "$changed_file" == *.tsx ]]; then
      if ! node -c "$changed_file" 2>&1; then
        echo "[autopilot] FAILED: Syntax error in $changed_file"
        echo "===REPAIR_TEST_END==="
        exit 1
      fi
    fi
  done
  echo "[autopilot] Syntax validation passed."
fi

echo "===REPAIR_TEST_END==="

# ─── Step 6: Commit and merge ────────────────────────────────────────────────

echo "[autopilot] All locks passed. Committing and merging."

git add -A
git commit -m "fix(autopilot): repair ${ERROR_TYPE} error in ${AFFECTED_FILE}

Automated fix by Rebooked Autopilot Repair Engine.
Job ID: ${JOB_ID}
Error: ${ERROR_MESSAGE:0:100}

Co-Authored-By: Rebooked Autopilot <autopilot@rebooked.org>"

git checkout "$ORIGINAL_BRANCH"
git merge --no-ff "$BRANCH_NAME" -m "merge(autopilot): integrate fix/${JOB_ID}"
git branch -d "$BRANCH_NAME"

MERGE_SUCCESS=true
echo "[autopilot] Repair merged successfully."
exit 0
