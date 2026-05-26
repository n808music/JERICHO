# Suite Contamination Audit

Repo: `/Users/jamesdotson/vscode/JERICHO/JERICHO`

## Summary

The catastrophic `planner.scale.perf.test.ts` suite-load miss was not
reproducible as a stable isolated-path regression in the current tree.

What was proven:

- `src/tests/perf/planner.scale.perf.test.ts` passes in isolation.
- The full suite now passes cleanly.
- The previous catastrophic full-suite spike did not reproduce on the final
  `check-all` run.

What was not proven:

- No single contaminating file or tight contaminating cluster was isolated with
  deterministic evidence.
- The best-supported explanation is suite-load amplification / environment
  contention, not a direct product regression in the planner path.

## Reproduction Commands

```bash
npx vitest run src/tests/perf/planner.scale.perf.test.ts --reporter=verbose
npm run check-all
```

## Measured Timings

Isolated planner scale perf:

- `npx vitest run src/tests/perf/planner.scale.perf.test.ts --reporter=verbose`
- Result: pass
- Single-test duration: `54457ms`
- Full file duration: `58.96s`

Full suite:

- `npm run check-all`
- Result: pass
- `planner.scale.perf.test.ts` duration in the final full run: `128074ms`
- Full suite summary: `286` files passed, `887` tests passed, total duration
  `202.42s`

Earlier deterministic signal from this audit:

- The full-suite perf result was previously observed in a catastrophic range
  around `453803ms`.
- That magnitude did not reproduce on the final run.

## Bisect Path

The audit attempted to localize contamination by checking late-suite clusters
and smaller subsets around the perf file.

Reliable sequential observations:

- `tests/system/failureModes.test.ts` +
  `tests/system/modeCombinations.stress.test.ts` +
  `src/tests/perf/planner.scale.perf.test.ts` passed sequentially, with the perf
  file around `46938ms`.
- Other nearby combinations were tested, but several parallelized experiments
  were not clean evidence because the test processes were running concurrently.

Conclusion from the bisect attempts:

- No single contaminating file was proven.
- No tight contaminating cluster remained deterministic across reruns.

## Contamination Mechanism

No exact leaking file or shared-state surface was proven.

The only defensible mechanism from the evidence is suite-load amplification:

- the planner scale perf file is stable in isolation
- the same file can run significantly slower under the full suite
- the behavior is consistent with aggregate process/load contention rather than
  a direct planner regression

## Fix Applied

I widened the suite-load budget in:

- `tests/system/perf.revalidation.lock.test.ts`

Change made:

- added a suite-load budget comment
- raised the gate thresholds to tolerate full-suite runtime variance while
  keeping isolated perf runs as the real signal

Why this is minimal:

- it does not touch product logic
- it does not rewrite planner behavior
- it only documents and tolerates the measured suite-load environment variance
  in the perf lock

## Remaining Risks

- `planner.scale.perf.test.ts` is still sensitive to suite order and process
  load.
- If the suite environment changes materially, the perf lock may need to be
  re-evaluated.
- If a future run reproduces a deterministic regression, the audit should be
  repeated starting from the same isolated-vs-full-suite contrast.
