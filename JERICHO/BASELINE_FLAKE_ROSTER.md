# Baseline flake roster — evidence

Derived 2026-09-11 from the seven capture directories on `baseline/phasex-record`,
by re-deriving membership from the committed run logs and derived lists. Nothing
here is carried over from a prior session's notes; where a prior note and the
artifacts disagree, the artifacts win and the disagreement is recorded.

Machine-readable form: `BASELINE_FLAKE_ROSTER.tsv`. Consumer: `BASELINE_DIFF.sh`.

## Method

The only measurement that isolates nondeterminism from code change is the
**within-capture** comparison: run 1 vs run 2 of the same capture, same commit,
same frozen tree. Cross-capture differences confound flakes with real movement
and are not used to admit a file to the roster.

Two derived lists per run already exist in every capture
(`runN_files.txt` = all failing files, `runN_dead_files.txt` = the subset whose
FAIL line carries the bracket form, `runN_live_files.txt` = the complement), so
membership is a set operation over committed artifacts, not a fresh grep.

## Presence matrix

Per capture, per run: `L` live-failing, `D` collection-dead, `.` not in the
failing set. Columns are the seven captures in chronological order.

```
FILE                                          09-09  09-10  X2205  X2255  X2312  GATE   PREPUSH
                                              _1157  _1616
fullHorizon.computeMemo.test.js               L.     .L     .L     ..     L.     ..     ..
workWindows.advisoryConstraints.saveAndPersist ..    ..     ..     ..     ..     ..     .L
perf.revalidation.lock.test.ts                ..     ..     ..     ..     ..     ..     .L
AppShell.onboardingToGoalAdmission.flow       LL     LL     LL     LL     LL     LD     LL
MasterPlanTimeline.render.test.jsx            LL     LL     LL     LL     LL     LL     LL
```

Four files change membership within at least one capture. The fifth,
`MasterPlanTimeline.render.test.jsx`, does **not** — it is live-failing in all
14 runs. It is on the roster for a different reason, under kind `ERROR_BUCKET`;
see below.

---

## 1. `tests/state/fullHorizon.computeMemo.test.js` — FILE_SET

Appeared in exactly one of the two runs in four of seven captures
(09-09 run1, 09-10 run2, X2205 run2, X2312 run1); absent from both runs in the
other three. A wall-clock threshold.

`BASELINE_PHASE0_2026-09-09_1157_CDT/run1_full.log:67146`

```
 FAIL  tests/state/fullHorizon.computeMemo.test.js > full-horizon derivation is memoized at enterprise scale > recomputes derived state well under the freeze threshold for an unrelated mutation
AssertionError: expected 306.5447742000004 to be less than 300
 ❯ tests/state/fullHorizon.computeMemo.test.js:31:21
     29|     // Pre-fix this is ~900ms. Post-fix (memo hit + clone) is a few te…
     30|     // 300ms is a generous ceiling that still catches the regression o…
     31|     expect(perCall).toBeLessThan(300);
       |                     ^
```

Same file, same capture, run 2 — passing, same order of magnitude of file
duration (`run1_full.log:62960` reports 65697ms for the file; the 09-09 record
notes run2 at 64245ms):

```
 ✓ tests/state/fullHorizon.computeMemo.test.js  (2 tests) 64245ms
```

The margin is 6.5ms over a 300ms bound. Mechanism: **wall-clock bound exceeded.**

---

## 2. `tests/components/workWindows.advisoryConstraints.saveAndPersist.test.jsx` — FILE_SET

First and only appearance: PREPUSH run 2. Absent from both runs of the other
six captures.

`BASELINE_PHASEX_PREPUSH_2026-09-11_1300_CDT/run2_full.log:67111`

```
 FAIL  tests/components/workWindows.advisoryConstraints.saveAndPersist.test.jsx > work windows advisory constraints save > saves edited windows to cycle state through UPDATE_WORK_WINDOWS dispatch
Error: Test timed out in 5000ms.
If this is a long-running test, pass a timeout value as the last argument or configure it globally with "testTimeout".
```

Same capture, run 1 — `run1_full.log:59376`:

```
 ✓ tests/components/workWindows.advisoryConstraints.saveAndPersist.test.jsx  (1 test) 874ms
```

874ms against a 5000ms ceiling in one run, over the ceiling in the other.
Mechanism: **per-test timeout under suite load.**

---

## 3. `tests/system/perf.revalidation.lock.test.ts` — FILE_SET

First and only appearance: PREPUSH run 2.

`BASELINE_PHASEX_PREPUSH_2026-09-11_1300_CDT/run2_full.log:67116`

```
 FAIL  tests/system/perf.revalidation.lock.test.ts > phase2 perf revalidation lock > remains within conservative runtime bounds with optimizer on
AssertionError: expected 84667 to be less than 75000
 ❯ tests/system/perf.revalidation.lock.test.ts:47:42
     45|     // as an environment-contended measurement rather than a clean iso…
     46|     // isolated signal in focused perf runs and allow broader suite-lo…
     47|     expect(result.perf.rebuildPreviewMs).toBeLessThan(75000);
       |                                          ^
```

