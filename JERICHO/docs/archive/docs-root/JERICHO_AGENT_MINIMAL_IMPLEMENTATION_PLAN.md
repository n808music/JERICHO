# JERICHO Agent Minimal Implementation Plan

## Phase F — First Two Agent Roles

**Date:** 2026-03-26 **Branch:** proof-1.0.6 **Depends on:**
`JERICHO_AGENT_INTEGRATION_ASSESSMENT.md`

---

## Chosen First Roles

**Role A — Intake Drafting Assistant** Helps users resolve
`GoalIntakeContract.requiredContextQuestions[]` before the deterministic intake
gate fires. Does not touch admission, scheduling, or P.O.S.

**Role B — Classification Diagnostic Assistant** Explains why
`classifyLiveInputToArchetype()` chose a particular archetype. Entirely
read-only. Never stored. Dismissed when the user proceeds.

Both roles are advisory only. Neither produces authoritative state. Neither can
cause admission of a goal that would otherwise be rejected.

---

## Non-Goals (Explicit)

- Does not implement Role C (Recovery), Role D (Lane authoring), or Role E
  (Wording refinement)
- Does not change `GoalAdmissionPolicy.ts`
- Does not change `probabilityScore.ts`
- Does not change any deterministic reducer in `identityStore.js` or
  `draftSchedule.js`
- Does not change `executionContract.ts`, `todayAuthority.ts`, or `planProof.ts`
- Does not replace `mockLLMActionGraph.ts` with real API calls (that is a
  separate readiness gate)
- Does not add new execution types or archetype grammar
- Does not change the 10-option execution type dropdown selection flow

---

## Implementation Sequence

### Step 1 — Extend `LLM_CALL_PROFILES` in `llmActionGraph.ts`

Add two new call profiles for the agent roles. This follows the existing pattern
and ensures all Claude API calls are named, versioned, and bounded.

**File:** `src/state/llmActionGraph.ts`

Add to `LLM_CALL_PROFILES`:

```typescript
INTAKE_CLARIFICATION: {
  name: 'INTAKE_CLARIFICATION',
  model: 'claude-sonnet-4-6',
  maxTokens: 1000,
  maxRetries: 2,
  schemaVersion: 'jericho_intake_draft_v1',
},
CLASSIFICATION_EXPLANATION: {
  name: 'CLASSIFICATION_EXPLANATION',
  model: 'claude-sonnet-4-6',
  maxTokens: 800,
  maxRetries: 1,
  schemaVersion: 'jericho_classification_explanation_v1',
},
```

Also add to `LLMCallProfile['name']` union type:
`'INTAKE_CLARIFICATION' | 'CLASSIFICATION_EXPLANATION'`

**Why this step first:** All Claude API call shapes must be named and centrally
registered before any implementation references them. This is the existing
convention in the repo.

---

### Step 2 — Define output types for agent roles

**File:** `src/state/engine/agentOutputTypes.ts` (new file)

```typescript
/**
 * agentOutputTypes.ts
 *
 * Non-authoritative output types for Phase F agent roles.
 * These types describe advisory output only.
 * Nothing in this file is stored in authoritative goal or cycle state.
 */

// ─── Role A: Intake Drafting Assistant ───────────────────────────────────────

/**
 * A suggested answer for one required intake context question.
 * Must be confirmed by the user before it is applied to answeredContext.
 */
export type CandidateIntakeAnswer = {
  questionId: string; // matches IntakeQuestion.id
  field: string; // matches IntakeQuestion.field
  suggestedValue: string | number | boolean | string[];
  rationale: string; // why this answer was suggested
  confidence: 'high' | 'medium' | 'low';
  requiresUserConfirmation: true; // always true — cannot be bypassed
};

/**
 * The full output of an intake clarification agent session.
 * All answers must be reviewed before any is applied.
 */
export type CandidateIntakeDraft = {
  source: 'agent_draft'; // provenance tag — removed when user confirms
  schemaVersion: 'jericho_intake_draft_v1';
  goalId: string;
  intakeGateCode: string; // the gate code that triggered this session
  candidateAnswers: CandidateIntakeAnswer[];
  agentNote: string | null; // optional plain-English summary of what was clarified
};

// ─── Role B: Classification Diagnostic Assistant ──────────────────────────────

/**
 * Plain-language explanation of a classification decision.
 * Never stored. Dismissed when the user proceeds.
 */
export type ClassificationExplanation = {
  source: 'agent_draft';
  schemaVersion: 'jericho_classification_explanation_v1';
  classifiedArchetype: string;
  signalsSummary: string; // why this archetype was chosen
  archetypeDescription: string; // what this archetype means for plan shape
  deliverableShapeSummary: string; // phases/milestones/bridge pattern for this archetype
  compositionSummary: string | null; // if a secondary archetype was detected
  alternativesToConsider: string[]; // other archetypes the user might prefer (advisory only)
  confidenceNote: string; // honest note about classification certainty
};
```

