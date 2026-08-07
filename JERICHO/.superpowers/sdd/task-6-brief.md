# Task 6: Advisory Panel Builder

**Where this fits:** Task 6 of 8. Implements the function that transforms pending detection questions into advisory panel UI data.

**Objective:** Create new file `src/state/convergenceCandidateAdvisory.js` with `buildConvergenceCandidateAdvisory()` function that converts state to advisory data.

## File to Create

**File:** `src/state/convergenceCandidateAdvisory.js` (NEW)

**Purpose:** Pure function that builds advisory panel data from convergence detection state.

## Function: buildConvergenceCandidateAdvisory(state)

**Input:** Identity state object (full state passed from ZionDashboard)

**Output:** Advisory panel data or null

```javascript
export function buildConvergenceCandidateAdvisory(state) {
  // If no pending questions, return null (no panel to render)
  const pendingQuestions = state?.matrix?.convergenceDetectionState?.pendingQuestions || [];
  if (pendingQuestions.length === 0) return null;

  // Transform each question into advisory item
  const advisory = {
    title: 'Convergence Detection',
    description: 'The following deliverables share deadlines without a convergence edge.',
    questions: pendingQuestions.map(question => ({
      id: question.id,
      sourceIds: question.sourceIds,
      targetDate: question.targetDate,
      label: question.sourceIds.join(' + '),  // e.g., "d1 + d2"
      actions: [
        {
          type: 'Declared',
          label: 'Yes, declare convergence',
          description: 'These items should converge'
        },
        {
          type: 'DeadlineAlignment',
          label: 'No, deadline alignment only',
          description: 'These happen to share a date, no convergence needed'
        }
      ]
    }))
  };

  return advisory;
}
```

## Data Structure Details

### Input: state

Full identity state object containing:
```javascript
state.matrix.convergenceDetectionState.pendingQuestions = [
  {
    id: '4f3a2b1c...',
    sourceIds: ['d1', 'd2'],
    targetDate: '2026-09-15',
    detectedAtISO: '2026-08-06T10:00:00Z'
  },
  // ...more questions
]
```

### Output: advisory (if questions present)

```javascript
{
  title: string,              // Panel title
  description: string,        // Explanatory text
  questions: [                // Array of question objects
    {
      id: string,            // Question ID (for action dispatch)
      sourceIds: string[],   // Original sourceIds array
      targetDate: string,    // ISO date
      label: string,         // Human-readable label (joined sourceIds)
      actions: [             // Available operator responses
        {
          type: 'Declared' | 'DeadlineAlignment',
          label: string,     // Button text
          description: string // Tooltip/explanation
        }
      ]
    }
  ]
}
```

### Output: null (if no questions)

Return `null` if `pendingQuestions` is empty or missing.

## Implementation Notes

1. **Pure function** — No side effects, no state mutations
2. **Defensive** — Handle missing state gracefully (return null)
3. **Simple transformation** — Reshape data for UI consumption
4. **Reusable label** — Join sourceIds with ' + ' for readable label (e.g., "d1 + d2")
5. **Actions immutable** — Action types match dispositions exactly: `'Declared'`, `'DeadlineAlignment'`

## Testing

Task 8 tests cover:
- Criterion 4: Advisory builder returns null when dependency-excluded (via await import)
- No standalone tests in this task

## Acceptance Criteria

1. ✅ Returns null if no pending questions
2. ✅ Returns advisory object with title, description, questions array
3. ✅ Each question includes id, sourceIds, targetDate, label, actions
4. ✅ Label joins sourceIds with ' + '
5. ✅ Actions array contains exactly two items: Declared, DeadlineAlignment
6. ✅ Action types match disposition values exactly
7. ✅ Pure function (no mutations, no side effects)
8. ✅ Exported for use by ZionDashboard

## Related Code

- Used by: Task 7 (ZionDashboard render), Task 8 tests
- Does not use: Any detection or state mutation logic
- Does not modify: Input state
- Reference: Other advisory builders in codebase (e.g., barrier advisory pattern)
