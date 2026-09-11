#!/bin/bash
# Baseline diff -- reads a capture directory and reports whether each file-set
# difference against the core comparator is a KNOWN FLAKE or real MOVEMENT.
#
# Split out of BASELINE_PHASEX_CAPTURE.sh so it can be run (and mutation-tested)
# against an already-captured directory without re-running a 20-minute suite.
#
# Usage:
#   ./BASELINE_DIFF.sh <capture_dir> [core_file] [roster_file]
#
# Reads:   <capture_dir>/run{1,2}_{files,live_files,dead_files}.txt
#          <capture_dir>/run{1,2}_full.log
#          BASELINE_CORE_SET.txt        (core comparator; # comments allowed)
#          BASELINE_FLAKE_ROSTER.tsv    (roster; # comments allowed)
# Writes:  <capture_dir>/exclusion_manifest.txt
#          <capture_dir>/toggle_state.txt
#          <capture_dir>/diff_vs_core.txt
#
# The subtraction is a READING AID. diff_vs_core.txt always carries the raw
# unsubtracted comm output as well; nothing is ever only summarised.
#
# ---------------------------------------------------------------------------
# COUNTER-TEST EVERY GUARD, DO NOT ONLY MUTATION-TEST IT.
#
# Mutation-testing asks "does the guard fire when it should?" Counter-testing
# asks "does it stay quiet when it should?" -- and it is the second question
# that found the one real bug in this script.
#
# Guard 3 (toggle state) was mutation-tested and fired correctly. The
# counter-test -- same capture, plus a real " ✓ <path>" line so the state
# resolves to "passing" -- exited 1 anyway. Cause: raw_comm ended with
# `[ -n "$only_r" ] && echo ...`, which returns 1 when the test is false, and
# under `set -e` that killed the script mid-write, TRUNCATING diff_vs_core.txt
# at exactly the moment one side of a comm was empty -- the common case. The
# earlier runs had passed only on which side happened to be empty.
#
# That is the vacuous-pass shape, inside the script written to prevent vacuous
# passes, and no guard here caught it. Guards check their inputs; they do not
# check that the script reaches its own end. The counter-test does.
# ---------------------------------------------------------------------------

set -euo pipefail

CAPTURE_DIR="${1:?usage: BASELINE_DIFF.sh <capture_dir> [core_file] [roster_file]}"
CORE_FILE="${2:-BASELINE_CORE_SET.txt}"
ROSTER_FILE="${3:-BASELINE_FLAKE_ROSTER.tsv}"

CAPTURE_DIR="${CAPTURE_DIR%/}"

abort() {
  echo ""
  echo "ABORT: $1"
  shift
  for line in "$@"; do printf '%s\n' "$line" | sed 's/^/  /'; done
  echo ""
  echo "No diff was written. An unreadable diff is worse than no diff: the"
  echo "leading-space grep bug once produced 'file sets identical' from two"
  echo "empty files. Fix the input, do not read past this."
  exit 1
}

strip_comments() { grep -v '^[[:space:]]*#' "$1" | sed 's/^[[:space:]]*//; s/[[:space:]]*$//' | grep -v '^$' || true; }

# ---------------------------------------------------------------- GUARD: inputs

[ -d "$CAPTURE_DIR" ] || abort "capture directory not found: $CAPTURE_DIR"

for n in 1 2; do
  for part in files live_files dead_files; do
    [ -f "$CAPTURE_DIR/run${n}_${part}.txt" ] \
      || abort "missing derived list: $CAPTURE_DIR/run${n}_${part}.txt" \
               "Run the extraction step in BASELINE_PHASEX_CAPTURE.sh first."
  done
  [ -f "$CAPTURE_DIR/run${n}_full.log" ] \
    || abort "missing raw log: $CAPTURE_DIR/run${n}_full.log" \
             "The raw log is the only positive evidence for the 'passing' state." \
             ".gitignore:5 blanket-ignores *.log; the !**/BASELINE_*/*.log negation" \
             "at .gitignore:9 is what keeps these in history. Check it survived."
done

