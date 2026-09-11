#!/bin/bash
# Phase X Baseline Capture
# Two runs on unchanged tree, parsed-unique from FAIL lines, collection-dead split
#
# Same structure as Phase 0, for diff against Phase 1b baseline.

set -euo pipefail

TIMESTAMP=$(date +"%Y-%m-%d_%H%M_%Z")
BASELINE_DIR="BASELINE_PHASEX_${1:-run}_${TIMESTAMP}"
mkdir -p "$BASELINE_DIR"

echo "=== Phase X Baseline Capture ==="
echo "Timestamp: $TIMESTAMP"
echo "HEAD SHA: $(git rev-parse HEAD)"
echo "Output directory: $BASELINE_DIR"
echo ""

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "WARNING: working tree is dirty. Baseline numbers are only meaningful"
  echo "on a frozen tree. Recording the dirty state for the record:"
  git status --porcelain | tee "$BASELINE_DIR/DIRTY_TREE_AT_CAPTURE.txt"
  echo ""
fi

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
Phase X Baseline Capture
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

Phase X diff rule -- compare against Phase 1b:
  - in Phase 1b, not in Phase X  -> REGRESSION
  - in Phase X, not in Phase 1b  -> NEW FAILURE
  - $BASELINE_DIR/run1_files.txt
  - $BASELINE_DIR/run2_files.txt

Flake-aware reading of the above (see BASELINE_FLAKE_ROSTER.md):
  - $BASELINE_DIR/exclusion_manifest.txt  roster + observed mechanisms
  - $BASELINE_DIR/toggle_state.txt        STATE_TOGGLE state per run, explicit
  - $BASELINE_DIR/diff_vs_core.txt        KNOWN FLAKE vs MOVEMENT, plus raw

A difference naming a roster file is a KNOWN FLAKE. A difference naming
anything else is MOVEMENT. The raw unsubtracted lists above are unchanged
and remain the evidence; the subtraction is only a reading aid.
EOF

echo ""
cat "$BASELINE_DIR/BASELINE_RECORD.txt"

# Flake-aware diff. Aborts (non-zero) if the roster is empty, the core
# comparator is missing or unparseable, or a STATE_TOGGLE file's state cannot
# be determined -- same treatment as the empty-list guard above, and for the
# same reason: a comparison that cannot be read must not look like a clean one.
echo ""
echo "=== Flake-aware diff ==="
if [ -x ./BASELINE_DIFF.sh ]; then
  ./BASELINE_DIFF.sh "$BASELINE_DIR"
else
  echo "ABORT: ./BASELINE_DIFF.sh is missing or not executable."
  echo "The raw capture above is intact, but no flake-aware diff was produced."
  echo "Do not read the file sets as a clean comparison without it."
  exit 1
fi

echo ""
echo "Baseline captured to: $BASELINE_DIR/"
