#!/bin/bash
# Phase 0 Baseline Capture
# Two runs on unchanged tree, parsed-unique from FAIL lines, collection-dead split
#
# CORRECTED 2026-09-09. The prior version used `grep "^FAIL "`, which matches
# ZERO lines: vitest prints " FAIL  path" with a LEADING space and TWO spaces
# after FAIL. Both lists came out empty, `comm -3` on two empty files produced
# no output, and the script reported "✓ File sets identical" as verification.
# A vacuous pass was indistinguishable from a real one.
#
# Two structural fixes:
#   1. FAIL lines are anchored on '^ *FAIL +<path>'. This suite prints the
#      literal "FAIL" inside test content (e.g. "gives: 'creates synergy' →
#      FAIL"), so an unanchored grep is also wrong in the other direction.
#   2. Every derived list is checked NON-EMPTY before any comparison runs.
#      If extraction yields nothing, the script ABORTS instead of concluding
#      parity. Nothing is ever reported as identical without evidence.

set -euo pipefail

# Local time, not UTC. A UTC stamp on a run that starts at 23:50 local names
# the directory with tomorrow's date and an hour that contradicts the logs.
TIMESTAMP=$(date +"%Y-%m-%d_%H%M_%Z")
BASELINE_DIR="BASELINE_PHASE0_${TIMESTAMP}"
mkdir -p "$BASELINE_DIR"

echo "=== Phase 0 Baseline Capture ==="
echo "Timestamp: $TIMESTAMP"
echo "HEAD SHA: $(git rev-parse HEAD)"
echo "Output directory: $BASELINE_DIR"
echo ""

# Freeze check: the tree must not move between or during runs.
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "WARNING: working tree is dirty. Baseline numbers are only meaningful"
  echo "on a frozen tree. Recording the dirty state for the record:"
  git status --porcelain | tee "$BASELINE_DIR/DIRTY_TREE_AT_CAPTURE.txt"
  echo ""
fi

# npm test exits non-zero when tests fail; tee is last in the pipeline so the
# pipeline status is tee's. Guard explicitly so `set -e` cannot abort here.
run_suite() {
  local out="$1"
  npm test > >(tee "$out") 2>&1 || true
  wait
}

echo "=== RUN 1 ==="
run_suite "$BASELINE_DIR/run1_full.log"

echo ""
echo "=== RUN 2 ==="
run_suite "$BASELINE_DIR/run2_full.log"

# ---------------------------------------------------------------------------
# Extraction. Anchored. Collection-dead derived from the bracket form BEFORE
# the bracket is stripped -- vitest marks a file that failed to collect as
#   FAIL  path/to/file.test.js [ path/to/file.test.js ]
# with no "> test name" suffix. Stripping the bracket first destroys the
# only signal that distinguishes a dead file from a live failing one.
# ---------------------------------------------------------------------------
FAIL_RE='^ *FAIL +[^ ]+\.(test|spec)\.[jt]sx?'

extract() {
  local n="$1" log="$BASELINE_DIR/run${n}_full.log"

  grep -aoE "$FAIL_RE" "$log" | sed -E 's/^ *FAIL +//' | sort -u \
    > "$BASELINE_DIR/run${n}_files.txt"

  grep -aoE "${FAIL_RE} +\[" "$log" | sed -E 's/^ *FAIL +//; s/ +\[$//' | sort -u \
    > "$BASELINE_DIR/run${n}_dead_files.txt"

  comm -23 "$BASELINE_DIR/run${n}_files.txt" "$BASELINE_DIR/run${n}_dead_files.txt" \
    > "$BASELINE_DIR/run${n}_live_files.txt"
}

# The guard that was missing. An empty list is a BROKEN PARSE, not a clean run:
# a baseline capture is only run when there are known failures to anchor.
assert_nonempty() {
  local f="$1" n; n=$(wc -l < "$f" | tr -d ' ')
  if [ "$n" -eq 0 ]; then
    echo ""
    echo "ABORT: $f is empty."
    echo "Extraction produced no failing files. That is a parse failure, not"
    echo "parity. Check the FAIL pattern against the raw log before trusting"
    echo "ANY comparison. Sample of what the log actually contains:"
    grep -aE 'FAIL' "$BASELINE_DIR/run1_full.log" | head -5
    exit 1
  fi
  echo "  $f: $n"
}

