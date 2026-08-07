# Task 5: Reducer Action Handler

**Where this fits:** Task 5 of 8. Implements the reducer case that handles operator responses to detection questions (two-step declare flow).

**Objective:** Add `RESPOND_CONVERGENCE_DETECTION_QUESTION` action case to the `identityReducer()` function in `src/state/identityStore.js`.

## File to Modify

**File:** `src/state/identityStore.js`

**Function:** `identityReducer(state, action)`

**Location:** Inside reducer, before the default return case (search for `return computeDerivedState(state, action);` at the end of the reducer)

## Action Payload

**Action Type:** `RESPOND_CONVERGENCE_DETECTION_QUESTION`

**Payload Structure:**
```javascript
{
  type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
  payload: {
    questionId: string,        // Question ID from pending question
    disposition: 'Declared' | 'DeadlineAlignment'  // Operator's choice
  }
}
```

## Reducer Implementation

**Pattern:** Must follow house convention (same as SET_DEFINITE_GOAL, SET_AIM, etc.)

Add this case BEFORE the default return:

```javascript
  if (action.type === 'RESPOND_CONVERGENCE_DETECTION_QUESTION') {
    const { questionId, disposition } = action.payload || {};
    if (!questionId) return state;
    
    const draft = structuredClone ? structuredClone(state) : JSON.parse(JSON.stringify(state));
    
    const question = draft.matrix.convergenceDetectionState.pendingQuestions
      .find(q => q.id === questionId);
    if (!question) return state;
    
    // Record operator's answer (permanent — never re-ask this question)
    draft.matrix.convergenceDetectionState.answered[questionId] = {
      disposition,
      recordedAtISO: draft.appTime?.nowISO || new Date().toISOString()
    };
    
    // Remove from pending
    draft.matrix.convergenceDetectionState.pendingQuestions = 
      draft.matrix.convergenceDetectionState.pendingQuestions
        .filter(q => q.id !== questionId);
    
    // If operator chose "Declared": navigate to forward-declaration UI
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

## Key Behaviors

### Two-Step Declare Flow

1. **Operator clicks "Declare"** → Action dispatched with `disposition: 'Declared'`
2. **Reducer:**
   - Records disposition in `answered` map (permanent)
   - Removes from `pendingQuestions`
   - Sets `ui.navigationIntent` to route to forward-declaration
3. **UI navigation** → Forward-declaration form prefilled with sourceIds and targetDate
4. **Operator submits** → Separate `DECLARE_CONVERGENCE` action (not in this task) creates edge

**This action does NOT create a convergence edge.** It marks disposition and navigates.

### "DeadlineAlignment" Disposition

1. **Operator clicks "No, it's deadline alignment"** → `disposition: 'DeadlineAlignment'`
2. **Reducer:**
   - Records disposition in `answered` map
   - Removes from `pendingQuestions`
   - NO navigation intent set
3. **UI** → Advisory panel closes, question never resurfaces

### Immutable Pattern

- Input state remains unmodified
- Use `structuredClone()` for deep clone (house pattern)
- Apply mutations to draft
- Return via `computeDerivedState(draft, { type: 'NO_OP' })`
- NO_OP action triggers recomputation (detection gate, plan quality, etc.)

## Validation

- Missing `questionId` → return state unchanged
- Question not found in pendingQuestions → return state unchanged
- Empty payload → return state unchanged

## Testing

Task 8 tests cover:
- Criterion 2: DeadlineAlignment disposition persists
- Criterion 3: Declared routes to forward-declaration
- No standalone tests in this task

## Acceptance Criteria

1. ✅ Action case placed before default return in reducer
2. ✅ Disposition recorded in `answered` map (permanent)
3. ✅ Question removed from `pendingQuestions`
4. ✅ Declared disposition sets navigation intent
5. ✅ DeadlineAlignment disposition does NOT set navigation
6. ✅ Uses immutable pattern (structuredClone + computeDerivedState)
7. ✅ Handles missing questionId gracefully
8. ✅ Follows house convention (matches SET_DEFINITE_GOAL pattern)

## Related Code

- Uses: `computeDerivedState()` (existing)
- Used by: UI action dispatch (Task 7), Task 8 tests
- Does not call: `declareConvergence()` or edge creation logic
- Does not modify: `pendingQuestions` structure (only filters)
