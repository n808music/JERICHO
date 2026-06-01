# PLAN_QUALITY_3_SALES_PIPELINE_BUILDER_FREEZE_PACKAGE.md

## Status

Closed.

Repo-wide verification is clean on the current tree.

### Final verification

- `npm run check-all`
- Result: pass
- `329` test files passed
- `1342` tests passed
- Duration: `164.64s`

---

## Scope of this slice

This slice migrated `SalesPipeline` from the older static action scaffold to the
builder-derived pattern already proven in other lanes.

Core builder rule preserved:

- preserve object
- preserve operation
- preserve output/proof
- preserve context

Evaluator doctrine, plan-quality admission logic, and UI truth-surface behavior
were not changed in this slice.

---

## Root change

`SalesPipeline` no longer relies on the static graph in `mockLLMActionGraph`.

It now flows through:

- object-bearing core deliverables
- builder-aligned execution-type metadata
- deliverable-derived sales actions

This makes the live lane preserve offer, targeting, outreach, discovery,
proposal, negotiation, and onboarding-handoff substance instead of generic
pipeline phase language.

---

## Canonical implementation points

### Core deliverables

- [autoDeliverables.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/core/autoDeliverables.ts)

### Action-graph builder path

- [mockLLMActionGraph.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/mockLLMActionGraph.ts)

### Execution-type validator metadata

- [llmActionGraph.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/llmActionGraph.ts)

---

## Files changed

- [autoDeliverables.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/core/autoDeliverables.ts)
- [autoDeliverables.test.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/core/__tests__/autoDeliverables.test.ts)
- [mockLLMActionGraph.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/mockLLMActionGraph.ts)
- [llmActionGraph.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/llmActionGraph.ts)
- [mockLLMActionGraph.salesPipeline.test.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/state/mockLLMActionGraph.salesPipeline.test.ts)
- [mockLLMActionGraph.newArchetypes.test.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/state/mockLLMActionGraph.newArchetypes.test.ts)

---

## Before / After

### Before

Static scaffold examples:

- `Clarify offer, pricing tiers, and qualification criteria`
- `Define ICP and build first target account list`
- `Create outreach scripts and objection-handling library`
- `Execute follow-up and negotiation sequence`
- diagnostics note: `Mock graph for SalesPipeline.`

The structure was usable, but it was still a fixed scaffold rather than a
builder-derived lane.

### After

Builder-derived sales path examples:

- `Capture offer scope, pricing logic, and qualification rules for offer, pricing tiers, and qualification criteria`
- `Define ICP signals, account filters, and lead-priority scoring for ICP and build first target account list`
- `Prepare outreach messaging, objection handling, and reply branches for outreach scripts and objection-handling library`
- `Prepare discovery agenda, qualification notes, and opportunity criteria for discovery calls and qualify active opportunities`
- `Prepare proposal structure, pricing options, and implementation terms for tailored proposal packages for qualified leads`
- `Prepare negotiation plan, follow-up timing, and commitment tracking for follow-up and negotiation sequence`
- `Prepare onboarding summary, closed-won notes, and handoff details for onboarding handoff package`
- diagnostics note:
  `Mock graph for SalesPipeline goals derived from admitted contract deliverables.`

---

## Important reconciliation in this slice

One real cross-layer mismatch surfaced and was corrected:

- the domain-side SalesPipeline builder already included onboarding handoff
- the core auto-deliverable path did not

That meant the live builder graph would have stopped at negotiation even though
the broader lane grammar already carried handoff.

The fix was applied at the core deliverable layer:

- add `Close deals and prepare onboarding handoff package`

This kept the lane aligned end to end without weakening tests or mutating
downstream logic.

---

## Validator alignment

The lane also needed explicit execution-type metadata in the action-graph
validator.

`SalesPipeline` had been falling through to `GenericStructured` metadata, which
misclassified the correct category and range expectations for the new
builder-derived graph.

The smallest correct fix was:

- add `SalesPipeline` to execution-type metadata in
  [llmActionGraph.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/state/llmActionGraph.ts)

This was validator alignment, not product-logic expansion.

---

## Focused verification

### Focused tests

- [autoDeliverables.test.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/core/__tests__/autoDeliverables.test.ts)
- [mockLLMActionGraph.salesPipeline.test.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/state/mockLLMActionGraph.salesPipeline.test.ts)
- [mockLLMActionGraph.newArchetypes.test.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/tests/state/mockLLMActionGraph.newArchetypes.test.ts)
- [RevenueCapitalPolicy.crossDomain.test.ts](/Users/jamesdotson/vscode/JERICHO/JERICHO/src/domain/goal/RevenueCapitalPolicy.crossDomain.test.ts)

### Focused command

```bash
npm run test -- src/core/__tests__/autoDeliverables.test.ts tests/state/mockLLMActionGraph.salesPipeline.test.ts tests/state/mockLLMActionGraph.newArchetypes.test.ts src/domain/goal/RevenueCapitalPolicy.crossDomain.test.ts --reporter=verbose
```

### Focused result

- `4` files passed
- `52` tests passed

---

## Verification discipline

The lane was not declared complete until repo-wide verification passed after:

- builder-path implementation
- core/domain deliverable alignment
- validator metadata alignment
- formatting cleanup

No stale harness issue was misattributed to the lane in this pass.

---

## Evaluator doctrine

Unchanged.

This slice did not modify:

- plan-quality gate doctrine
- evaluator codes
- feasibility/P.O.S. admission rules
- UI truth-surface logic

The change stayed inside generation and validator alignment for the
`SalesPipeline` lane.

---

## Milestone conclusion

The SalesPipeline builder-path slice is closed.

SalesPipeline now follows the builder-derived lane pattern instead of the older
static scaffold, with core deliverables, validator metadata, and live action
generation aligned around offer, targeting, outreach, conversion, and
onboarding-handoff outputs.

Canonical verification is clean on the current tree.