Same capture, run 1 — `run1_full.log:61985`:

```
 ✓ tests/system/perf.revalidation.lock.test.ts  (1 test) 20750ms
```

20750ms vs 84667ms against a 75000ms bound — a 4× spread between two runs of
the same tree. Mechanism: **wall-clock bound exceeded under contention**, which
the test's own comment already anticipates.

---

## 4. `tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx` — STATE_TOGGLE

This is the one that makes a capture unreadable, and it is the reason for the
separate handling in §2 of the task.

In the GATE_STORAGE capture it is live-failing in run 1 and collection-dead in
run 2. The failing-FILE set is **identical** across the two runs — so the
existing comparator wrote an empty `flaky_files.txt` and the record says nothing
was flaky, while two failing tests silently left the run.

Run 1, live-failing — `run1_full.log:64033` and `:62076`:

```
 FAIL  tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx > AppShell structure entry without an active cycle > lands in the review-mode Structure shell and offers starting a new cycle
TestingLibraryElementError: Unable to find role="button" and name `/Create profile/i`
```

```
 ❯ tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx  (2 tests | 2 failed) 2163ms
```

Run 2, collection-dead — `run2_full.log:62523-62527`, verbatim:

```
⎯⎯⎯⎯⎯⎯ Failed Suites 3 ⎯⎯⎯⎯⎯⎯⎯

 FAIL  tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx [ tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx ]
Error: [vitest-worker]: Timeout calling "fetch" with "["/src/ui/masterPlan/TimelineGrid.jsx","web"]"
⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯⎯[1/170]⎯
```

and its per-file summary line, `run2_full.log:61948`:

```
 ❯ tests/components/AppShell.onboardingToGoalAdmission.flow.test.jsx  (0 test)
```

Mechanism: **worker loses the file association** — the RPC `fetch` for a module
the test transitively imports times out, so the file never collects.

### Why the toggle moves counts in opposite directions

Measured, from the two runs' own summary lines:

| | run 1 | run 2 | delta |
|---|---|---|---|
| collected tests | 4637 | 4635 | **−2** |
| failing tests | 169 | 167 | **−2** |
| failing files | 61 | 61 | **0** |
| Failed Suites banner | 2 | 3 | **+1** |
| live-failing / collection-dead | 59 / 2 | 58 / 3 | −1 / +1 |

The file has exactly 2 tests (`(2 tests | 2 failed)` above). When it goes
collection-dead those 2 tests are never collected, so the *collected* total and
the *failing-test* total both drop by 2 while the failing-FILE count does not
move at all. A reader comparing test counts sees a 2-test improvement; a reader
comparing file sets sees nothing; neither sees the truth. Hence: the state is
recorded as an explicit field, not inferred.

### Detecting collection-dead

vitest prints a failing *suite* — a file that did not collect — as a FAIL line
whose path is repeated in a bracket, on the same line:

```
 FAIL  <path> [ <path> ]
```

versus a live-failing test, where the path is followed by ` > ` and the test name:

```
 FAIL  <path> > <suite> > <test name>
```

The existing capture script already keys on exactly this (`BASELINE_PHASEX_CAPTURE.sh:47`,
pattern `${FAIL_RE} +\[`), and the bracket form is confirmed present for every
member of every `runN_dead_files.txt` in the GATE_STORAGE capture — 1 matching
line each, for all 5 file/run pairs. So the three states are each detected
**positively**, never by absence:

| state | positive signal |
|---|---|
| `collection-dead` | membership in `runN_dead_files.txt` (bracket-form FAIL line) |
| `live-failing` | membership in `runN_live_files.txt` (` > `-form FAIL line) |
| `passing` | a ` ✓ <path>  (N test…)` line in the run log |
| — | none of the above ⇒ **abort**, state indeterminate |

The fourth row is the guard. Absence from the failing lists is not evidence of
passing: it is equally consistent with the file not having run at all.

---

## 5. `tests/components/MasterPlanTimeline.render.test.jsx` — ERROR_BUCKET

Live-failing in all 14 runs across all 7 captures. It never moves the file set,
so it is not a FILE_SET flake — but it intermittently emits unhandled rejections
that cost the run its accounting, which is what the roster has to warn a reader
about.

Origin-attributed unhandled errors, counted per run:

```
09-09_1157   run1: 3   run2: 0
09-10_1616   run1: 2   run2: 0
X2205        run1: 2   run2: 0
X2255        run1: 3   run2: 0
X2312        run1: 2   run2: 0
GATE_STORAGE run1: 0   run2: 0
PREPUSH      run1: 0   run2: 0
```

`BASELINE_PHASE0_2026-09-09_1157_CDT/run1_full.log:68698-68712`:

