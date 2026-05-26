# JERICHO Agent Integration Assessment

## Phase F — Agent Boundary Design

**Date:** 2026-03-26 **Branch:** proof-1.0.6 **Status:** Assessment artifact —
no production code changes

---

## 1. Purpose of Phase F

Phase F determines where agent capabilities can be safely added to JERICHO
without compromising the deterministic execution-engine core that Phases A–D
established and validated.

The system already has:

- 9 canonical archetypes with hardened classification
- Bounded composition detection (Phases B–C)
- Apply → Activate lifecycle with deterministic scheduling
- P.O.S. trust/gating with externally-mediated evidence rules
- End-to-end chain validation across all archetypes (Phase D)
- Existing LLM infrastructure in embryonic form (`storeLLMActions.ts`,
  `llmActionGraph.ts`, `mockLLMActionGraph.ts`)

Agents are being assessed because certain surfaces — intake ambiguity
resolution, classification explanation, recovery narration — have
human-conversation structure that pure deterministic rules cannot efficiently
handle. These surfaces are already identified as soft in the architecture (e.g.,
`GoalIntakeContract.requiredContextQuestions[]`, `IntakeGateCode`,
`IntakeReadinessState`).

Phase F does not introduce agents to compensate for gaps in the core. The core
is stable. Phase F introduces agents only where advisory assistance is clearly
bounded and reversible.

---

## 2. Core Invariant

**Agents may assist the machine. They may not become the machine.**

This invariant is not a preference. It is a structural constraint enforced at
every integration point. An agent that silently becomes authoritative in any
core decision slot has failed its Phase F acceptance criteria regardless of
output quality.

The specific corollary:

> An agent's output is always a **candidate** until the deterministic core
> approves it. No agent output is stored in authoritative state without passing
> through a deterministic gate.

---

## 3. Current Deterministic Surfaces That Remain Authoritative

The following are non-negotiable. No agent role may override, silently rewrite,
or bypass these:

| Surface                                                    | Owner                                       | Key function / file                                                   |
| ---------------------------------------------------------- | ------------------------------------------- | --------------------------------------------------------------------- |
| Execution-type ontology (9 archetypes)                     | Deterministic classifier                    | `classifyLiveInputToArchetype()` in `archetypeLiveTraceEvaluation.ts` |
| Goal admission status                                      | GoalAdmissionPolicy                         | `validateGoalAdmission()` in `GoalAdmissionPolicy.ts`                 |
| Blocked / draft / admitted state transitions               | IdentityStore reducer                       | `identityStore.js` `ADMIT_GOAL` action                                |
| Completion boundary authority                              | ExecutionContract                           | `canEmitExecutionEvent()` in `executionContract.ts`                   |
| Required vs recommended scope rules                        | GoalIntakeContract + AdmissionPolicy        | `GoalAdmissionPolicy.ts`, `GoalIntakeContract.ts`                     |
| Family grammar ownership                                   | Composition detector + archetype rules      | `compositionDetector.ts`                                              |
| Composition ownership rules                                | CompositionDetector                         | `detectSecondaryArchetype()`                                          |
| Schedule lifecycle semantics (Generate → Apply → Activate) | DraftSchedule reducer                       | `draftSchedule.js` `APPLY_DRAFT_SCHEDULE`                             |
| Active required block authority                            | TodayAuthority + ExecutionContract          | `todayAuthority.ts`, `executionContract.ts`                           |
| P.O.S. scoring / trust / gating                            | ProbabilityScore + ProbabilityEligibility   | `probabilityScore.ts`, `probabilityEligibility.ts`                    |
| External evidence gating                                   | ProbabilityScore QUALIFYING_EXTERNAL_STAGES | `probabilityScore.ts` lines ~440–480                                  |
| Final stored execution contract                            | GoalAdmissionPolicy + Store                 | `GoalAdmissionPolicy.ts` + `identityStore.js`                         |
| Inscription hash verification                              | GoalAdmissionPolicy                         | `INSCRIPTION_MISSING`, `INSCRIPTION_NOT_IMMUTABLE` codes              |
| Causal chain completeness                                  | GoalAdmissionPolicy                         | `CAUSAL_CHAIN_INCOMPLETE`, `CAUSAL_CHAIN_CIRCULAR`                    |

Any agent integration that touches these surfaces must be read-only and produce
only advisory output, never modifying stored state directly.

---

## 4. Allowed Agent Role Catalog

### Role A — Intake Drafting Assistant

**Purpose:** Help users resolve ambiguity in goal text before the deterministic
intake gate fires.

