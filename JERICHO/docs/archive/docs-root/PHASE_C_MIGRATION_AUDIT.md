# PHASE_C_MIGRATION_AUDIT

## Scope

Phase C migrates the next bounded archetype group to canonical deliverable-first
path:

- `JobSearchPipeline`
- `PhysicalTraining`

Path target:
`goal -> canonical deliverables/milestones -> actions -> required work sessions -> proposed calendar blocks`

## Baseline audit (pre-migration)

| Archetype         | Current entry point                                | Current top-level object type(s)                                                   | Canonical deliverables present today?                                          | Key migration risk                                                          | Scheduler dependency notes                                                         |
| ----------------- | -------------------------------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| JobSearchPipeline | `storeLLMActions.ts -> GENERATE_PLAN_WITH_ACTIONS` | `cycle.actions[]`; workspace deliverables were legacy/optional                     | Partial (deliverable semantics in action fields, not canonical output objects) | Vague output drift under compressed phrasing                                | Scheduler reads `cycle.actions` via canonical selector, not workspace shape        |
| PhysicalTraining  | `storeLLMActions.ts -> GENERATE_PLAN_WITH_ACTIONS` | `cycle.actions[]`; legacy workspace deliverables flatten output/state distinctions | Partial (action deliverable strings existed, no milestone typing)              | Forcing fake deliverables where benchmark/verified states are more truthful | Scheduler remains action-sequence driven; output typing must not break action path |

## Migrated compiler semantics

- Extended canonical compiler (`goalToDeliverables.ts`) to include:
  - `JobSearchPipeline`
  - `PhysicalTraining`
- Added explicit output typing:
  - `outputType: 'deliverable' | 'milestone'`
- PhysicalTraining uses milestone typing for verifiable state outputs
  (assessment, benchmark, event/clearance-like states), while preserving
  deliverables for concrete artifacts/protocol completion.

## Milestone vs deliverable rule for PhysicalTraining

- `milestone` when the output is a verified state/benchmark/event outcome.
- `deliverable` when the output is a concrete produced artifact/protocol block
  completion.
- `scaffoldGroup` remains explicit non-output grouping and is never typed as
  top-level deliverable/milestone.

## Bridge strategy

- No scheduler redesign.
- Canonical outputs are bridged into legacy workspace shape for compatibility:
  - `requiredBlocks <- estimatedSessions`
  - `criteria <- acceptanceCriteria`
  - preserve `outputType` in workspace rows for downstream semantics.
- Scheduler still consumes canonical actions (`cycle.actions`) and proposal
  generation remains unchanged.

## Quality findings (Phase C quality gate)

- New-group quality tests pass for both archetypes:
  - anti-vagueness
  - anti-phase regression
  - definition-of-done quality
  - acceptance-criteria quality
  - action coherence
  - dependency coherence
  - session plausibility
  - coverage + scheduler readiness

## Live-trace findings (Phase C live robustness gate)

Live matrix (10 runs, 5 styles x 2 archetypes):

- pass: 10
- warn: 0
- fail: 0
- issueFrequency: {}

By archetype:

- JobSearchPipeline: 5/5 pass
- PhysicalTraining: 5/5 pass

By style:

- clean_explicit: 2/2 pass
- compressed_informal: 2/2 pass
- slightly_vague: 2/2 pass
- overloaded_multi_part: 2/2 pass
- deadline_constrained: 2/2 pass

## Corrections applied in this phase

- Extended canonical compiler migration list to include both archetypes.
- Added PhysicalTraining milestone typing (minimal support, no ontology
  rewrite).
- Extended quality coverage heuristics for JobSearchPipeline and
  PhysicalTraining.
- Extended live-trace classifier and action templates to include both
  archetypes.

## Recommendation gate

**Option A** JobSearchPipeline and PhysicalTraining are robust enough to
continue migration expansion to the next archetype group.

Evidence basis:

- structural contract tests passed
- quality tests passed
- live-trace robustness tests passed
- scheduler compatibility tests passed
