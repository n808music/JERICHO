# Architecture Notes

The stability of this workspace now hinges on its single source-of-truth execution log; see `docs/execution-events.md` for the full schema/invariant spec (see tag `vitest-green-cycle-isolation`). All projections (`today`, `currentWeek`, summaries) are recomputed from `executionEvents`, which keeps the state machine deterministic and audit-ready.
