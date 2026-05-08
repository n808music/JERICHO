# Freeze Gate Summary 1.0.6.3

Date: March 9, 2026  
Branch: `proof-1.0.6`

## Release-Readiness Contract

This document defines the freeze gates for the post-canonical P.O.S. baseline.  
Default decision rule: freeze-candidate only if all 5 live gates pass and
targeted automated tests are green.

## Targeted Automated Evidence (Recorded)

Exact command:

```bash
npm run test -- tests/state/cycleSelectors.canonicalPrecedence.test.js tests/state/schedule.generate.actionsCanonicalPrecedence.test.js tests/state/applyDraftSchedule.canonicalSource.test.js tests/state/scheduling.chain.minimalFixture.test.js tests/state/scoring.pos.canonicalChain.test.js tests/components/ZionDashboard.pos.postcondition.test.jsx
```

Exact result tail:

```txt
Test Files  6 passed (6)
Tests  18 passed (18)
Duration  2.94s
```

Key trace excerpt:

```txt
JERICHO_GENERATE_TRACE
  cycleId: 'cycle-fixture-1'
  proposedBlocksCount: 2
  firstThreeProposedBlocks:
    dayKey: '2026-03-02'
    dayKey: '2026-03-20'
  lastPlanErrorCode: null
```

## Gate Results

| Gate                                                      | Hard Criterion                                                                                 | Automated Evidence                                                                                                        | Manual Live Scenario                                                                                                      | Result                            |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------- |
| 1. Full-horizon action-linked generation                  | Supported execution type generates concrete action-linked blocks through full contract horizon | `tests/state/scheduling.chain.minimalFixture.test.js`, `tests/state/schedule.generate.actionsCanonicalPrecedence.test.js` | Use admitted goal with end date >14 days from start, click Generate, verify future-dated action-linked blocks past day 14 | `AUTOMATED_PASS / MANUAL_PENDING` |
| 2. Single apply commits full proposal scope               | One apply commits intended full proposed scope (not day slice)                                 | `tests/state/applyDraftSchedule.canonicalSource.test.js`, `tests/state/scheduling.chain.minimalFixture.test.js`           | Generate multi-day proposals, click Apply once, verify all proposed IDs appear as committed execution events              | `AUTOMATED_PASS / MANUAL_PENDING` |
| 3. Stability shows numeric P.O.S. or deterministic reason | Stability never degrades to meaningless placeholder; returns value or explicit reason code     | `tests/state/scoring.pos.canonicalChain.test.js`, `tests/components/ZionDashboard.pos.postcondition.test.jsx`             | Open Stability after generation; verify either numeric P.O.S. or explicit `POS_*` unavailable reason                      | `AUTOMATED_PASS / MANUAL_PENDING` |
| 4. Day/Week/Month committed-source consistency            | Same committed block identity across all three views                                           | `tests/state/scheduling.chain.minimalFixture.test.js` (committed materialization + month projection from same source)     | Commit one known block ID, verify Day/Week/Month each render that same committed ID/time                                  | `AUTOMATED_PASS / MANUAL_PENDING` |
| 5. No mirror-first critical behavior                      | Critical surfaces must prefer canonical when canonical is populated                            | `tests/state/cycleSelectors.canonicalPrecedence.test.js` + mirror warning scan                                            | In dev build, exercise generate/apply/stability and confirm no `contract-mirror-read`/`proposed-mirror-read` warnings     | `AUTOMATED_PASS / MANUAL_PENDING` |

## Manual Live Scenarios (Runbook + Evidence Slots)

### Gate 1 Live Scenario

- Setup:
  - Admitted active cycle
  - Contract window at least 30 days
  - Canonical actions populated
- User actions:
  - Open Structure/Today flow
  - Trigger Generate once
- Expected observed:
  - Proposed list includes action-linked titles/IDs
  - At least one proposal day beyond +14 days
- Evidence links:
  - Screenshot: `TODO_LOCAL_SCREENSHOT_GATE1`
  - Console/log: `TODO_LOCAL_LOG_GATE1`
- Status: `PENDING_INTERACTIVE_RUN`

### Gate 2 Live Scenario

- Setup:
  - Multi-day proposed schedule present
- User actions:
  - Click Apply once
- Expected observed:
  - All proposal IDs become committed creates (not just active day)
- Evidence links:
  - Screenshot: `TODO_LOCAL_SCREENSHOT_GATE2`
  - Console/log: `TODO_LOCAL_LOG_GATE2`
- Status: `PENDING_INTERACTIVE_RUN`

### Gate 3 Live Scenario

- Setup:
  - Admitted goal; one run with sufficient basis and one without basis
- User actions:
  - Open Stability tab
- Expected observed:
  - Case A: numeric P.O.S.
  - Case B: deterministic unavailable reason code surfaced
- Evidence links:
  - Screenshot: `TODO_LOCAL_SCREENSHOT_GATE3`
  - Console/log: `TODO_LOCAL_LOG_GATE3`
- Status: `PENDING_INTERACTIVE_RUN`

### Gate 4 Live Scenario

- Setup:
  - One committed block with known ID/time
- User actions:
  - Open Day, Week, Month views
- Expected observed:
  - Same committed block ID/time visible in each view from same committed source
- Evidence links:
  - Screenshot: `TODO_LOCAL_SCREENSHOT_GATE4`
  - Console/log: `TODO_LOCAL_LOG_GATE4`
- Status: `PENDING_INTERACTIVE_RUN`

### Gate 5 Live Scenario

- Setup:
  - Dev/test mode with warning logs visible
- User actions:
  - Exercise generate/apply/stability paths with canonical + mirrors populated
- Expected observed:
  - Allowed: `*-mirror-present`, `*-mirror-drift`
  - Not allowed: `contract-mirror-read`, `proposed-mirror-read` on critical
    paths
- Evidence links:
  - Screenshot: `TODO_LOCAL_SCREENSHOT_GATE5`
  - Console/log: `TODO_LOCAL_LOG_GATE5`
- Status: `PENDING_INTERACTIVE_RUN`

## Mirror-Usage Scan (Dev/Test)

Scan command:

```bash
rg -n "contract-mirror-read|proposed-mirror-read" /tmp/freeze_candidate_targeted_tests.log
```

Observed:

```txt
no matches
```

Observed warnings in targeted run were adapter presence/drift visibility
(`contract-mirror-present`, `contract-adapter-present`,
`actions-mirror-present`, `proposed-mirror-present`, `actions-mirror-drift`),
not mirror-read fallback winners.

## Known Non-Blocking Defects

- Onboarding vs Structure UI clarity (flow communication and labeling
  consistency).
- Execution-type coverage completeness across full supported finite set.
- Dropdown / unit taxonomy cleanup.
- Repo-wide lint debt (pre-existing `curly` and related issues).
- Residual adapter mirrors retained for compatibility; removal is a later
  tranche.

## Freeze Decision (Current)

- Automated status: `PASS`
- Manual live gate status: `PENDING_INTERACTIVE_RUN`
- Freeze-candidate decision today: `CONDITIONAL` (promote to `PASS` after manual
  gate evidence is attached in this document).