# ------------------------------------------------- GUARD 1: roster not empty

[ -f "$ROSTER_FILE" ] \
  || abort "roster manifest not found: $ROSTER_FILE" \
           "Without a roster every difference reads as movement, which is the" \
           "state this tooling exists to end."

ROSTER_ROWS=$(strip_comments "$ROSTER_FILE" | grep -v $'^path\tkind' || true)
ROSTER_N=$(printf '%s\n' "$ROSTER_ROWS" | grep -c . || true)

if [ "$ROSTER_N" -eq 0 ]; then
  abort "roster manifest $ROSTER_FILE has 0 data rows." \
        "A roster of zero files subtracts nothing, so every difference would be" \
        "reported as MOVEMENT -- indistinguishable from a run with no flakes." \
        "That is the vacuous-pass shape. Populate the roster or delete the call."
fi

ROSTER_PATHS=$(printf '%s\n' "$ROSTER_ROWS" | cut -f1 | sort -u)

# ------------------------------------------- GUARD 2: core comparator present

[ -f "$CORE_FILE" ] \
  || abort "core comparator not found: $CORE_FILE" \
           "There is nothing to diff against. A missing comparator must not" \
           "degrade into 'no differences found'."

CORE_SORTED=$(mktemp); trap 'rm -f "$CORE_SORTED"' EXIT
strip_comments "$CORE_FILE" | sort -u > "$CORE_SORTED"
CORE_N=$(wc -l < "$CORE_SORTED" | tr -d ' ')

if [ "$CORE_N" -eq 0 ]; then
  abort "core comparator $CORE_FILE contains 0 file paths." \
        "comm against an empty set reports every observed file as new and every" \
        "core file as fixed. That is a parse failure wearing a result's clothes."
fi

# ------------------------------------------------- core-vs-capture provenance
#
# NOT a guard. Comparing a capture against an older core is often exactly what
# you want. But a stale core is the one way this instrument degrades toward a
# PLAUSIBLE WRONG ANSWER instead of a visible error -- drift reads as movement,
# and the reader investigates the code instead of the comparator. Everything
# else here fails loudly; this one fails convincingly. So the provenance is
# stated on every diff, whether or not the shas differ, and the reader always
# knows what they are comparing against rather than assuming freshness.

CORE_SHA=$(grep -a -m1 '^# *core-frozen-at:' "$CORE_FILE" | sed -E 's/^# *core-frozen-at: *//; s/[[:space:]]*$//' || true)
CAPTURE_SHA=$(grep -a -m1 '^HEAD SHA:' "$CAPTURE_DIR/BASELINE_RECORD.txt" 2>/dev/null | awk '{print $3}' || true)
[ -z "$CAPTURE_SHA" ] && CAPTURE_SHA=$(git rev-parse HEAD 2>/dev/null || echo "")

