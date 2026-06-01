# Freeze Candidate Changelog 1.0.6.3 (Post-Canonical P.O.S.)

Date: March 9, 2026  
Branch: `proof-1.0.6`

## What This Tranche Fixed

- Enforced canonical precedence in reducer-critical scheduling paths:
  - canonical contract selection in generate/apply
  - canonical action selection over `llmActionGraph.actions`
  - canonical proposal source in apply path
- Added mirror visibility in development/test:
  - warns when canonical + mirror coexist
  - warns on drift between canonical and mirror payloads
- Extended canonical ownership into Stability / P.O.S.:
  - P.O.S. now uses canonical feasibility/throughput basis
  - deterministic unavailable reason codes replace meaningless placeholder
    behavior

## Before / After Behavior Delta

- Before:
  - critical flows still had mirror fallback risk in reducer and scoring paths
  - missing P.O.S. basis could degrade to generic placeholder behavior
- After:
  - reducer-critical contract/action/proposal reads are canonical-first
  - mirrors are adapter visibility surfaces, not co-equal owners
  - P.O.S. returns either:
    - a real value from canonical scoring inputs, or
    - explicit deterministic reason code (`POS_THROUGHPUT_MODEL_MISSING`,
      `POS_FEASIBILITY_INPUT_MISSING`)

## Targeted Test Evidence (Exact Run)

Command executed:

```bash
npm run test -- tests/state/cycleSelectors.canonicalPrecedence.test.js tests/state/schedule.generate.actionsCanonicalPrecedence.test.js tests/state/applyDraftSchedule.canonicalSource.test.js tests/state/scheduling.chain.minimalFixture.test.js tests/state/scoring.pos.canonicalChain.test.js tests/components/ZionDashboard.pos.postcondition.test.jsx
```

Result excerpt:

```txt
Test Files  6 passed (6)
Tests  18 passed (18)
Duration  2.94s
```

Evidence highlights:

- `tests/state/cycleSelectors.canonicalPrecedence.test.js`
  - canonical selectors outrank mirrors/adapters.
- `tests/state/schedule.generate.actionsCanonicalPrecedence.test.js`
  - generate path uses canonical `cycle.actions` and canonical contract
    precedence.
- `tests/state/applyDraftSchedule.canonicalSource.test.js`
  - apply path consumes canonical proposed blocks and canonical contract
    precedence.
- `tests/state/scheduling.chain.minimalFixture.test.js`
  - generate -> apply -> render chain succeeds using canonical proposed +
    committed sources.
- `tests/state/scoring.pos.canonicalChain.test.js`
  - scoring reads canonical inputs and emits deterministic reason code when
    basis is absent.
- `tests/components/ZionDashboard.pos.postcondition.test.jsx`
  - Stability panel renders P.O.S. and deterministic explanation states.

## Mirror Status (Adapter-Only Statement)

- Remaining mirrors (`state.goalExecutionContract`, `cycle.contract`,
  `state.suggestedBlocks`, `cycle.suggestedBlocks`,
  `cycle.llmActionGraph.actions`) are compatibility adapters.
- Canonical fields are authoritative when populated.
- Mirror fallback reads are retained only for compatibility and are instrumented
  with dev/test warnings.