**Trigger condition:**
`GoalIntakeContract.readiness.isReadyForPlanning === false`, i.e., the
`buildGoalIntakeContract()` function has returned `requiredContextQuestions[]`
that are unanswered, or `IntakeGateCode` is not `'INTAKE_OK'`.

**What the agent may do:**

- Read raw goal text from `goalDraftV2.goalText` or `goalDraftV2.goalLabel`
- Read `GoalIntakeContract.requiredContextQuestions[]`
- Generate natural-language clarification conversation to help user answer the
  required questions
- Suggest candidate answers to `requiredContextQuestions` for user confirmation
- Produce a draft `answeredContext` map that the user reviews and confirms
  before submission

**What the agent may not do:**

- Write to `goalContract.executionType` — user selects from the 10-option
  dropdown; agent may suggest but not set
- Write to `goalContract.terminalOutcome` directly — agent may draft text, user
  must explicitly confirm
- Call `validateGoalAdmission()` on the user's behalf
- Bypass the `IntakeGateCode` check by simulating readiness
- Fabricate `requiredContextQuestions` answers that the user hasn't confirmed

**Output class:** `CandidateIntakeDraft` — a structured set of suggested answers
to required intake questions, explicitly labeled as unconfirmed. Stored
transiently; only promoted to contract state after user review.

**Risk level:** Low. The deterministic intake gate still fires after the agent
session. The agent can only shorten the time users spend resolving
required-context questions.

---

### Role B — Classification Diagnostic Assistant

**Purpose:** Explain why a goal was classified to a specific archetype, what
that classification means for the plan shape, and what the user can do if the
classification feels wrong.

**Trigger condition:** After `classifyLiveInputToArchetype()` runs and returns
an archetype. This is a post-classification, pre-admission advisory layer.

**What the agent may do:**

- Read the classified archetype from state
- Read the `LiveTraceRunSummary` returned by `archetypeLiveTraceEvaluation.ts`
- Produce a natural-language explanation of what signals in the goal text drove
  the classification
- Explain what the classified archetype's deliverable shape looks like (phases,
  milestones, bridge patterns)
- Surface any detected composition pair (`detectSecondaryArchetype()` output)
  and explain its implications
- Recommend alternative archetypes for user consideration if classification
  confidence is borderline

**What the agent may not do:**

- Override the classification decision — only the user can select a different
  execution type from the dropdown
- Write to `goalContract.executionType` — this is a user action
- Claim that a re-classified archetype is guaranteed to produce better results
- Suppress the composition detection result by explaining it away

**Output class:** `ClassificationExplanation` — a read-only narrative summary.
Never stored in authoritative state. Dismissed after user proceeds.

**Risk level:** Very low. Entirely read-only. Worst case: a confusing
explanation that the user ignores.

---

### Role C — Recovery Explanation Assistant

**Purpose:** Translate machine-generated `DriftSignal` + `FailureClassCode` +
`RecoveryLeverCode` output into human-readable, actionable explanation for users
whose plans are in recovery mode.

**Trigger condition:** `driftSignalDetector.detectDriftSignals()` has returned
signals with `severity: 'critical'` or `severity: 'warning'`, and
`failureClassMapper.mapFailureClasses()` has produced one or more
`FailureClassResult` entries.

**What the agent may do:**

- Read `DriftSignal[]`, `FailureClassResult[]`, `RecoveryLeverCode[]`
- Read `RecoveryAdjustment` from `laneSpecificAdjustment()` in
  `recoveryRecommendationEngine.ts`
- Produce natural-language explanation of what is failing and why
- Produce a ranked list of recovery lever options with plain-English tradeoffs
  (derived from machine output)
- Ask the user clarifying questions if the recovery lever has ambiguous
  implications

**What the agent may not do:**

- Apply a recovery lever — levers are confirmed by user action, not the agent
- Modify the plan or schedule based on recovery signals
- Override drift severity scores
- Invent drift signals not produced by `detectDriftSignals()`

**Output class:** `RecoveryNarration` — a read-only advisory. The user confirms
lever application through normal store actions.

**Risk level:** Low. All inputs come from deterministic detectors. Agent is a
translator, not a decision-maker.

---

### Role D — Lane/Spec Authoring Assistant (Deferred)

**Purpose:** Draft new archetype grammar specs, acceptance criteria, and
`BRIDGE_DELIVERABLES_BY_PAIR` entries for developer review when extending to new
archetypes.

**Trigger condition:** Developer is authoring a new archetype or composition
pair.

**What the agent may do:**

