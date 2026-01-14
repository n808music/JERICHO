# Jericho Certification Artifacts

This directory is populated only when the certification runner is executed with artifacts enabled.

## Run without writing artifacts (default)
```
CI=1 npx vitest run src/state/tests/certification_runner.artifacts.test.js --no-threads --reporter=verbose --testTimeout=30000
```

## Run with artifact writing
```
JERICHO_WRITE_ARTIFACTS=1 CI=1 npx vitest run src/state/tests/certification_runner.artifacts.test.js --no-threads --reporter=verbose --testTimeout=30000
```

## Outputs
- `planProof.json` — plan proof object + terminal plan definition (`P_end`).
- `proposedSchedule.json` — proposed schedule summary (count + day range).
- `committedSchedule.json` — committed block snapshot (id/dayKey/start/duration/linkage).
- `executionEvents.json` — stable-sorted execution event log.
- `cycleSummary.json` — cycle summary including convergence report (if present).
- `certificationMeta.json` — metadata (cycleId, fixed nowISO/dayKey).
