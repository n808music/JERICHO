# Goal Admission Policy

The goal admission gate is binary: a contract either passes all hard validations or it does not. No warnings, no overrides, no "close enough."

**Canonical location:** `src/domain/goal/GoalAdmissionPolicy.ts`
**Rejection codes:** `src/domain/goal/GoalRejectionCode.ts`
**Intake contract shape:** `src/domain/goal/GoalIntakeContract.ts`

## Validation Phases (in order)

Validations run in priority order — most likely to fail first.

### Phase 0: Plan generation mechanism
| Code | Condition |
|---|---|
| `PLAN_GENERATION_MECHANISM_MISSING` | `contract.planGenerationMechanismClass` is absent |
| `PLAN_GENERATION_MECHANISM_UNSUPPORTED` | mechanism not in v1 allowlist: `['GENERIC_DETERMINISTIC', 'LLM_TYPED']` |
| `REJECT_DISCLOSURE_REQUIRED` | `contract.commitmentDisclosureAccepted` is falsy |

### Phase 1: Inscription integrity
| Code | Condition |
|---|---|
| `INSCRIPTION_MISSING` | `contract.inscription` is absent |
| `INSCRIPTION_NOT_IMMUTABLE` | SHA-256 hash of contract fields does not match stored inscription hash |

### Phase 2: Terminal outcome
| Code | Condition |
|---|---|
| `TERMINAL_OUTCOME_MISSING` | `terminalOutcome` field absent or empty |
| `TERMINAL_OUTCOME_VAGUE` | outcome text fails concreteness check |
| `TERMINAL_OUTCOME_IMMEASURABLE` | outcome cannot be verified at deadline |

### Phase 3: Deadline
| Code | Condition |
|---|---|
| `DEADLINE_MISSING` | `deadlineISO` absent |
| `DEADLINE_IN_PAST` | `deadlineISO` is before `nowISO` |
| `DEADLINE_TOO_SOON` | fewer than 3 days from now |
| `START_DAY_BEFORE_ACTIVE_DAY` | inferred start date precedes app active day |

### Phase 4: Temporal binding
| Code | Condition |
|---|---|
| `NO_WORK_WINDOWS` | no work windows declared |
| `TEMPORAL_BINDING_INVALID` | no recurring schedule commitment |
| `TEMPORAL_BINDING_INSUFFICIENT` | committed days < 3 per week |

### Phase 5: Sacrifice declaration
| Code | Condition |
|---|---|
| `SACRIFICE_MISSING` | no sacrifice declared |
| `SACRIFICE_VAGUE` | sacrifice text is not specific/quantified |
| `SACRIFICE_NOT_BINDING` | declared cost is trivial |

### Phase 6: Causal chain
| Code | Condition |
|---|---|
| `CAUSAL_CHAIN_INCOMPLETE` | no steps from now to outcome |
| `CAUSAL_CHAIN_CIRCULAR` | chain contains a loop |

### Phase 7: Reinforcement
| Code | Condition |
|---|---|
| `REINFORCEMENT_NOT_DECLARED` | user denies daily exposure and no alternate mechanism given |
| `REINFORCEMENT_CONTRADICTION` | claims daily visibility but provides no anchor |

### Phase 8: Meta
| Code | Condition |
|---|---|
| `ASPIRATIONAL_ONLY` | user marks goal as aspiration; admission blocked |
| `DUPLICATE_ACTIVE` | same outcome (by SHA-256 hash) already active |

## Admission Result Shape

```typescript
type GoalAdmissionResult = {
  admitted: boolean;
  rejectionCodes: GoalRejectionCode[];
};
```

All rejection codes are hard failures — `admitted` is `false` if any code is present.

## UI Flow

The multi-step intake flow (`src/ui/goalAdmission/GoalAdmissionFlow.tsx`) collects the fields required by this gate in sequence. The gate is evaluated in `identityStore.js` via `validateGoalAdmission` on form submission.
