# GOAL_TO_DELIVERABLE_BASELINE_AUDIT

## Scope

Phase A baseline trace for three archetypes:

1. `ProfessionalQualification` (certification/exam)
2. `GenericStructured.TVWriting` (content/show-writing path)
3. `VentureLaunch` (fundraising/launch path)

## Current generation path (pre-migration baseline)

| Archetype                    | Current generator entry point                                                                                                  | Current emitted object type(s)                                                                                            | True deliverables existed?                                                                        | Downstream action derivation path                                                                  | Scheduler input dependency                                                                   | Migration risk notes                                                                                               |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| ProfessionalQualification    | `src/state/storeLLMActions.ts` -> `callClaudeForActionGraph` -> `GENERATE_PLAN_WITH_ACTIONS` in `src/state/identityCompute.js` | `cycle.actions[]` plus optional legacy workspace `deliverables[]`                                                         | Partially: action payload had `deliverable` strings, but no canonical deliverable object contract | Actions already canonicalized via `cycle.actions`; workspace deliverables were not source-of-truth | `generatePlan()` consumes `getCanonicalCycleActions(cycle)` and emits `state.proposedBlocks` | No break risk if deliverable compilation is additive and action path stays unchanged                               |
| GenericStructured TV writing | Same as above, with TV-specialized mock graph branch in `src/state/mockLLMActionGraph.ts` (`isTvWritingGoal`)                  | Action graph with TV-output strings in `action.deliverable`; legacy phase-like workspace could still appear in some paths | Partially: outputs embedded as strings in actions, not typed first-class deliverables             | `cycle.actions` used by `compileAutoAsanaPlan` in `generatePlan()`                                 | `actionSequence` in `generatePlan()`                                                         | Risk: semantic drift if phase rows remain mislabeled; mitigated by typed deliverable compile + scaffold separation |
| VentureLaunch                | Same LLM path (`VentureLaunch` graph in `mockLLMActionGraph.ts`)                                                               | Action graph with deliverable strings, no canonical deliverable object set                                                | Partially: output semantics present in action strings only                                        | `GENERATE_PLAN_WITH_ACTIONS` writes actions; scheduler reads actions                               | `compileAutoAsanaPlan` action sequence                                                       | Risk: losing output contract if action-only assumptions persist; solved by compile bridge                          |

## Key baseline findings

- For selected archetypes, output semantics already exist in action graph fields
  (`deliverable`, `definitionOfDone`), but were not persisted as canonical
  deliverable objects.
- Scheduler already depends primarily on canonical actions (`cycle.actions`) and
  not on deliverable workspace shape.
- This enables minimal-blast migration: compile canonical deliverables from
  action graph, keep scheduler path unchanged, and bridge deliverables into
  existing workspace schema.

## Phase A migration decision

- Introduce canonical deliverable compiler for selected archetypes only.
- Persist compiled deliverables into active cycle workspace with compatibility
  fields (`requiredBlocks`, `criteria`) so existing UI/runtime paths continue to
  work.
- Preserve non-selected archetypes on legacy path for now, explicitly marked via
  compiler summary (`legacyFallbackUsed: true`).
