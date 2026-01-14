UI Reduction List — Conservative Pass for Freeze Certification

KEEP (required for three gates)

- `src/components/zion/Workspace.jsx` -> Workspace component (Goal intake, Structure) -> Structure / Goal Intake -> REQUIRED: forms goal intake and structure, used by freeze tests. -> Action: KEEP
- `src/components/zion/PlanningPanel.jsx` -> PlanningPanel -> Scheduling / Execution -> REQUIRED: manual block creation and planning surfaces. -> Action: KEEP
- `src/components/zion/AddBlockBar.jsx` -> AddBlockBar -> Scheduling / Execution -> REQUIRED for manual add in tests. -> Action: KEEP
- `src/components/zion/DaySchedulePanel.jsx` -> DaySchedulePanel -> Scheduling / Execution -> REQUIRED for calendar/day view. -> Action: KEEP
- `src/components/zion/MonthMatrix.jsx` -> MonthMatrix -> Scheduling / Execution -> REQUIRED for calendar month grid rendering. -> Action: KEEP
- `src/components/zion/BlockDetailsPanel.jsx` -> BlockDetailsPanel -> Scheduling / Execution -> REQUIRED to inspect blocks. -> Action: KEEP
- `src/components/ZionDashboard.jsx` -> Dashboard container -> Routes the three gate tabs (Structure / Today / Stability) -> REQUIRED. -> Action: KEEP
- `src/components/IdentityHeader.jsx` -> IdentityHeader -> Stability / Proof header metrics -> REQUIRED. -> Action: KEEP

HIDE (non-essential for freeze tests; hide behind `REDUCE_UI` flag)

- `src/components/zion/AssistantPanel.jsx` -> Assistant overlay / assistant chat -> None (auxiliary) -> Not required for freeze tests; may rely on external services. -> Action: HIDE (wrapped with `REDUCE_UI`)
- `src/components/DiagnosticsPanel.jsx` -> Diagnostics / runtime metrics -> None -> Action: HIDE
- `src/components/DisciplineDashboard.jsx` -> DisciplineDashboard / streaks -> None -> Action: HIDE
- `src/components/OrbPanel.jsx` -> OrbPanel / quick actions -> None -> Action: HIDE
- `src/components/TaskStreamPanel.jsx` -> Task stream / backlog -> None -> Action: HIDE
- `src/components/TimelinePanel.jsx` -> Timeline / trajectory visuals -> None -> Action: HIDE
- `src/components/debug/*` -> Debug overlays (UiWiringOverlay, DebugProvenance) -> None -> Action: HIDE
- `src/components/zion/AssistantPanel.jsx` -> Assistant -> None -> Action: HIDE
- `src/components/zion/NextBestMoveCard.jsx` -> Suggestion cards -> None (auxiliary) -> Action: HIDE
- `src/components/zion/IntegrityDial.jsx` -> Dial / fancy metric -> None -> Action: HIDE

Rationale

- The three freeze gates (Structure/Goal Intake, Scheduling/Execution, Stability/Proof) require a minimal set of UI panels to allow manual and auto scheduling flows to be exercised and validated. Everything else (assistants, dashboards, analytics, overlays) is optional for deterministic state-level certification and may introduce noise or dependency on external services.

Feature-flag behavior

- A single flag `REDUCE_UI` (exported from `src/ui/reduceUIConfig.js`) controls hiding. Set `VITE_REDUCE_UI=1` in the environment to enable the reduced UI.

Batch A (applied)

The following HIDE candidates were wrapped in code behind `REDUCE_UI` during Batch A (passive overlays and assistant):

- `src/components/zion/AssistantPanel.jsx` -> Assistant overlay (wrapped in `ZionDashboard.jsx`): Assistant button and panel now rendered only when `!REDUCE_UI`.
- `src/components/debug/UiWiringOverlay.jsx` -> UI wiring overlay (wrapped in `AppShell.jsx`): overlay now rendered only when `!REDUCE_UI`.

Test verification after Batch A

- Ran: `CI=1 npx vitest run src/state/tests/freeze_*.test.js --reporter=verbose --testTimeout=30000`
- Result: All three freeze tests passed (3/3).

Batch B (applied)

Batch B targeted advisory dashboards/cards and auxiliary panels. During code inspection none of the Batch B candidates were directly rendered by the current UI entrypoints, so there were no render sites to wrap. The candidates examined included:

- `src/components/DisciplineDashboard.jsx`
- `src/components/DiagnosticsPanel.jsx`
- `src/components/OrbPanel.jsx`
- `src/components/TaskStreamPanel.jsx`
- `src/components/TimelinePanel.jsx`
- `src/components/zion/NextBestMoveCard.jsx`
- `src/components/zion/IntegrityDial.jsx`

Action taken: No runtime render sites detected; no code changes required for Batch B. These components remain in the codebase and can be wrapped later if/when they are added to rendering trees.

Test verification after Batch B

- Ran: `CI=1 npx vitest run src/state/tests/freeze_*.test.js --reporter=verbose --testTimeout=30000`
- Result: All three freeze tests passed (3/3).

Notes

- Batch B was therefore non-invasive. Proceed to Batch C to consider analytics and other auxiliary panels, following the same wrap-and-test approach.

Notes

- This is a conservative first pass. If any hidden component is needed to debug failing tests, unhide by setting the flag off.
- No code is deleted; components are only hidden where they are rendered.