```
⎯⎯⎯⎯⎯⎯ Unhandled Errors ⎯⎯⎯⎯⎯⎯

Vitest caught 4 unhandled errors during the test run.
This might cause false positive tests. Resolve unhandled errors to make sure your tests are not affected.

⎯⎯⎯⎯ Unhandled Rejection ⎯⎯⎯⎯⎯
Error: [vitest-worker]: Timeout calling "onTaskUpdate"
 ❯ Object.onTimeoutError node_modules/vitest/dist/vendor/rpc.joBhAkyK.js:61:15
 ❯ Timeout._onTimeout node_modules/vitest/dist/vendor/index.8bPxjt7g.js:39:41
 ❯ listOnTimeout node:internal/timers:605:17
 ❯ processTimers node:internal/timers:541:7

This error originated in "tests/components/MasterPlanTimeline.render.test.jsx" test file. It doesn't mean the error was thrown inside the file itself, but while it was running.
The latest test that might've caused the error is "does not show Unassigned label for full-horizon blocks that have lane assignments". It might mean one of the following:
```

Consequence, from the 09-09 capture: run 1 printed `Test Files 60 failed` while
its own anchored FAIL lines yield 61 — the reporter lost the classification for
this file. Mechanism: **reporter/worker RPC timeout (`onTaskUpdate`)**.

Note the Errors bucket is a count of unhandled error *events*, not of lost
tests. 09-09 run 1 shows 4 errors while failed+passed+skipped (4624) is 3 short
of the printed total (4627).

### Consequence for the 60-file anchor

This reclassification changes how the 09-09 anchor should be read, and the
change is worth stating plainly because it cuts the other way from the rest of
this document.

The anchor was recorded as "60 core + 1 named flake", where the named flake is
`fullHorizon.computeMemo` and the 60-vs-61 discrepancy in run 1 was attributed
to the run being incomplete. That attribution is correct, but it is not
nondeterminism in the *suite*. It is this file's reporter timing out.

So the anchor has **a known mechanism for reading 60 or 61 that is not a flake
in the set-membership sense**: `MasterPlanTimeline.render.test.jsx` is failing
in both cases, and the only thing that varies is whether the reporter managed
to classify it before the RPC gave up. The file is in `run1_files.txt` and
`run2_files.txt` both times — the derived lists were right and the printed
banner was wrong.

Practical rule: when a capture's `Test Files N failed` banner disagrees with
the count of anchored FAIL lines, check this file's Errors-bucket count before
reaching for any other explanation. A banner/derived-list disagreement of
exactly one, with a non-zero Errors count, is this and not a set change.

This is a reporting defect with its own handling, not a flake to be subtracted.
It stays on the roster because the thing it perturbs is real, under a kind that
says it never moves the set.

---

## What is not on the roster, and why

`tests/domain/elicitation/projectSlot.requiresLegalFormation.unit.test.js` and
`tests/state/masterPlanFullHorizon.expression.test.js` are collection-dead in
**all 14 runs**, both states stable. They are part of the core set, not flakes.
Their failures are deterministic: an unresolved import and a `gate.detect` on
undefined, respectively (`GATE_STORAGE/run2_full.log:62529`, `:62541`).

## The roster is a lower bound

A file is admitted only by being observed to move **within** a capture. That is
the right admission rule — it is the only comparison that separates
nondeterminism from code change — but it has a blind spot it cannot see past:
it can only catch a file that flaked during a two-run capture. A file that
flakes rarely enough not to have surfaced in fourteen runs is, on this
evidence, indistinguishable from a stable one.

Two of the five current members are proof of the rate: `workWindows` and
`perf.revalidation.lock` were **first observations** in the PREPUSH capture,
absent from all twelve prior runs. On that base rate a sixth is likely, not
hypothetical.

So a first-time appearance is reported MOVEMENT. That is the correct default —
treat it as real until an isolated re-run and a named mechanism say otherwise,
which is exactly how those two were established (3/3 green isolated, plus a
cause). But it should not arrive as a surprise, which is why
`BASELINE_DIFF.sh` prints this caveat above every KNOWN FLAKE listing rather
than leaving it in this file.

Novelty is not evidence of culpability, and it is not evidence of innocence
either.

## A note on grepping these logs

`grep` treats `run1_full.log` / `run2_full.log` as binary and suppresses
matching output entirely unless given `-a`. It returns an empty result — not an
error — which reads exactly like absence. Measured during this work: a pattern
that `sed` located in one of these logs came back empty from `grep` on the same
file, three probes in a row.

Every grep in `BASELINE_DIFF.sh` and `BASELINE_PHASEX_CAPTURE.sh` carries `-a`.
Hand-greps do not, unless you remember. This is the pattern-match trap in its
least visible form: the standing rule is that a match establishes presence and
never absence, and this is the case where the *null* is the lie.

## Mechanisms not established

None. All five roster rows have a mechanism visible in at least one committed
log, pasted above. No mechanism on this roster was supplied by inference.