- Draft a candidate archetype specification following the existing template
  structure
- Draft bridge deliverable specs following the `BridgeDeliverableSpec` type
  shape
- Generate draft acceptance criteria and definitions-of-done

**What the agent may not do:**

- Commit specs to the archetype matrix without developer review and test gate
- Override existing archetype boundary definitions

**Output class:** Draft spec documents for developer review. Not schema-enforced
until tests pass.

**Risk level:** Very low in dev context. Deferred to later wave.

---

### Role E — Deliverable Wording Refinement Assistant (Deferred)

**Purpose:** Improve `definitionOfDone`, `title`, and `acceptanceCriteria`
wording on compiled deliverables before the user reviews the proposed plan.

**Trigger condition:** `compileGoalToDeliverables()` has returned a result and
the user is in pre-commit review.

**What the agent may do:**

- Suggest reworded `definitionOfDone` strings that are clearer or more
  measurable
- Flag `acceptanceCriteria` items that fail the "is this verifiable?" test

**What the agent may not do:**

- Change `deliverableId`, `actionIds`, `dependencyIds`, or structural fields
- Modify the number of deliverables
- Change `outputType`, `sourceType`, or `evidenceType`

**Output class:** `CandidateDeliverableWording` — suggestions only. User must
explicitly adopt them.

**Risk level:** Low, but has more footprint than Roles A–B. Deferred to 1.1.

---

## 5. Forbidden Agent Role Catalog

The following agent role shapes are explicitly prohibited in JERICHO regardless
of implementation quality:

| Forbidden role                   | Why forbidden                                                                                    |
| -------------------------------- | ------------------------------------------------------------------------------------------------ |
| Final execution-type decider     | `classifyLiveInputToArchetype()` is authoritative; agent may advise, not decide                  |
| Completion boundary setter       | `canEmitExecutionEvent()` enforces lifecycle; agent cannot grant completion                      |
| Authoritative contract generator | `validateGoalAdmission()` must gate every admission; no agent bypass                             |
| Trust-state override             | `derivePosDisplayPolicy()` + eligibility gating is deterministic; agent cannot promote           |
| External evidence fabricator     | `QUALIFYING_EXTERNAL_STAGES` are concrete events; agent cannot create synthetic evidence         |
| Authoritative scheduler          | `APPLY_DRAFT_SCHEDULE` and `GENERATE_SCHEDULE` are deterministic reducers; agent cannot schedule |
| Active block mutator             | `canEmitExecutionEvent()` governs all block mutations; agent cannot touch active required blocks |
| Admission bypass mechanism       | No agent may call `ADMIT_GOAL` on behalf of a contract that hasn't passed policy validation      |
| Family grammar rewriter          | Archetype boundaries, composition pairs, and bridge specs are schema-enforced; not freeform      |
| Silent scope reducer             | Required scope (from `GoalAdmissionPolicy`) cannot be quietly removed by an agent explanation    |

These prohibitions apply even when the agent output quality is high. The
constraint is architectural, not quality-dependent.

---

## 6. Bounded Insertion Points

For each allowed role, the exact system stage where the agent enters and exits:

### A — Intake Drafting Assistant

```
[User types raw goal text]
      ↓
[buildGoalIntakeContract() runs — deterministic]
      ↓
[IntakeGateCode check: INTAKE_OK?]
      ↓ (if NOT OK)
[*** AGENT ENTERS HERE ***]
  - Reads: rawGoalText, IntakeGateCode, requiredContextQuestions[]
  - Produces: CandidateIntakeDraft (suggested answers to required questions)
  - User reviews candidate answers, confirms or adjusts
[*** AGENT EXITS HERE ***]
      ↓
[User-confirmed answers update goalDraftV2.answeredContext]
      ↓
[buildGoalIntakeContract() re-runs — deterministic (isReadyForPlanning gate)]
      ↓
[generatePlanWithLLM() proceeds (action graph generation via existing LLM path)]
```

The agent does NOT touch the plan generation call. It only helps prepare the
intake inputs.

### B — Classification Diagnostic Assistant

```
[classifyLiveInputToArchetype(goalText) — deterministic]
      ↓
[getLiveTraceActionsForArchetype(archetype) — deterministic]
      ↓
[detectSecondaryArchetype(goalText, archetype) — deterministic]
      ↓
[*** AGENT ENTERS HERE (read-only) ***]
  - Reads: classified archetype, LiveTraceRunSummary, composition pair if present
  - Produces: ClassificationExplanation (narrative, read-only)
  - User reads explanation, proceeds or manually changes execution type dropdown
[*** AGENT EXITS HERE ***]
      ↓
[User confirms or changes execution type — user action, not agent]
      ↓
[GoalAdmissionPage.tsx gated admission flow continues — deterministic]
```

