# Task 5 Report: Reducer Action Handler

**Status:** DONE

## Objective
Implement `RESPOND_CONVERGENCE_DETECTION_QUESTION` reducer case in `identityReducer()` to handle operator responses to convergence detection questions. This is the middle step of the two-step declare flow: operator responds → navigation to forward-declaration UI → operator submits edge.

## Commits Made
- **50209d3d6c12253ad55c76730b14b6bd17488a0f** — task-5: add RESPOND_CONVERGENCE_DETECTION_QUESTION reducer case

## Implementation Details

### File Modified
**`src/state/identityStore.js`** — Added reducer case before default return at line 1623.

### Reducer Case Behavior

#### Payload Structure
```javascript
{
  type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
  payload: {
    questionId: string,        // Question ID from state.matrix.convergenceDetectionState.pendingQuestions
    disposition: 'Declared' | 'DeadlineAlignment'  // Operator's choice
  }
}
```

#### Processing Flow
1. **Validation:** Returns state unchanged if `questionId` missing or question not found
2. **Deep Clone:** Uses `structuredClone()` for immutable pattern (house convention)
3. **Answer Recording:** Stores `{ disposition, recordedAtISO }` in `answered` map (permanent)
4. **Question Removal:** Filters question from `pendingQuestions` array
5. **Navigation (Declared only):** Sets `ui.navigationIntent` with:
   - Route: `#/forward-declaration`
   - Prefilled data: `sourceIds`, `targetDate`, `detectionQuestionId`
6. **Recomputation:** Calls `computeDerivedState(draft, { type: 'NO_OP' })` to trigger gate re-evaluation

#### Two-Step Declare Flow
1. Operator clicks "Declare" → Action dispatched with `disposition: 'Declared'`
2. Reducer records in `answered` map + sets navigation intent
3. UI navigates to forward-declaration form (prefilled with convergence data)
4. Operator submits convergence edge → Separate `DECLARE_CONVERGENCE` action (Task 6+)

#### DeadlineAlignment Flow
1. Operator clicks "No, it's deadline alignment" → `disposition: 'DeadlineAlignment'`
2. Reducer records in `answered` map (permanent)
3. Question removed from pending (never resurfaces)
4. **No navigation intent set** — UI closes advisory panel

### Key Invariants Upheld
- ✅ Input state unmodified (immutable via structuredClone)
- ✅ Disposition permanent (stored in `answered` map)
- ✅ Only Declared disposition triggers navigation
- ✅ DeadlineAlignment does NOT create convergence edge
- ✅ Graceful handling of missing/invalid questionId
- ✅ Timestamp recorded for all answers
- ✅ Uses house pattern (structuredClone + computeDerivedState)

## Test Verification

### Test File
**`src/state/__tests__/convergence_step5_respond_detection_question.test.js`**

### Test Coverage: 16 Tests (All Passing ✓)

#### Criterion 1: Missing questionId (4 tests)
- ✓ Returns state unchanged when questionId is missing
- ✓ Returns state unchanged when payload is empty
- ✓ Returns state unchanged when payload is null
- ✓ Returns state unchanged when questionId is not found

#### Criterion 2: DeadlineAlignment Disposition (3 tests)
- ✓ Records DeadlineAlignment disposition in answered map
- ✓ Removes question from pendingQuestions when DeadlineAlignment
- ✓ Does NOT set navigationIntent when DeadlineAlignment

#### Criterion 3: Declared Disposition (4 tests)
- ✓ Records Declared disposition in answered map
- ✓ Removes question from pendingQuestions when Declared
- ✓ Sets navigationIntent to forward-declaration when Declared
- ✓ Prefills convergence data in navigationIntent (sourceIds, targetDate, detectionQuestionId)

#### Criterion 5: Immutable Pattern (2 tests)
- ✓ Does not mutate input state
- ✓ Preserves other questions when responding to one

#### Criterion 6: Multiple Responses (1 test)
- ✓ Handles multiple question responses in sequence

#### Criterion 7: Timestamp Recording (2 tests)
- ✓ Records ISO timestamp when question is answered
- ✓ Uses current date if appTime.nowISO is not set

### Test Execution Result
```
 ✓ src/state/__tests__/convergence_step5_respond_detection_question.test.js  (16 tests) 129ms

 Test Files  1 passed (1)
      Tests  16 passed (16)
```

### Test Strategy
- Uses `generateQuestionId()` to compute deterministic question IDs from sourceIds and targetDate
- Properly seeded matrix with deliverables to satisfy `updateConvergenceDetectionState` validation
- Verifies both positive (Declared/DeadlineAlignment) and negative (missing/invalid) paths
- Validates immutable pattern and state preservation
- Tests timestamp recording with and without appTime

## Reducer Case Walkthrough

```javascript
if (action.type === 'RESPOND_CONVERGENCE_DETECTION_QUESTION') {
  const { questionId, disposition } = action.payload || {};
  if (!questionId) return state;  // Guard: missing questionId

  const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));

  // Find the question
  const question = draft.matrix.convergenceDetectionState.pendingQuestions
    .find(q => q.id === questionId);
  if (!question) return state;  // Guard: not found

  // Record permanent answer
  draft.matrix.convergenceDetectionState.answered[questionId] = {
    disposition,
    recordedAtISO: draft.appTime?.nowISO || new Date().toISOString()
  };

  // Remove from pending
  draft.matrix.convergenceDetectionState.pendingQuestions =
    draft.matrix.convergenceDetectionState.pendingQuestions
      .filter(q => q.id !== questionId);

  // Route to forward-declaration if Declared (but NOT if DeadlineAlignment)
  if (disposition === 'Declared') {
    draft.ui = draft.ui || {};
    draft.ui.navigationIntent = {
      route: '#/forward-declaration',
      prefilledConvergence: {
        sourceIds: question.sourceIds,
        targetDate: question.targetDate,
        detectionQuestionId: questionId
      }
    };
  }

  return computeDerivedState(draft, { type: 'NO_OP' });
}
```

## Concerns
None. Implementation fully adheres to:
- House convention (immutable pattern, structuredClone, computeDerivedState)
- Global constraints (reducer placement, disposition values, navigation intent logic)
- Task brief specifications (two-step flow, permanent answers, graceful error handling)

## Validation Checklist

| Criterion | Status |
|-----------|--------|
| Action case placed before default return | ✅ |
| Disposition recorded in answered map | ✅ |
| Question removed from pendingQuestions | ✅ |
| Declared disposition sets navigation intent | ✅ |
| DeadlineAlignment does NOT set navigation | ✅ |
| Uses immutable pattern | ✅ |
| Handles missing questionId gracefully | ✅ |
| Follows house convention | ✅ |
| Comprehensive test coverage | ✅ |
| All tests passing | ✅ |

## Ready for Task 6
Task 5 complete. The reducer now:
- Records operator dispositions permanently
- Routes Declared responses to forward-declaration UI
- Closes advisory panel for DeadlineAlignment responses
- Validates all question-related payloads

Task 6 (Advisory Panel UI Integration) will consume this action. Task 7+ will handle forward-declaration edge creation.
