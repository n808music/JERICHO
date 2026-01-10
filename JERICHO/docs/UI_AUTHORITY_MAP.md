# UI Authority Map

This map classifies core Jericho UI panels/controls by authority and documents their wiring.

Legend:
- **AUTHORITATIVE**: writes to source-of-truth (state/events)
- **ADVISORY**: configures suggestions/behavior but does not write unless applied
- **REFLECTIVE**: read-only derived display

| ID | Label | Authority | Unit | Scope | Reads | Writes | Enforced By | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| goal.intake.family | Goal family selector | AUTHORITATIVE | goal.family | cycle | — | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan | Equation survey input |
| goal.intake.target | Goal target value | AUTHORITATIVE | goal.target | cycle | — | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan | Equation survey input |
| goal.intake.deadline | Goal deadline | AUTHORITATIVE | dayKey | cycle | — | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan | Equation survey input |
| goal.intake.constraints | Goal constraints + non-negotiables | AUTHORITATIVE | constraint flags | cycle | — | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan | Equation survey input |
| goal.intake.submit | Compile goal equation | AUTHORITATIVE | plan proof | cycle | goalEquation inputs | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan | Compiles plan proof + cold plan |
| tabs.structure | Structure tab | AUTHORITATIVE | — | ui | — | ZionDashboard:setZionView | — | View switch only |
| tabs.today | Today tab | AUTHORITATIVE | — | ui | — | ZionDashboard:setZionView | — | View switch only |
| tabs.stability | Stability tab | AUTHORITATIVE | — | ui | — | ZionDashboard:setZionView | — | View switch only |
| today.nav.prev | Prev nav | AUTHORITATIVE | day | day | anchorDayKey | ZionDashboard:shiftAnchor | window.ts | — |
| today.nav.next | Next nav | AUTHORITATIVE | day | day | anchorDayKey | ZionDashboard:shiftAnchor | window.ts | — |
| today.nav.today | Jump to today | AUTHORITATIVE | day | day | appTime.activeDayKey | identityStore:jumpToToday | time helpers | — |
| addBlock.submit | Add block | AUTHORITATIVE | blocks | day | AddBlockBar state | identityStore:createBlock | identityCompute:createBlock | Creates committed blocks |
| addBlock.linkGoal | Link to active goal | ADVISORY | — | goal | AddBlockBar state | — | — | Payload metadata only |
| addBlock.linkDeliverable | Link to deliverable / criterion | ADVISORY | — | deliverable | AddBlockBar state | — | — | Payload metadata only |
| proposedBlocks.panel | Auto Schedule view (proposed blocks) | REFLECTIVE | blocks | cycle | suggestedBlocks/autoAsanaPlan | — | — | Ghost blocks only |
| suggestedPath.generatePlan | Generate plan | AUTHORITATIVE | suggestions | cycle | planDraft, contract | identityStore:generatePlan | identityCompute:generatePlan | Produces suggestedBlocks + autoAsanaPlan |
| suggestedPath.applyPlan | Apply plan (materialize) | AUTHORITATIVE | blocks | cycle | autoAsanaPlan | identityStore:applyPlan | identityCompute:applyGeneratedPlan | Materializes blocks |
| suggestedPath.accept | Accept suggestion | AUTHORITATIVE | blocks | cycle | suggestion | identityStore:acceptSuggestedBlock | identityCompute:acceptSuggestedBlock | Creates committed block |
| suggestedPath.ignore | Ignore suggestion | AUTHORITATIVE | suggestions | cycle | suggestion | identityStore:ignoreSuggestedBlock | identityCompute:ignoreSuggestedBlock | Marks ignored |
| suggestedPath.dismiss | Dismiss suggestion | AUTHORITATIVE | suggestions | cycle | suggestion | identityStore:dismissSuggestedBlock | identityCompute:dismissSuggestedBlock | Marks rejected |
| acceptedBlocks.panel | Committed schedule (accepted blocks) | REFLECTIVE | blocks | cycle | materialized blocks | — | todayAuthority | Committed only |
| acceptedBlocks.complete | Complete block | AUTHORITATIVE | events | day | blockId | identityStore:completeBlock | identityCompute:completeBlock | Evidence event |
| acceptedBlocks.reschedule | Reschedule block | AUTHORITATIVE | events | day | blockId | identityStore:rescheduleBlock | identityCompute:rescheduleBlock | Evidence event |
| acceptedBlocks.delete | Delete block | AUTHORITATIVE | events | day | blockId | identityStore:deleteBlock | identityCompute:deleteBlock | Evidence event |
| progress.strictMode | Strict progress mode | ADVISORY | — | ui | local state | — | — | UI enforcement only |
| whatMovedToday.panel | What moved today | REFLECTIVE | criteria | day | whatMovedToday selector | — | — | Derived from criterion closures |
| deliverables.panel | Deliverables editor | AUTHORITATIVE | deliverables | cycle | deliverablesByCycleId | identityStore:create/update/delete | identityCompute reducers | Cycle-scoped |
| criteria.panel | Criteria editor | AUTHORITATIVE | criteria | cycle | deliverablesByCycleId | identityStore:create/toggle/delete | identityCompute reducers | Cycle-scoped |
| goal.compile | Compile goal equation | AUTHORITATIVE | plan proof | cycle | goalEquation inputs | identityStore:compileGoalEquation | goalEquation:compileGoalEquationPlan | Cold plan compiler |
| strategy.save | Save strategy | AUTHORITATIVE | plan constraints | cycle | StrategyPanel state | identityStore:setStrategy | coldPlan | Advisory plan inputs |
| strategy.regenerate | Regenerate route | AUTHORITATIVE | cold plan | cycle | StrategyPanel state | identityStore:generateColdPlan | coldPlan | Forecast only |
| strategy.rebase | Re-base from today | AUTHORITATIVE | cold plan | cycle | StrategyPanel state | identityStore:rebaseColdPlan | coldPlan | Forecast only |
| truthPanel.addEntry | Truth panel add entry | AUTHORITATIVE | entries | cycle | TruthPanel state | identityStore:addTruthEntry | renderTruthPanel | Append-only |
| patternLens.panel | Pattern lens | REFLECTIVE | minutes | cycle | materialized blocks | — | todayAuthority | Read-only diagnostics |
| stability.panel | Stability tab | REFLECTIVE | score | cycle | probability/stability selectors | — | probabilityScore/stability | Derived outputs |
| proof.planProof | Plan proof panel | REFLECTIVE | plan proof | cycle | planProof | — | planProof | Derived math |
| proof.probability | Probability report panel | REFLECTIVE | probability | cycle | probabilityReport | — | probabilityScore | Derived math |
| proof.conflicts | Plan conflicts/recovery | REFLECTIVE | conflicts | cycle | autoAsanaPlan | — | autoAsanaPlan | Derived conflicts |
| cycle.switch | Cycle switcher | AUTHORITATIVE | cycle | cycle | cycle index | identityStore:setActiveCycle | identityCompute | Guards deleted cycles |
| cycle.new | New cycle | AUTHORITATIVE | cycle | cycle | active cycle | identityStore:startNewCycle | identityCompute | Ends prior cycle first |