### C — Recovery Explanation Assistant

```
[detectDriftSignals(input) — deterministic]
      ↓
[mapFailureClasses({archetype, driftSignals, contextState}) — deterministic]
      ↓
[baseLeversForFailure() + laneSpecificAdjustment() — deterministic]
      ↓
[*** AGENT ENTERS HERE (read-only) ***]
  - Reads: DriftSignal[], FailureClassResult[], RecoveryLeverCode[], RecoveryAdjustment
  - Produces: RecoveryNarration (natural-language explanation + ranked lever options)
  - User reads, selects lever to apply via store action
[*** AGENT EXITS HERE ***]
      ↓
[User-triggered store action applies selected lever — deterministic reducer]
```

---

## 7. Output Classes

| Output class                  | Contents                                                 | Authoritative? | Storage                        |
| ----------------------------- | -------------------------------------------------------- | -------------- | ------------------------------ |
| `CandidateIntakeDraft`        | Suggested answers to `requiredContextQuestions[]`        | No             | Transient UI state only        |
| `ClassificationExplanation`   | Narrative explanation of archetype, signals, composition | No             | Never stored                   |
| `RecoveryNarration`           | Plain-English drift → failure → lever explanation        | No             | Never stored                   |
| `CandidateDeliverableWording` | Suggested `definitionOfDone` / `title` rewording         | No             | Transient, user-confirmed only |

**Rule for all output classes:** No agent output may be stored in authoritative
state (e.g., `cycle.goalContract`, `executionEvents`, `proposedBlocks`) without:

1. Passing through the relevant deterministic validation function, AND
2. A user confirmation action (not automated)

---

## 8. Recommended Minimal First Implementation Set

**Implement in Phase F 1.0:** Role A + Role B only.

### Why Role A (Intake Drafting Assistant) first

- The existing infrastructure is already largely in place:
  - `GoalIntakeContract.requiredContextQuestions[]` is already generated
    deterministically
  - `storeLLMActions.ts` already calls the LLM path for action graph generation
  - `getIntakeGateCode()` and `buildGoalIntakeContract()` already identify
    blocking conditions
- The insertion point is pre-gate, fully advisory, and clearly bounded
- The user benefit is concrete: faster resolution of intake ambiguity without
  policy bypass
- The risk is the lowest of all roles: agent cannot cause admission of an
  invalid goal

### Why Role B (Classification Diagnostic Assistant) second

- Entirely read-only — no state risk
- The classified archetype and trace summary are already computed by the time
  this fires
- Users frequently don't understand why the system chose a particular archetype
  or what it means
- Builds trust in the deterministic classifier by making its logic transparent
- No new store state required

### Why Role C (Recovery) is deferred

- Recovery explanation requires the drift + failure + lever pipeline to be
  exercised in production
- Recovery is a later-lifecycle concern; intake and classification are earlier
  and more frequently hit
- Adding a third role in Phase F increases assessment surface without
  proportional payoff

### Why Roles D and E are deferred

- Role D (Lane authoring) is developer-only; not a user-facing Phase F concern
- Role E (Deliverable wording) adds footprint at a sensitive layer (deliverable
  identity fields) before the simpler advisory roles are proven

---

## 9. Guardrails

### For all agent roles in Phase F

1. **Read-only from core state.** Agents read from the store; they do not
   dispatch to the store directly. All store mutations happen through normal
   store actions, triggered by explicit user confirmation.

2. **No agent output stored without deterministic gate.** Any content the user
   accepts from an agent must pass through the same validation path as manually
   entered content.

3. **Explicit provenance tagging.** Any candidate content produced by an agent
   is tagged with `source: 'agent_draft'` so the UI can display appropriate
   qualification labels (e.g., "AI-suggested"). This tag is removed when the
   user explicitly confirms the content.

4. **Failure-safe default.** If the agent call fails (network error, timeout,
   bad response), the system falls back to the manual flow. No agent failure may
   block goal admission or plan generation.

5. **No prompt injection from goal text.** Goal text passed to the agent must be
   sanitized to prevent prompt injection. The agent's system prompt must
   explicitly state it cannot modify admission policy.

6. **Output schema validation.** Agent responses must be parsed against the
   relevant output schema (`CandidateIntakeDraft`, `ClassificationExplanation`)
   before display. Malformed responses are discarded, not displayed.