**Why this file:** Keeps agent output types separate from production domain
types. Makes it structurally impossible to accidentally promote an advisory type
to an authoritative position.

---

### Step 3 — Implement Role A: intake clarification caller

**File:** `src/state/engine/intakeClarificationAgent.ts` (new file)

This module does one thing: takes an unanswered `GoalIntakeContract` and
produces a `CandidateIntakeDraft`. It is a leaf node — it calls the LLM and
returns; it does not dispatch to any store.

```typescript
/**
 * intakeClarificationAgent.ts
 *
 * Role A — Intake Drafting Assistant.
 * Produces CandidateIntakeDraft from unanswered GoalIntakeContract questions.
 *
 * This is a pure async function. It does not dispatch to any store.
 * The caller is responsible for displaying the output and confirming user intent
 * before applying any answer to answeredContext.
 */

import type { GoalIntakeContract } from '../domain/goal/GoalIntakeContract';
import type { CandidateIntakeDraft } from './agentOutputTypes';
import { LLM_CALL_PROFILES } from '../state/llmActionGraph';

// Prompt builder — produces a structured prompt that requests JSON output
// following CandidateIntakeDraft schema.
function buildIntakeClarificationPrompt(
  intakeContract: GoalIntakeContract,
  rawGoalText: string
): string {
  const unansweredQuestions = intakeContract.requiredContextQuestions.filter(
    (q) => !intakeContract.answeredContext[q.field]
  );

  return [
    'You are helping a user clarify their goal before a planning system generates their schedule.',
    'The planning system has identified unanswered required questions about this goal.',
    '',
    `Goal text: "${rawGoalText}"`,
    '',
    'Unanswered required questions:',
    ...unansweredQuestions.map(
      (q, i) =>
        `${i + 1}. [${q.id}] ${q.prompt} (field: ${q.field}, type: ${q.answerType}${q.options ? ', options: ' + q.options.join(', ') : ''})`
    ),
    '',
    'Suggest concrete answers to each question based on the goal text.',
    'Return valid JSON matching this schema:',
    JSON.stringify(
      {
        schemaVersion: 'jericho_intake_draft_v1',
        agentNote: 'string | null',
        candidateAnswers: [
          {
            questionId: 'string',
            field: 'string',
            suggestedValue: 'string | number | boolean | string[]',
            rationale: 'string',
            confidence: 'high | medium | low',
            requiresUserConfirmation: true,
          },
        ],
      },
      null,
      2
    ),
    '',
    'Return only the JSON object. Do not include explanation outside the JSON.',
  ].join('\n');
}

// Parse and validate the agent response
function parseIntakeDraft(
  responseText: string,
  goalId: string,
  intakeGateCode: string
): CandidateIntakeDraft | null {
  try {
    const parsed = JSON.parse(responseText);
    if (parsed?.schemaVersion !== 'jericho_intake_draft_v1') return null;
    if (!Array.isArray(parsed?.candidateAnswers)) return null;
    return {
      source: 'agent_draft',
      schemaVersion: 'jericho_intake_draft_v1',
      goalId,
      intakeGateCode,
      candidateAnswers: parsed.candidateAnswers.map((a: any) => ({
        ...a,
        requiresUserConfirmation: true as const, // always enforce
      })),
      agentNote: parsed.agentNote ?? null,
    };
  } catch {
    return null;
  }
}

export async function callIntakeClarificationAgent(
  intakeContract: GoalIntakeContract,
  rawGoalText: string,
  goalId: string,
  callClaude: (
    prompt: string,
    profile: (typeof LLM_CALL_PROFILES)[keyof typeof LLM_CALL_PROFILES]
  ) => Promise<string>
): Promise<CandidateIntakeDraft | null> {
  const profile = LLM_CALL_PROFILES.INTAKE_CLARIFICATION;
  const prompt = buildIntakeClarificationPrompt(intakeContract, rawGoalText);
  try {
    const responseText = await callClaude(prompt, profile);
    return parseIntakeDraft(
      responseText,
      goalId,
      intakeContract.readiness.blockingReasons[0] ?? 'INTAKE_BLOCKED'
    );
  } catch {
    // Fail safe: return null, caller falls back to manual flow
    return null;
  }
}
```