provenance_line() {
  if [ -z "$CORE_SHA" ]; then
    echo "  core frozen at: UNRECORDED -- $CORE_FILE has no '# core-frozen-at:' line."
    echo "    You cannot tell whether this comparison is fresh or years stale."
    echo "    Add the line when you re-freeze; until then read every difference"
    echo "    below as possibly comparator drift rather than code movement."
    return 0
  fi
  echo "  core frozen at: $CORE_SHA"
  if [ -z "$CAPTURE_SHA" ]; then
    echo "  capture at:     UNKNOWN (no 'HEAD SHA:' in BASELINE_RECORD.txt, and"
    echo "                  git rev-parse gave nothing). Distance not computable."
    return 0
  fi
  echo "  capture at:     $CAPTURE_SHA"
  if [ "$CORE_SHA" = "$CAPTURE_SHA" ]; then
    echo "  distance:       same commit -- core and capture are the same tree."
    return 0
  fi
  # Symmetric distance. `git rev-list --count A..B` counts only commits
  # reachable from B and not A, so a capture taken BEFORE the core was frozen
  # reports 0 -- which reads as "no drift" for the stalest possible comparison.
  # Measured: the X2205 capture (75b95fc) sits 4 commits behind the core
  # (4ed453d) and `core..capture` returned 0. Use --left-right on a three-dot
  # range, which reports both sides.
  local lr behind ahead
  if ! lr=$(git rev-list --left-right --count "$CORE_SHA"..."$CAPTURE_SHA" 2>/dev/null); then
    echo "  distance:       NOT COMPUTABLE -- one of these commits is not in this"
    echo "                  repo (shallow clone, or the sha was rewritten). Treat"
    echo "                  the comparison as of unknown freshness."
    return 0
  fi
  behind=$(printf '%s' "$lr" | awk '{print $1}')
  ahead=$(printf '%s' "$lr" | awk '{print $2}')
  echo "  distance:       capture is $ahead commit(s) ahead of the core and" \
       "$behind behind"
  if [ "$behind" -gt 0 ]; then
    echo "                  CAPTURE PREDATES THE CORE. You are comparing an older"
    echo "                  run against a newer comparator; differences below can"
    echo "                  be the core's own later state, not this run's."
  fi

  # A raw count is alarming without context: commits that only touch the
  # baseline record cannot move a test result. Count the ones that could.
  # NB: `set -o pipefail` is on, and `grep -v` returns 1 on empty input, which
  # fails the whole pipeline and -- under set -e -- kills the script mid-write.
  # That is how this function died the first time it met an empty range.
  local prod
  prod=$( { git log --format='%H' --name-only "$CORE_SHA...$CAPTURE_SHA" 2>/dev/null || true; } \
          | grep -vE '^(BASELINE_|[0-9a-f]{40}$|$)' | wc -l | tr -d ' ' ) || prod=""
  if [ -z "$prod" ]; then
    echo "                  (product-change count unavailable)"
  elif [ "$prod" -eq 0 ]; then
    echo "                  no file outside BASELINE_*/ changed in that range --"
    echo "                  no product change between core and capture."
  else
    echo "                  $prod file change(s) outside BASELINE_*/ in that range."
    echo "                  A difference below may be comparator drift rather than"
    echo "                  movement. Re-freeze the core before concluding."
  fi
}

# ----------------------------- GUARD 3: toggle-file state must be determinable
#
# Three states, each detected by a POSITIVE signal. Absence from the failing
# lists is not evidence of passing -- it is equally consistent with the file
# never having run. Unresolved => abort.
#
#   collection-dead  membership in runN_dead_files.txt  (FAIL <path> [ <path> ])
#   live-failing     membership in runN_live_files.txt  (FAIL <path> > <test>)
#   passing          a " ✓ <path>  (N test…)" line in runN_full.log

TOGGLE_PATHS=$(printf '%s\n' "$ROSTER_ROWS" | awk -F'\t' '$2=="STATE_TOGGLE"{print $1}')

if [ -z "$TOGGLE_PATHS" ]; then
  abort "roster declares no STATE_TOGGLE file." \
        "AppShell.onboardingToGoalAdmission.flow is known to toggle live-failing" \
        "<-> collection-dead, which moves the failing-FILE count and the" \
        "failing-TEST total in opposite directions at once. If that row is gone," \
        "say why in the roster rather than dropping the check."
fi

toggle_state() {
  local file="$1" n="$2"
  if grep -qxF "$file" "$CAPTURE_DIR/run${n}_dead_files.txt"; then
    echo "collection-dead"
  elif grep -qxF "$file" "$CAPTURE_DIR/run${n}_live_files.txt"; then
    echo "live-failing"
  elif grep -aqE "^[[:space:]]*✓[[:space:]]+${file//./\\.}[[:space:]]+\(" "$CAPTURE_DIR/run${n}_full.log"; then
    echo "passing"
  else
    echo "INDETERMINATE"
  fi
}