7. **Model pinning.** Use `claude-sonnet-4-6` (or the specific version pinned in
   `LLM_CALL_PROFILES`). Do not use model names without explicit version. The
   existing `LLM_CALL_PROFILES` pattern in `llmActionGraph.ts` should be
   extended to cover agent roles.

8. **No recursive agent calls.** An agent role may not invoke another agent
   role. All agent calls are leaf nodes in the execution graph.

---

## 10. Acceptance Criteria

### Role A — Intake Drafting Assistant

- [ ] Agent is only invoked when `IntakeGateCode !== 'INTAKE_OK'`
- [ ] Agent output is displayed with a clear "AI-suggested" qualifier in the UI
- [ ] User must explicitly confirm each suggested answer before it is applied to
      `answeredContext`
- [ ] After agent session, `buildGoalIntakeContract()` re-runs deterministically
      with confirmed answers
- [ ] If agent fails, user can still manually answer
      `requiredContextQuestions[]`
- [ ] Agent cannot produce an `answeredContext` that causes
      `isReadyForPlanning = true` if the gate would otherwise block (i.e., the
      gate must re-run, not be bypassed)
- [ ] Agent output contains no new required fields not already in
      `GoalIntakeContract`
- [ ] Agent call failure produces a fallback UI message, not an error state that
      blocks admission

### Role B — Classification Diagnostic Assistant

- [ ] Agent is only invoked after `classifyLiveInputToArchetype()` returns a
      result
- [ ] Agent output is never stored in any persistent state
- [ ] Agent cannot change `goalContract.executionType` — only the user dropdown
      can
- [ ] Explanation accurately describes the classified archetype's canonical
      deliverable shape
- [ ] If composition was detected, explanation accurately describes the
      composition pair
- [ ] Explanation is dismissed cleanly when the user proceeds — no residual
      state
- [ ] Agent call failure produces a dismissible UI message; admission flow
      continues normally

### Both roles

- [ ] Zero regressions on Phase A–D test suite (49 Phase D tests + all prior)
- [ ] No new `GoalAdmissionPolicy` violations possible through agent output
      paths
- [ ] `storeLLMActions.ts` pattern respected: async work outside reducers,
      results dispatched in
- [ ] `LLM_CALL_PROFILES` extended with named profiles for agent roles (not
      ad-hoc API calls)

---

## 11. Deferred Agent Roles / Later-Wave Possibilities

| Role                             | When to revisit               | Condition for promotion                                                            |
| -------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------- |
| Role C — Recovery Explanation    | Phase G or 1.1                | Recovery pipeline is production-exercised; drift → failure → lever cycle is stable |
| Role D — Lane/Spec Authoring     | Developer tooling wave        | New archetype authoring is needed at scale                                         |
| Role E — Deliverable Wording     | 1.1 post-admission UX         | Role A and B proven; wording surface well-understood                               |
| Coaching assistant (unrequested) | Not recommended               | Risk of paternalistic interruption; no insertion point                             |
| Progress narration assistant     | 2.0 if needed                 | Useful only if P.O.S. output is found insufficient for user comprehension          |
| Autonomous re-scheduling agent   | Never in current architecture | Violates core invariant; schedule lifecycle is deterministic-only                  |

---

## Appendix: Existing LLM Infrastructure Inventory

The following LLM infrastructure is already present in the repo and relevant to
Phase F planning:

| File                                    | Role                                                          | Current state                          |
| --------------------------------------- | ------------------------------------------------------------- | -------------------------------------- |
| `src/state/llmActionGraph.ts`           | Real API call pipeline for action graph generation            | Implemented; bypassed in favor of mock |
| `src/state/mockLLMActionGraph.ts`       | Mock Claude responses for all execution types                 | Active; `SKIP_API_KEY_CHECK = true`    |
| `src/state/storeLLMActions.ts`          | Async store action layer; calls LLM for `PLAN_ACTION_GRAPH`   | Active; one import swap from real API  |
| `src/domain/goal/GoalIntakeContract.ts` | Deterministic intake contract builder with required questions | Active; used by storeLLMActions        |

The `storeLLMActions.ts` → `mockLLMActionGraph.ts` → `parseLLMActionGraph()` →
`validateParsedActionGraph()` pipeline is exactly the pattern that agent roles
should follow: async agent call → parse + validate output → dispatch to reducer
→ deterministic planner takes over.

Role A (Intake Drafting Assistant) extends this pipeline one stage earlier —
before `generatePlanWithLLM()` is called, not after. The infrastructure shape is
already correct.
