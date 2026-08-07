# Task 7: ZionDashboard Integration

**Where this fits:** Task 7 of 8. Integrates the advisory panel into the main dashboard UI so operators see and interact with detection questions.

**Objective:** Modify `src/components/ZionDashboard.jsx` to:
1. Import `buildConvergenceCandidateAdvisory()`
2. Call it to build advisory data
3. Render advisory panel with question display and action buttons
4. Dispatch action when operator responds

## File to Modify

**File:** `src/components/ZionDashboard.jsx`

**Location:** Main component render

## Import Statement

Add at the top with other imports:

```javascript
import { buildConvergenceCandidateAdvisory } from '../state/convergenceCandidateAdvisory.js';
```

## Integration Points

### 1. Build Advisory Data

In component render or effect, call:

```javascript
const convergenceAdvisory = buildConvergenceCandidateAdvisory(state);
```

### 2. Render Advisory Panel

Add conditional render where other advisory panels are rendered (search for existing advisory pattern, e.g., barrier advisory):

```javascript
{convergenceAdvisory && (
  <div className="convergence-advisory-panel">
    <h3>{convergenceAdvisory.title}</h3>
    <p>{convergenceAdvisory.description}</p>
    
    {convergenceAdvisory.questions.map(question => (
      <div key={question.id} className="convergence-question">
        <label>{question.label}</label>
        <span className="target-date">{question.targetDate}</span>
        
        <div className="actions">
          {question.actions.map(action => (
            <button
              key={action.type}
              className={`action-btn ${action.type.toLowerCase()}`}
              onClick={() =>
                dispatch({
                  type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
                  payload: {
                    questionId: question.id,
                    disposition: action.type
                  }
                })
              }
              title={action.description}
            >
              {action.label}
            </button>
          ))}
        </div>
      </div>
    ))}
  </div>
)}
```

## Pattern to Follow

**Look at existing advisories in ZionDashboard:**
- Search for "advisory" or "panel" in the file
- Follow the same render pattern: conditional render, question map, action dispatch
- Use same className conventions (kebab-case)
- Use same dispatch pattern (`dispatch({ type, payload })`)

**Example reference:**
Look for barrier advisory, capability advisory, or similar — use that as a template for structure and styling.

## Action Dispatch

When operator clicks an action button:

```javascript
dispatch({
  type: 'RESPOND_CONVERGENCE_DETECTION_QUESTION',
  payload: {
    questionId: question.id,
    disposition: action.type  // 'Declared' or 'DeadlineAlignment'
  }
})
```

This triggers the reducer case from Task 5.

## Navigation Handling

After dispatch:
- If operator chose "Declared", the reducer sets `state.ui.navigationIntent`
- ZionDashboard's navigation handler will route to forward-declaration form
- No special handling needed in this task (navigation is automatic)

## Testing

Task 8 tests cover indirect integration via state inspection. No UI tests in this task.

## Acceptance Criteria

1. ✅ `buildConvergenceCandidateAdvisory` imported
2. ✅ Advisory data built from state
3. ✅ Panel renders only when advisory is not null
4. ✅ Each question displays sourceIds label and targetDate
5. ✅ Actions render as buttons with correct labels
6. ✅ Button click dispatches correct action type and questionId
7. ✅ Disposition value matches action type exactly
8. ✅ Follows existing advisory panel pattern in codebase

## Related Code

- Uses: `buildConvergenceCandidateAdvisory()` (Task 6)
- Used by: Operator interaction flow
- Dispatches: `RESPOND_CONVERGENCE_DETECTION_QUESTION` action (Task 5)
- Reference: Other advisory patterns in ZionDashboard (search for existing advisories)