{
  echo "# State of each STATE_TOGGLE roster file, per run."
  echo "# Recorded as an explicit field. Do NOT infer this from the file lists:"
  echo "# a live-failing -> collection-dead move leaves the failing-FILE set"
  echo "# unchanged while the failing-TEST total drops, so the file-set diff is"
  echo "# empty and silent at exactly the moment the counts stop meaning the same"
  echo "# thing. Measured example, BASELINE_PHASEX_GATE_STORAGE_2026-09-11_1208_CDT:"
  echo "#   run1 collected 4637, 169 failing tests, 61 failing files, Failed Suites 2"
  echo "#   run2 collected 4635, 167 failing tests, 61 failing files, Failed Suites 3"
  echo "# Same 61 files. Two tests gone. flaky_files.txt was empty."
  echo "#"
  echo "# states: live-failing | collection-dead | passing"
  echo ""
} > "$CAPTURE_DIR/toggle_state.txt"

INDETERMINATE=""
TOGGLE_CHANGED=""
while IFS= read -r tf; do
  [ -z "$tf" ] && continue
  s1=$(toggle_state "$tf" 1)
  s2=$(toggle_state "$tf" 2)
  echo "run1_state[$tf]=$s1" >> "$CAPTURE_DIR/toggle_state.txt"
  echo "run2_state[$tf]=$s2" >> "$CAPTURE_DIR/toggle_state.txt"
  if [ "$s1" = "INDETERMINATE" ]; then INDETERMINATE="${INDETERMINATE}  $tf  (run1)
"; fi
  if [ "$s2" = "INDETERMINATE" ]; then INDETERMINATE="${INDETERMINATE}  $tf  (run2)
"; fi
  if [ "$s1" != "$s2" ]; then
    TOGGLE_CHANGED="${TOGGLE_CHANGED}  $tf: run1=$s1 -> run2=$s2
"
  fi
done <<< "$TOGGLE_PATHS"

if [ -n "$INDETERMINATE" ]; then
  rm -f "$CAPTURE_DIR/toggle_state.txt"
  abort "state of a STATE_TOGGLE file could not be determined:" \
        "$(printf '%s' "$INDETERMINATE")" \
        "It is in neither the live-failing nor the collection-dead list, and the" \
        "run log carries no ' ✓ <path>' line for it. That is not 'it passed' --" \
        "it is equally consistent with the file never having run. Resolve it" \
        "against the raw log before any count from this capture is quoted."
fi

echo "END-OF-TOGGLE-STATE -- if this line is missing the file was truncated" \
  >> "$CAPTURE_DIR/toggle_state.txt"

# ------------------------------------------------------- exclusion manifest

{
  echo "Exclusion manifest -- $CAPTURE_DIR"
  echo "Generated $(date +'%Y-%m-%d %H:%M %Z') from $ROSTER_FILE"
  echo ""
  echo "These files are known to move between runs of an unchanged tree. When one"
  echo "of them appears in a set difference below, the difference is labelled"
  echo "KNOWN FLAKE. Everything else is labelled MOVEMENT. Mechanisms are drawn"
  echo "from committed run logs; see BASELINE_FLAKE_ROSTER.md for the raw lines."
  echo ""
  printf '%s\n' "$ROSTER_ROWS" | awk -F'\t' '{
    printf "  %s\n    kind:      %s\n    mechanism: %s\n    evidence:  %s\n\n", $1, $2, $3, $4
  }'
  echo "Roster size: $ROSTER_N files"
  echo "END-OF-MANIFEST -- if this line is missing the file was truncated"
} > "$CAPTURE_DIR/exclusion_manifest.txt"

# ------------------------------------------------------------------- the diff

RUN1=$(mktemp); RUN2=$(mktemp); ROSTER_SORTED=$(mktemp)
trap 'rm -f "$CORE_SORTED" "$RUN1" "$RUN2" "$ROSTER_SORTED"' EXIT
sort -u "$CAPTURE_DIR/run1_files.txt" > "$RUN1"
sort -u "$CAPTURE_DIR/run2_files.txt" > "$RUN2"
printf '%s\n' "$ROSTER_PATHS" > "$ROSTER_SORTED"

emit_side() {
  # $1 = list file, $2 = heading
  local list="$1" heading="$2" known movement
  known=$(comm -12 "$list" "$ROSTER_SORTED")
  movement=$(comm -23 "$list" "$ROSTER_SORTED")
  echo "  $heading"
  if [ -n "$movement" ]; then
    echo "$movement" | sed 's/^/    MOVEMENT     /'
  fi
  if [ -n "$known" ]; then
    echo "$known" | sed 's/^/    KNOWN FLAKE  /'
  fi
  if [ -z "$movement$known" ]; then
    echo "    (none)"
  fi
}