echo ""
echo "=== Extraction ==="
for n in 1 2; do extract "$n"; done
assert_nonempty "$BASELINE_DIR/run1_files.txt"
assert_nonempty "$BASELINE_DIR/run2_files.txt"
echo "  (collection-dead: run1=$(wc -l < "$BASELINE_DIR/run1_dead_files.txt" | tr -d ' ')" \
     "run2=$(wc -l < "$BASELINE_DIR/run2_dead_files.txt" | tr -d ' '))"

# ---------------------------------------------------------------------------
# Comparison -- now provably over non-empty inputs.
# ---------------------------------------------------------------------------
echo ""
echo "=== File Set Comparison ==="
comm -3 "$BASELINE_DIR/run1_files.txt" "$BASELINE_DIR/run2_files.txt" \
  > "$BASELINE_DIR/flaky_files.txt"
if [ -s "$BASELINE_DIR/flaky_files.txt" ]; then
  SET_VERDICT="FLAKY FILES DETECTED (present in one run, absent in the other):
$(cat "$BASELINE_DIR/flaky_files.txt")"
  echo "$SET_VERDICT"
else
  SET_VERDICT="File sets identical -- verified over $(wc -l < "$BASELINE_DIR/run1_files.txt" | tr -d ' ') non-empty entries per run."
  echo "$SET_VERDICT"
fi

# ---------------------------------------------------------------------------
# Totals. vitest prints its OWN total in parentheses; the Errors bucket only
# prints when non-zero. Summing failed+passed+skipped WITHOUT errors makes a
# run with lost worker reports look short, and falsely implies the two runs
# executed different test sets. Cross-check against the printed total.
# ---------------------------------------------------------------------------
echo ""
echo "=== Test Totals (from log, not console) ==="
for n in 1 2; do
  echo "Run $n:"
  grep -aE "^ *(Test Files|Tests|Errors|Duration) " "$BASELINE_DIR/run${n}_full.log" \
    | tail -4 | sed 's/^/  /'
done
echo ""
echo "NOTE: if 'Errors N' appears, add N when reconciling"
echo "      failed+passed+skipped against the printed (total)."

cat > "$BASELINE_DIR/BASELINE_RECORD.txt" << EOF
Phase 0 Baseline Capture
Timestamp: $TIMESTAMP  (local time)
HEAD SHA: $(git rev-parse HEAD)

File Set Comparison:
$SET_VERDICT

Failing files (Run 1): $(wc -l < "$BASELINE_DIR/run1_files.txt" | tr -d ' ')
Failing files (Run 2): $(wc -l < "$BASELINE_DIR/run2_files.txt" | tr -d ' ')

  live-failing   (Run 1): $(wc -l < "$BASELINE_DIR/run1_live_files.txt" | tr -d ' ')
  live-failing   (Run 2): $(wc -l < "$BASELINE_DIR/run2_live_files.txt" | tr -d ' ')
  collection-dead (Run 1): $(wc -l < "$BASELINE_DIR/run1_dead_files.txt" | tr -d ' ')
  collection-dead (Run 2): $(wc -l < "$BASELINE_DIR/run2_dead_files.txt" | tr -d ' ')

Run 1 totals:
$(grep -aE "^ *(Test Files|Tests|Errors) " "$BASELINE_DIR/run1_full.log" | tail -3)

Run 2 totals:
$(grep -aE "^ *(Test Files|Tests|Errors) " "$BASELINE_DIR/run2_full.log" | tail -3)

Phase 6 comparison rule -- compare against the SET, not the count:
  - in Phase 6, not in run{1,2}_files.txt  -> REGRESSION
  - in run{1,2}_files.txt, not in Phase 6  -> FIX, or a non-report:
                                              check the Errors bucket first
  - movement within *_dead_files.txt       -> REVIVAL, not a fix

  - $BASELINE_DIR/run1_files.txt
  - $BASELINE_DIR/run2_files.txt
EOF

echo ""
cat "$BASELINE_DIR/BASELINE_RECORD.txt"
echo ""
echo "Baseline captured to: $BASELINE_DIR/"
