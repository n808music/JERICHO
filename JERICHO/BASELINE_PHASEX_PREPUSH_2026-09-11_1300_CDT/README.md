# PREPUSH capture — read this before citing any number from it

Frozen tree, four commits on `phasex-completion-stated-in-gate`. Both runs
collected **4639**, so the two runs executed the same set — which the preceding
GATE_STORAGE capture could not claim.

| | run 1 | run 2 |
|---|---|---|
| failed / passed / skipped | 169 / 4463 / 7 | 171 / 4461 / 7 |
| total | 4639 | 4639 |
| failing files | 61 | 63 |

Named diff vs the core (`BASELINE_PHASE0_2026-09-10_1616_CDT/run2_files.txt`):

- **run 1** — `+ phaseX.completionStatedIn.mutations` / `− fullHorizon.computeMemo`
- **run 2** — the same, plus `+ workWindows.advisoryConstraints.saveAndPersist`
  and `+ perf.revalidation.lock`

## ⚠ 171 appears on both sides of this fix and means different things

`BASELINE_PHASEX_2026-09-10_2255` and `..._2312` both read **171 failed across 61
files**. This capture's run 2 reads **171 failed across 63 files**. Same integer,
different sets.

A reader scanning for movement will see 171 → 171 and conclude nothing happened.
That is wrong, and it is the same shape that voided earlier baseline history in
this repo. **Compare the file SET, never the count.** The sets are in
`run{1,2}_files.txt` and the logs they were derived from are committed alongside.

## Test-count accounting

4637 (GATE_STORAGE) → 4639 here, from exactly two added tests:

- `8b70f4d` — `persists completion_stated_in so the condition is readable`
- `4ed453d` — `persists terminal_date on every Project`

The second is **not** a `targetDate` assertion. A `targetDate` version was
written first and retracted: 0 of 59 Project rows carry a `target_date` key at
all (Projects carry `terminal_date`; only Deliverable (63) and Artifact (188)
rows carry `target_date`). Its own vacuous-pass guard caught that. Do not
reintroduce the `targetDate` form.

## Known-red in this capture

The 4 `rejects ...` tests in `phaseX.completionStatedIn.mutations` assert the
root error code, but `lastPlanError` is a scalar with last-write-wins, so the
load returns the seventh cascade symptom instead. Measured across the suite: 122
error sequences in 29 files have first ≠ last. Fixed by `planErrors`, tracked
separately. These are expected red here.

## Flake roster — five files, so any anchor from this suite is a RANGE

| file | mechanism |
|---|---|
| `fullHorizon.computeMemo` | wall-clock threshold |
| `MasterPlanTimeline.render` | reporter RPC timeout |
| `AppShell.onboardingToGoalAdmission.flow` | live-failing ↔ collection-dead |
| `perf.revalidation.lock` | wall-clock (`84667` vs `75000` bound) |
| `workWindows.advisoryConstraints.saveAndPersist` | load-sensitive |

`AppShell` is the dangerous one: toggling between live-failing and
collection-dead moves the file count and the test total in **opposite directions
at once**. It did not toggle in this capture, so these numbers sit on the stable
side. It did toggle in GATE_STORAGE, which is why that capture's two runs
disagree on total (4637 vs 4635).

The last two were first observations — absent from all 12 prior run-lists — so
they were established as flakes by isolated re-runs (3/3 green each) and a named
mechanism, not by appeal to history.

At five files, with at least two wall-clock or RPC-timing dependent on a suite
with documented 300s hangs and multi-minute runs, this is an environment
property rather than a set of incidents. Anything measured against this suite
can move ±2 files on its own.