{
  echo "Diff vs core -- $CAPTURE_DIR"
  echo "Generated $(date +'%Y-%m-%d %H:%M %Z')"
  echo ""
  echo "Core comparator: $CORE_FILE ($CORE_N files)"
  echo "Roster:          $ROSTER_FILE ($ROSTER_N files)"
  echo "Observed:        run1 $(wc -l < "$RUN1" | tr -d ' ') files, run2 $(wc -l < "$RUN2" | tr -d ' ') files"
  echo ""
  echo "WHAT YOU ARE COMPARING AGAINST"
  provenance_line
  echo ""
  echo "STATE_TOGGLE files (explicit, not inferred):"
  grep -v '^#' "$CAPTURE_DIR/toggle_state.txt" | grep -v '^END-OF-' | grep . | sed 's/^/  /'
  echo ""
  if [ -n "$TOGGLE_CHANGED" ]; then
    echo "  *** STATE CHANGED BETWEEN RUNS ***"
    printf '%s' "$TOGGLE_CHANGED" | sed 's/^/  /'
    echo ""
    echo "  A live-failing <-> collection-dead move changes the failing-TEST total"
    echo "  and the COLLECTED total without changing the failing-FILE set. The file"
    echo "  set comparisons below are therefore NOT comparable to the test counts"
    echo "  for this capture. Reconcile against the per-run totals:"
    for n in 1 2; do
      printf '    run%s: ' "$n"
      grep -aE "^ *(Test Files|Tests|Errors) " "$CAPTURE_DIR/run${n}_full.log" \
        | tail -3 | tr -s ' ' | tr '\n' '|'
      echo ""
    done
    echo ""
  fi
  echo "=============================================================="
  echo "READING AID -- roster subtracted"
  echo "=============================================================="
  echo ""
  echo "THE ROSTER IS A LOWER BOUND. A file is admitted to it only by being"
  echo "observed to move WITHIN a capture -- run 1 vs run 2 of the same frozen"
  echo "tree. That is the only comparison that separates nondeterminism from"
  echo "code change, but it can only see a file that flaked during a two-run"
  echo "capture. A file that flakes rarely enough to have surfaced once in"
  echo "fourteen runs is indistinguishable from a stable one until it moves."
  echo ""
  echo "So a first-time appearance is reported MOVEMENT, and that is the"
  echo "correct default -- treat it as real until an isolated re-run and a"
  echo "named mechanism say otherwise. But it should not be a surprise: two"
  echo "of the five current roster members were first observations in the"
  echo "PREPUSH capture, absent from all twelve prior runs. Expect a sixth."
  echo ""
  for n in 1 2; do
    rf="$RUN1"; [ "$n" = 2 ] && rf="$RUN2"
    APPEARED=$(mktemp); DISAPPEARED=$(mktemp)
    comm -13 "$CORE_SORTED" "$rf" > "$APPEARED"
    comm -23 "$CORE_SORTED" "$rf" > "$DISAPPEARED"
    echo "RUN $n"
    emit_side "$APPEARED"    "failing here, not in core  (candidate regression):"
    emit_side "$DISAPPEARED" "in core, not failing here  (candidate fix):"
    echo ""
    rm -f "$APPEARED" "$DISAPPEARED"
  done
  echo "=============================================================="
  echo "RAW -- unsubtracted comm output. This is the evidence."
  echo "The section above is a reading aid and never replaces it."
  echo "=============================================================="
  echo ""
  raw_comm() {
    # $1 left list, $2 right list, $3 left label, $4 right label
    local only_l only_r
    only_l=$(comm -23 "$1" "$2"); only_r=$(comm -13 "$1" "$2")
    if [ -z "$only_l" ] && [ -z "$only_r" ]; then
      echo "  (identical -- symmetric difference is empty over" \
           "$(wc -l < "$1" | tr -d ' ') and $(wc -l < "$2" | tr -d ' ') non-empty entries)"
      return
    fi
    # NB: plain `[ -n "$x" ] && echo ...` as the last statement returns 1 when
    # the test is false, and under `set -e` that aborts the whole script --
    # silently truncating this file at the exact moment one side is empty,
    # which is the common case. Use if-blocks.
    if [ -n "$only_l" ]; then echo "$only_l" | sed "s/^/  $3 only: /"; fi
    if [ -n "$only_r" ]; then echo "$only_r" | sed "s/^/  $4 only: /"; fi
    return 0
  }

  for n in 1 2; do
    rf="$RUN1"; [ "$n" = 2 ] && rf="$RUN2"
    echo "RUN $n vs core"
    raw_comm "$CORE_SORTED" "$rf" "core" "run$n"
    echo ""
  done
  echo "RUN 1 vs RUN 2  (within-capture; the only comparison that isolates"
  echo "nondeterminism from code change)"
  raw_comm "$RUN1" "$RUN2" "run1" "run2"
  echo ""
  echo "--------------------------------------------------------------"
  echo "IF YOU GREP THE RAW LOGS BY HAND, USE grep -a"
  echo "--------------------------------------------------------------"
  echo "run1_full.log and run2_full.log contain bytes that make grep treat"
  echo "them as binary. Without -a it suppresses matching output entirely and"
  echo "returns NOTHING -- not an error, not a warning, an empty result that"
  echo "reads exactly like absence. Measured: a pattern that sed found in these"
  echo "logs returned empty from grep on the same file."
  echo ""
  echo "This is the pattern-match trap in its nastiest form. The usual case is"
  echo "a populated result answering a question you did not ask; this one is a"
  echo "null result answering no question at all. Every grep in this script and"
  echo "in BASELINE_PHASEX_CAPTURE.sh carries -a for this reason."
} > "$CAPTURE_DIR/diff_vs_core.txt"

