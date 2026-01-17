# Cycle UX Audit

## State Machine
1. **Active** (default when a cycle starts). Slots: `identityCompute` stores `cyclesById[cycleId].status === 'active'` and `activeCycleId` referencing it. UI surfaces allow creating, updating, and deleting blocks.
2. **Ended** (after `END_CYCLE`). The cycle transitions to a read-only review mode; `activeCycleId` becomes `null`, `today.blocks` is cleared, and the UI can only launch archive/delete flows.
3. **Review** (triggered via `ARCHIVE_AND_CLONE_CYCLE`). The prior cycle remains for reporting with status `'review'`, but the active cycle switches to a fresh clone.
4. **Archived/Deleted** (`DELETE_CYCLE`, `HARD_DELETE_CYCLE`). The cycle disappears from active selectors and any associated learning contributions/logs is pruned.

## Allowed Actions Per State
| State | Allowed actions | UI triggers |
| --- | --- | --- |
| Active | `CREATE_BLOCK`, `UPDATE_BLOCK`, `DELETE_BLOCK`, `END_CYCLE`, `ARCHIVE_AND_CLONE_CYCLE`, `DELETE_CYCLE` | `ZionDashboard` uses `deleteCycle`, `archiveAndCloneCycle`; `identityStore` hooks dispatch actions. |
| Ended | `START_NEW_CYCLE` only, review analytics stay read-only | `StructurePageConsolidated` surfaces review copy, `reviewMode` gating prevents writes. |
| Review | `START_NEW_CYCLE`, `DELETE_CYCLE` (for final cleanup) | `StructurePageConsolidated` UI becomes read-only, prompts to archive or delete. |
| Archived/Deleted | No UI interactions except history views | Cycle list filtered by `selectActiveCycle`/`projectCyclesIndex`. |

## Expected UI Behavior
- **Review mode** (see `StructurePageConsolidated.jsx`, `ZionDashboard.jsx`) should be read-only: no `Add Block` controls, no write actions triggered. The component toggles `cycleMode` via `activeCycle?.status === 'active' ? 'active' : 'review'`.
- **Archive** hides the cycle from selectors (`projectCyclesIndex`/`cycleIndex` in `src/state/engine/cycleIndex.ts`). Archived cycles still appear in `StructurePageConsolidated` with read-only messaging.
- **Delete** removes the cycle from every store, clears `today.blocks`, and resets `activeCycleId`. Hooks in `src/state/identityStore.js` (`deleteCycle`, `deleteBlock`, etc.) dispatch the necessary actions.
- **Review gating** is enforced by `components/__tests__/reviewMode.gating.test.jsx` and by the UI text in `Workspace.jsx`.

## Code Audit Points
| Concern | Location | Notes |
| --- | --- | --- |
| Reducer actions | `src/state/identityCompute.js` (`END_CYCLE`, `ARCHIVE_AND_CLONE_CYCLE`, `DELETE_CYCLE`, `HARD_DELETE_CYCLE`) | Manage event log, `today` cleanup, `cyclesById` mutations.
| UI dispatchers | `src/state/identityStore.js` | Hooks expose `endCycle`, `archiveAndCloneCycle`, `deleteCycle`, `deleteBlock`, `deleteDeliverable`, `deleteCriterion` used across `ZionDashboard`, `StructurePageConsolidated`, `Workspace`.
| Selectors | `src/state/engine/cycleIndex.ts`, `projectCyclesIndex` | Filtering ensures archived/deleted cycles drop from active pickers.
| UI components | `src/components/ZionDashboard.jsx`, `StructurePageConsolidated.jsx`, `Workspace.jsx`, `DaySchedulePanel.jsx` | Control visibility, enforce read-only review messaging, and show archive/delete banners.
| Guidance/criteria gating | `src/contracts/uiAuthorityMap.ts` | Declares `acceptedBlocks.delete`, `identityStore:deleteDeliverable`, etc., enforced by compute pipeline.

## Review Observations
- `StructurePageConsolidated.jsx` prompts users to archive before editing a past cycle and confirms `archiveAndCloneCycle?.(activeCycleId)`.
- `deleteCycle` is double-used for both UI deletion and the `DELETE_CYCLE` action; the reducer path already clears `today` and resets projections.
- `ZionDashboard` surfaces `deleteCycle`/`deleteBlock` controls only when `cycleMode === 'active'`, aligning with review-mode expectations.

This audit validates that the UX flow is consistent with the cycle invariants documented elsewhere in `docs/execution-events.md`.