**Key design decisions:**

- `callClaude` is injected, not imported directly. This keeps the agent testable
  without real API and decoupled from the specific Claude client implementation.
- Returns `null` on failure. Callers must handle null gracefully.
- `requiresUserConfirmation: true as const` is enforced in the parser, not just
  the type definition.

---

### Step 4 — Implement Role B: classification explanation caller

**File:** `src/state/engine/classificationExplanationAgent.ts` (new file)

```typescript
/**
 * classificationExplanationAgent.ts
 *
 * Role B — Classification Diagnostic Assistant.
 * Produces a read-only ClassificationExplanation from archetype + trace summary.
 *
 * This is a pure async function. Never dispatches. Never stored.
 */

import type { MigratedArchetype } from './archetypeLiveTraceEvaluation';
import type { SupportedCompositionPair } from './compositionDetector';
import type { ClassificationExplanation } from './agentOutputTypes';
import { LLM_CALL_PROFILES } from '../state/llmActionGraph';

function buildClassificationExplanationPrompt(
  goalText: string,
  archetype: MigratedArchetype,
  compositionPair: SupportedCompositionPair | null
): string {
  return [
    'You are explaining a goal classification decision to a user.',
    'The classification system has already made its decision — your job is to explain it clearly.',
    'Do not suggest the classification is wrong or offer to override it.',
    '',
    `Goal text: "${goalText}"`,
    `Classified as: ${archetype}`,
    compositionPair
      ? `Composition detected: ${compositionPair.pairId} (${compositionPair.primary} + ${compositionPair.secondary})`
      : 'No composition detected.',
    '',
    'Produce a JSON explanation matching this schema:',
    JSON.stringify(
      {
        schemaVersion: 'jericho_classification_explanation_v1',
        classifiedArchetype: 'string',
        signalsSummary:
          'string — which words/phrases drove this classification',
        archetypeDescription:
          'string — what this archetype means for plan structure',
        deliverableShapeSummary:
          'string — phases, milestones, bridge patterns expected',
        compositionSummary: 'string | null — explain composition if detected',
        alternativesToConsider: [
          'string — other archetype names only if genuinely ambiguous',
        ],
        confidenceNote: 'string — honest note on classification certainty',
      },
      null,
      2
    ),
    '',
    'Return only the JSON object.',
  ].join('\n');
}

function parseClassificationExplanation(
  responseText: string,
  archetype: MigratedArchetype
): ClassificationExplanation | null {
  try {
    const parsed = JSON.parse(responseText);
    if (parsed?.schemaVersion !== 'jericho_classification_explanation_v1')
      return null;
    return {
      source: 'agent_draft',
      schemaVersion: 'jericho_classification_explanation_v1',
      classifiedArchetype: archetype,
      signalsSummary: parsed.signalsSummary ?? '',
      archetypeDescription: parsed.archetypeDescription ?? '',
      deliverableShapeSummary: parsed.deliverableShapeSummary ?? '',
      compositionSummary: parsed.compositionSummary ?? null,
      alternativesToConsider: Array.isArray(parsed.alternativesToConsider)
        ? parsed.alternativesToConsider
        : [],
      confidenceNote: parsed.confidenceNote ?? '',
    };
  } catch {
    return null;
  }
}

export async function callClassificationExplanationAgent(
  goalText: string,
  archetype: MigratedArchetype,
  compositionPair: SupportedCompositionPair | null,
  callClaude: (
    prompt: string,
    profile: (typeof LLM_CALL_PROFILES)[keyof typeof LLM_CALL_PROFILES]
  ) => Promise<string>
): Promise<ClassificationExplanation | null> {
  const profile = LLM_CALL_PROFILES.CLASSIFICATION_EXPLANATION;
  const prompt = buildClassificationExplanationPrompt(
    goalText,
    archetype,
    compositionPair
  );
  try {
    const responseText = await callClaude(prompt, profile);
    return parseClassificationExplanation(responseText, archetype);
  } catch {
    return null;
  }
}
```