echo "END-OF-DIFF -- if this line is missing the file was truncated" >> "$CAPTURE_DIR/diff_vs_core.txt"

# ---------------------------------------------- end-marker self-check
#
# The durable lesson from the set -e episode: five guards fired correctly and
# the exit code was 0 while this script was silently truncating its own output
# mid-write. Input validation cannot reach that -- guards check what goes in,
# not that the program reached its own end, and a half-written file looks
# merely short rather than wrong.
#
# So every generated artifact ends with a marker, and we assert on it here.
# Cheap enough to apply to every generated artifact in this campaign, not just
# this one.

check_end_marker() {
  local f="$1" marker="$2"
  [ -f "$f" ] || abort "generated artifact missing entirely: $f"
  if [ "$(tail -1 "$f")" != "$marker" ]; then
    abort "generated artifact is TRUNCATED: $f" \
          "Expected last line: $marker" \
          "Actual last line:   $(tail -1 "$f")" \
          "" \
          "The script did not reach its own end. Exit code and input guards" \
          "cannot detect this -- a half-written file reads as merely short." \
          "Do not use this diff. Most likely cause: a command returning" \
          "non-zero under 'set -e' mid-write (see the header note)."
  fi
}

check_end_marker "$CAPTURE_DIR/diff_vs_core.txt" "END-OF-DIFF -- if this line is missing the file was truncated"
check_end_marker "$CAPTURE_DIR/exclusion_manifest.txt" "END-OF-MANIFEST -- if this line is missing the file was truncated"
check_end_marker "$CAPTURE_DIR/toggle_state.txt" "END-OF-TOGGLE-STATE -- if this line is missing the file was truncated"

echo ""
echo "=== Exclusion manifest + diff ==="
echo "  $CAPTURE_DIR/exclusion_manifest.txt   ($ROSTER_N roster files)"
echo "  $CAPTURE_DIR/toggle_state.txt"
echo "  $CAPTURE_DIR/diff_vs_core.txt"
echo ""
sed -n '/READING AID/,/^RAW --/p' "$CAPTURE_DIR/diff_vs_core.txt" | head -40
