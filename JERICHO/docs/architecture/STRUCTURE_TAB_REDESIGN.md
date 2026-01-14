# Structure Tab Redesign: Mission Setup Flow

## Overview
The Structure tab has been redesigned into a **4-stage Mission Setup flow** for clear, minimal-friction goal onboarding and planning.

## Architecture

### New Component: `MissionSetupFlow.jsx`
- **Location**: `src/components/zion/MissionSetupFlow.jsx`
- **Props**: 
  - `activeCycleId`, `activeCycle`: Current cycle state
  - `feasibilityByGoal`, `probabilityByGoal`: Computed verdict maps
  - `appTime`, `goalExecutionContract`: Timing and goal contract
  - `suggestedBlocks`: Proposed schedule blocks
  - `actions`, `emitAction`: Action dispatch helpers

### Flow Stages

#### Stage 1: Define Goal
- **Gate**: Always visible
- **Input**: Goal outcome + deadline (via `Workspace` component)
- **Unlock condition**: `definiteGoal.outcome && definiteGoal.deadlineDayKey`
- **UI**: 
  - Shows current goal when compiled
  - Hints user to use Goal Editor if not set
  - Green checkmark when complete

#### Stage 2: Feasibility Check
- **Gate**: Appears after goal is compiled
- **Status**: Read-only computed verdict
- **Display**:
  - Required pace (blocks/day)
  - Days remaining to deadline
  - Feasibility status (Feasible / Infeasible / etc.)
  - Diagnostic notes
- **Unlock condition**: `feasibility.status === 'FEASIBLE'`
- **Color**: Green tint if feasible, amber if not

#### Stage 3: Generate Schedule
- **Gate**: Appears after feasibility passes
- **Action**: Single "Generate Cold Plan" button
- **Output**: Proposed blocks (suggested status)
- **Display**:
  - Count of proposed blocks
  - Prompt to review on Today view
- **Unlock condition**: `proposedBlockCount > 0 || autoAsanaPlan?.horizonBlocks?.length`

#### Stage 4: Commit Schedule
- **Gate**: Appears after proposed blocks exist
- **Action**: Single "Apply Schedule to Calendar" button
- **Effect**: Accepts all proposed blocks, commits to calendar
- **Info**: Reminder about the action's effect

### Collapsible Sections (Non-Critical UI)

#### Cycle Management
- New Cycle, Archive, Delete buttons
- Cycle history browser
- Switch/Review actions for past cycles
- **Default**: Collapsed to reduce visual clutter

#### Cycle Summary (Review Mode Only)
- Completion count, rate, probability/feasibility at end
- Read-only for ended cycles
- **Default**: Collapsed

#### Deliverables (Optional)
- Add/edit/delete deliverables
- Manage criteria and closure tracking
- **Default**: Collapsed
- **Note**: Non-critical to 4-stage flow; stored separately in cycle state

#### Strategy & Constraints (Advanced)
- Cold plan strategy, constraints
- Advanced goal configuration options
- **Default**: Collapsed
- Placeholder for future expansion

### Removed/Restructured UI
- **Removed**: Preference-framing copy ("Define outcomes and closure criteria" → minimal copy only)
- **Removed**: Always-visible Deliverables panel (moved to collapsible)
- **Removed**: Always-visible Cycle Summary (moved to collapsible, review-mode only)
- **Moved**: Workspace (`Definite Goal` module) now appears after Mission Setup flow

## Integration

### Changes to `ZionDashboard.jsx`
1. **Import**: Added `MissionSetupFlow` component
2. **Structure view (`view === 'structure'`)**:
   - If `activeCycleId` exists: Render MissionSetupFlow + collapsible sections
   - If no cycle: Show "No active cycle" hint
3. **Action wiring**: Passes `actions` and `emitAction` to MissionSetupFlow
4. **Workspace** remains at bottom for goal/pattern editing

### No Semantic Changes
- All compute logic (`feasibility`, `generatePlan`, `applyPlan`) unchanged
- No modifications to event sourcing, materialize, or convergence
- UI-only restructuring for clarity and focus

## User Experience Flow

### New Cycle Path
1. User clicks "New Cycle" in Cycle Management (collapsed)
2. System creates blank cycle, shows "No goal yet" in Stage 1
3. User clicks into Goal Editor (Workspace below MissionSetupFlow)
4. Compiles goal → Stage 1 checkmark ✓
5. Feasibility auto-computes → Stage 2 unlocks
6. Feasibility is Feasible → Stage 3 unlocks
7. User clicks "Generate Cold Plan" → Proposed blocks created
8. Stage 4 unlocks with "Apply Schedule" button
9. User reviews proposed blocks on Today view (optional)
10. User clicks "Apply Schedule" → Blocks committed to calendar

### Cycle Archive/Delete Path
1. User opens Cycle Management (collapsed)
2. Clicks "Archive Cycle" (amber) or "Delete Cycle" (red)
3. Confirmation dialog (archive moves to review mode; delete clears calendar)
4. System transitions to Structure view with no active cycle

### Review Mode Path
1. User switches to ended cycle via Cycle History
2. MissionSetupFlow visible (read-only gates)
3. Cycle Summary panel available (collapsed)
4. No edit buttons (deliverables, etc. disabled)
5. Review of completion metrics and final probability

## Technical Details

### Gating Logic
```
Stage 1 (Define): Always shown
Stage 2 (Feasibility): if (definiteGoal.outcome && definiteGoal.deadlineDayKey)
Stage 3 (Generate): if (isFeasible && Stage 2 true)
Stage 4 (Apply): if (hasProposedSchedule && Stage 3 true)
```

### Props Flow
```
ZionDashboard
  └─ MissionSetupFlow
      ├─ activeCycleId, activeCycle (state)
      ├─ feasibilityByGoal[goalId] (computed verdict)
      ├─ generatePlan, applyPlan (actions)
      └─ emitAction (tracing + dispatch wrapper)
  
  └─ Collapsible Cycle Management
      ├─ startNewCycle, deleteCycle, endCycle
      └─ cyclesIndex (history browser)
  
  └─ Collapsible Deliverables
      ├─ createDeliverable, updateDeliverable, deleteDeliverable
      └─ criteriaByDeliverable (closure tracking)
  
  └─ Workspace (Definite Goal module)
      └─ setDefiniteGoal, goalExecutionContract (goal compilation)
```

## Testing
- No changes to freeze tests (all 3 passing)
- No changes to cycle lifecycle tests
- UI-only changes, compute semantics preserved
- Manual path verification recommended:
  1. New cycle → Compile goal → Feasibility check → Generate plan → Apply

## Future Enhancements
- Conditionally render Strategy panel into Advanced section based on goal complexity
- Add inline help/tooltips for each stage
- Add "Skip" or "Quick Setup" buttons for fast users
- Integrate analytics to track stage completion rates
- Add undo/redo for mistaken plan applications

## Files Modified
- `src/components/zion/MissionSetupFlow.jsx` (new)
- `src/components/ZionDashboard.jsx` (Structure view refactored)
- No changes to state layer, compute engine, or persistence

## Design Rationale
1. **Single flow**: Eliminates cognitive load of multiple panels competing for attention
2. **Gating**: Prevents misuse (e.g., applying unreviewed plan)
3. **Progressive disclosure**: Hides non-critical UI (deliverables, strategy) in collapsers
4. **Minimal copy**: Removed preference-framing language ("define outcomes") in favor of action-oriented labels
5. **Read-only feasibility**: Reinforces that goal/capacity trade-offs are computed, not manual
6. **Clear stages**: Numbered flow with visual checkmarks for progress tracking