---

### Step 5 — UI integration points

Both agent roles produce transient UI state. No new store reducers are needed
for Phase F. Both can be wired into component-local state (`useState` /
`useEffect`) without touching the store.

#### Role A — Intake Drafting Assistant UI touchpoint

**File:** `src/components/zion/MissionSetupFlow.jsx` (or the intake form
component)

Insert point: when `IntakeGateCode !== 'INTAKE_OK'` and
`requiredContextQuestions.length > 0`, show a collapsible "AI clarification"
section alongside the manual question prompts.

```
[IntakeGateCode block displayed]
  ├── [Manual: user fills in requiredContextQuestions directly]
  └── [Optional: "Get AI suggestions" button]
        → calls callIntakeClarificationAgent()
        → displays CandidateIntakeDraft in a review panel
        → each candidateAnswer has "Apply" / "Skip" toggle
        → user-applied answers update goalDraftV2.answeredContext
        → buildGoalIntakeContract() re-runs
```

The "Get AI suggestions" button is:

- Opt-in (not auto-triggered)
- Disabled if `requiredContextQuestions` is empty
- Shows a spinner while agent call is in progress
- Shows fallback message if agent returns null

#### Role B — Classification Diagnostic Assistant UI touchpoint

**File:** `src/ui/goalAdmission/GoalAdmissionPage.tsx`

Insert point: after execution type dropdown renders the classified archetype,
add a "Why this?" expandable info section.

```
[Execution Type: VentureLaunch ▾]
  └── [ℹ Why VentureLaunch?] (expandable)
        → calls callClassificationExplanationAgent() on first expand
        → displays ClassificationExplanation in a read-only panel
        → "Close" dismisses, no state change
```

The expand is:

- Lazy (agent called only when user expands)
- Cached for session duration (don't re-call on every expand)
- Shows fallback "The system classified this as VentureLaunch based on your goal
  text." if agent returns null

---

### Step 6 — Test strategy

#### Unit tests for new agent modules

**File:** `tests/state/intakeClarificationAgent.unit.test.ts` (new)

Test cases:

- `parseIntakeDraft` with valid schema response → returns `CandidateIntakeDraft`
  with `requiresUserConfirmation: true`
- `parseIntakeDraft` with wrong schemaVersion → returns null
- `parseIntakeDraft` with malformed JSON → returns null
- `callIntakeClarificationAgent` with a callClaude that throws → returns null
  (fail-safe)
- `callIntakeClarificationAgent` — `requiresUserConfirmation` is enforced even
  if response omits it

**File:** `tests/state/classificationExplanationAgent.unit.test.ts` (new)

Test cases:

- `parseClassificationExplanation` with valid response → returns
  `ClassificationExplanation`
- `parseClassificationExplanation` with wrong schemaVersion → returns null
- `callClassificationExplanationAgent` with throwing callClaude → returns null

#### Integration: non-regression

Run the full Phase A–D suite to confirm zero regressions:

- `npx vitest run JERICHO/tests/state/e2eChain`
- `npx vitest run JERICHO/tests/state/compositionDetector`
- `npx vitest run JERICHO/tests/state/goalToDeliverables`

No new tests touch the deterministic core. The new tests only cover the agent
output parsers, which are side-effect-free pure functions (modulo the injected
`callClaude`).

#### UI: smoke test

- Verify "Get AI suggestions" shows and hides correctly based on
  `IntakeGateCode`
- Verify "Why this?" panel shows and dismisses without changing
  `goalContract.executionType`
- Verify that agent-suggested intake answers are NOT applied without explicit
  user confirmation

---

## File Touchpoints Summary

| File                                                      | Change type | What changes                                                                                      |
| --------------------------------------------------------- | ----------- | ------------------------------------------------------------------------------------------------- |
| `src/state/llmActionGraph.ts`                             | Extend      | Add `INTAKE_CLARIFICATION` and `CLASSIFICATION_EXPLANATION` to `LLM_CALL_PROFILES` and name union |
| `src/state/engine/agentOutputTypes.ts`                    | New         | `CandidateIntakeDraft`, `CandidateIntakeAnswer`, `ClassificationExplanation` types                |
| `src/state/engine/intakeClarificationAgent.ts`            | New         | Role A caller — async, pure function, fail-safe                                                   |
| `src/state/engine/classificationExplanationAgent.ts`      | New         | Role B caller — async, pure function, fail-safe                                                   |
| `src/components/zion/MissionSetupFlow.jsx`                | Extend      | Add optional "Get AI suggestions" section (opt-in, component-local state)                         |
| `src/ui/goalAdmission/GoalAdmissionPage.tsx`              | Extend      | Add collapsible "Why this?" info panel (lazy, component-local state)                              |
| `tests/state/intakeClarificationAgent.unit.test.ts`       | New         | Parser + fail-safe unit tests                                                                     |
| `tests/state/classificationExplanationAgent.unit.test.ts` | New         | Parser + fail-safe unit tests                                                                     |

**Files that do NOT change:**

- `src/state/identityStore.js` — no new reducers
- `src/domain/goal/GoalAdmissionPolicy.ts` — unchanged
- `src/state/engine/probabilityScore.ts` — unchanged
- `src/state/engine/executionContract.ts` — unchanged
- `src/state/draftSchedule.js` — unchanged
- Any `*Test*` or `*spec*` file in the deterministic suite

---

## Non-Authoritative Output Contract

Both agent roles produce outputs that are structurally non-authoritative:

1. **`source: 'agent_draft'`** — all outputs carry this tag. UI components use
   it to render appropriate qualification labels ("AI-suggested", "Review before
   applying").

2. **`requiresUserConfirmation: true`** — `CandidateIntakeAnswer` always carries
   this field. UI components must render a confirm/skip control for each item.
   Batch-apply is not allowed.

3. **`ClassificationExplanation` is never serialized.** It lives in
   component-local state and is garbage-collected when the component unmounts or
   the user proceeds.

4. **Admission gate re-runs after intake draft.** The agent cannot produce an
   intake draft that causes the system to skip `buildGoalIntakeContract()`
   re-evaluation. The gate always re-runs with the user-confirmed answers.

---

## Risk Register

| Risk                                                 | Likelihood          | Mitigation                                                                                    |
| ---------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------- |
| Agent suggests intake answer that causes gate bypass | Very low            | Gate re-runs regardless; agent cannot short-circuit `isReadyForPlanning` check                |
| Agent hallucinate an archetype name in alternatives  | Low                 | `alternativesToConsider` is display-only; only the 10-option dropdown changes `executionType` |
| Agent call failure blocks user                       | Near-zero           | Both callers return `null` on failure; UI falls back to manual flow                           |
| Agent output stored as authoritative                 | Prevented by design | `source: 'agent_draft'` tag; no store dispatch from agent modules                             |
| Prompt injection via goal text                       | Low                 | Goal text is in JSON context, not system prompt position; system prompt is hardcoded          |
| Agent call latency degrades UX                       | Medium              | Both calls are opt-in or lazy; spinner shown; user is not blocked                             |

---

## Acceptance Condition for Phase F Implementation

Phase F implementation is complete when:

1. `agentOutputTypes.ts` is in place with correct `source: 'agent_draft'`
   tagging
2. `intakeClarificationAgent.ts` and `classificationExplanationAgent.ts` exist
   with fail-safe null returns
3. `LLM_CALL_PROFILES` is extended with the two named profiles
4. UI integration points render "Get AI suggestions" and "Why this?" without
   touching authoritative state
5. Unit tests for parsers pass (fail-safe null on bad input)
6. Full Phase A–D regression suite passes (zero regressions)
7. No new `GoalAdmissionPolicy` path is reachable through agent output
