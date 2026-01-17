export type UIAuthority = 'AUTHORITATIVE' | 'ADVISORY' | 'REFLECTIVE';

export type UIAuthorityEntry = {
  id: string;
  label: string;
  authority: UIAuthority;
  unit?: string;
  scope?: string;
  reads?: string[];
  writes?: string[];
  enforcedBy?: string[];
  notes?: string;
};

export const UI_AUTHORITY_MAP: Record<string, UIAuthorityEntry> = {
  'goal.intake.family': {
    id: 'goal.intake.family',
    label: 'Goal family selector',
    authority: 'AUTHORITATIVE',
    unit: 'goal.family',
    scope: 'cycle',
    writes: ['identityStore:compileGoalEquation'],
    enforcedBy: ['goalEquation:compileGoalEquationPlan'],
    notes: 'Equation survey input; compiled on submit.'
  },
  'goal.intake.target': {
    id: 'goal.intake.target',
    label: 'Goal target value',
    authority: 'AUTHORITATIVE',
    unit: 'goal.target',
    scope: 'cycle',
    writes: ['identityStore:compileGoalEquation'],
    enforcedBy: ['goalEquation:compileGoalEquationPlan']
  },
  'goal.intake.deadline': {
    id: 'goal.intake.deadline',
    label: 'Goal deadline',
    authority: 'AUTHORITATIVE',
    unit: 'dayKey',
    scope: 'cycle',
    writes: ['identityStore:compileGoalEquation'],
    enforcedBy: ['goalEquation:compileGoalEquationPlan']
  },
  'goal.intake.constraints': {
    id: 'goal.intake.constraints',
    label: 'Goal constraints and non-negotiables',
    authority: 'AUTHORITATIVE',
    unit: 'constraint flags',
    scope: 'cycle',
    writes: ['identityStore:compileGoalEquation'],
    enforcedBy: ['goalEquation:compileGoalEquationPlan']
  },
  'goal.intake.submit': {
    id: 'goal.intake.submit',
    label: 'Compile goal equation',
    authority: 'AUTHORITATIVE',
    scope: 'cycle',
    writes: ['identityStore:compileGoalEquation'],
    enforcedBy: ['goalEquation:compileGoalEquationPlan']
  },
  'tabs.structure': {
    id: 'tabs.structure',
    label: 'Structure tab',
    authority: 'AUTHORITATIVE',
    scope: 'ui',
    writes: ['ZionDashboard:setZionView']
  },
  'tabs.today': {
    id: 'tabs.today',
    label: 'Today tab',
    authority: 'AUTHORITATIVE',
    scope: 'ui',
    writes: ['ZionDashboard:setZionView']
  },
  'tabs.stability': {
    id: 'tabs.stability',
    label: 'Stability tab',
    authority: 'AUTHORITATIVE',
    scope: 'ui',
    writes: ['ZionDashboard:setZionView']
  },
  'today.nav.prev': {
    id: 'today.nav.prev',
    label: 'Prev day/week/month/year',
    authority: 'AUTHORITATIVE',
    scope: 'day',
    writes: ['ZionDashboard:shiftAnchor']
  },
  'today.nav.next': {
    id: 'today.nav.next',
    label: 'Next day/week/month/year',
    authority: 'AUTHORITATIVE',
    scope: 'day',
    writes: ['ZionDashboard:shiftAnchor']
  },
  'today.nav.today': {
    id: 'today.nav.today',
    label: 'Jump to today',
    authority: 'AUTHORITATIVE',
    scope: 'day',
    writes: ['ZionDashboard:jumpToAnchorToday']
  },
  'addBlock.submit': {
    id: 'addBlock.submit',
    label: 'Add block',
    authority: 'AUTHORITATIVE',
    unit: 'blocks',
    scope: 'day',
    reads: ['AddBlockBar:formState'],
    writes: ['identityStore:createBlock'],
    enforcedBy: ['identityCompute:createBlock']
  },
  'addBlock.linkGoal': {
    id: 'addBlock.linkGoal',
    label: 'Link to active goal',
    authority: 'ADVISORY',
    scope: 'goal',
    reads: ['AddBlockBar:linkToGoal'],
    notes: 'Determines goalId inclusion on block payload.'
  },
  'addBlock.linkDeliverable': {
    id: 'addBlock.linkDeliverable',
    label: 'Link to deliverable / criterion',
    authority: 'ADVISORY',
    scope: 'deliverable',
    reads: ['AddBlockBar:deliverableId', 'AddBlockBar:criterionId']
  },
  'suggestedPath.generatePlan': {
    id: 'suggestedPath.generatePlan',
    label: 'Generate plan',
    authority: 'AUTHORITATIVE',
    unit: 'suggestions',
    scope: 'cycle',
    reads: ['identityCompute:planDraft', 'identityCompute:goalExecutionContract'],
    writes: ['identityStore:generatePlan'],
    enforcedBy: ['identityCompute:generatePlan']
  },
  'suggestedPath.applyPlan': {
    id: 'suggestedPath.applyPlan',
    label: 'Apply plan (materialize)',
    authority: 'AUTHORITATIVE',
    unit: 'blocks',
    scope: 'cycle',
    reads: ['identityCompute:autoAsanaPlan'],
    writes: ['identityStore:applyPlan'],
    enforcedBy: ['identityCompute:applyGeneratedPlan']
  },
  'proposedBlocks.panel': {
    id: 'proposedBlocks.panel',
    label: 'Auto Schedule view (proposed blocks)',
    authority: 'REFLECTIVE',
    unit: 'blocks',
    scope: 'cycle',
    reads: ['identityCompute:suggestedBlocks', 'identityCompute:autoAsanaPlan']
  },
  'suggestedPath.accept': {
    id: 'suggestedPath.accept',
    label: 'Accept suggestion',
    authority: 'AUTHORITATIVE',
    unit: 'blocks',
    scope: 'cycle',
    writes: ['identityStore:acceptSuggestedBlock'],
    enforcedBy: ['identityCompute:acceptSuggestedBlock']
  },
  'suggestedPath.ignore': {
    id: 'suggestedPath.ignore',
    label: 'Ignore suggestion',
    authority: 'AUTHORITATIVE',
    unit: 'suggestions',
    scope: 'cycle',
    writes: ['identityStore:ignoreSuggestedBlock'],
    enforcedBy: ['identityCompute:ignoreSuggestedBlock']
  },
  'suggestedPath.dismiss': {
    id: 'suggestedPath.dismiss',
    label: 'Dismiss suggestion',
    authority: 'AUTHORITATIVE',
    unit: 'suggestions',
    scope: 'cycle',
    writes: ['identityStore:dismissSuggestedBlock'],
    enforcedBy: ['identityCompute:dismissSuggestedBlock']
  },
  'acceptedBlocks.panel': {
    id: 'acceptedBlocks.panel',
    label: 'Committed schedule (accepted blocks)',
    authority: 'REFLECTIVE',
    unit: 'blocks',
    scope: 'cycle',
    reads: ['todayAuthority:materializeBlocksFromEvents']
  },
  'acceptedBlocks.complete': {
    id: 'acceptedBlocks.complete',
    label: 'Complete block',
    authority: 'AUTHORITATIVE',
    unit: 'events',
    scope: 'day',
    writes: ['identityStore:completeBlock'],
    enforcedBy: ['identityCompute:completeBlock']
  },
  'acceptedBlocks.reschedule': {
    id: 'acceptedBlocks.reschedule',
    label: 'Reschedule block',
    authority: 'AUTHORITATIVE',
    unit: 'events',
    scope: 'day',
    writes: ['identityStore:rescheduleBlock'],
    enforcedBy: ['identityCompute:rescheduleBlock']
  },
  'acceptedBlocks.delete': {
    id: 'acceptedBlocks.delete',
    label: 'Delete block',
    authority: 'AUTHORITATIVE',
    unit: 'events',
    scope: 'day',
    writes: ['identityStore:deleteBlock'],
    enforcedBy: ['identityCompute:deleteBlock']
  },
  'progress.strictMode': {
    id: 'progress.strictMode',
    label: 'Strict progress mode',
    authority: 'ADVISORY',
    scope: 'ui',
    notes: 'Enforces criterion linkage in UI only.'
  },
  'whatMovedToday.panel': {
    id: 'whatMovedToday.panel',
    label: 'What moved today',
    authority: 'REFLECTIVE',
    scope: 'day',
    reads: ['whatMovedToday:deriveWhatMovedToday']
  },
  'deliverables.panel': {
    id: 'deliverables.panel',
    label: 'Deliverables editor',
    authority: 'AUTHORITATIVE',
    scope: 'cycle',
    writes: [
      'identityStore:createDeliverable',
      'identityStore:updateDeliverable',
      'identityStore:deleteDeliverable',
      'identityStore:createCriterion',
      'identityStore:toggleCriterionDone',
      'identityStore:deleteCriterion'
    ]
  },
  'criteria.panel': {
    id: 'criteria.panel',
    label: 'Criteria editor',
    authority: 'AUTHORITATIVE',
    scope: 'cycle',
    writes: ['identityStore:createCriterion', 'identityStore:toggleCriterionDone', 'identityStore:deleteCriterion']
  },
  'goal.compile': {
    id: 'goal.compile',
    label: 'Compile goal equation',
    authority: 'AUTHORITATIVE',
    scope: 'cycle',
    writes: ['identityStore:compileGoalEquation'],
    enforcedBy: ['goalEquation:compileGoalEquationPlan']
  },
  'strategy.save': {
    id: 'strategy.save',
    label: 'Save strategy',
    authority: 'AUTHORITATIVE',
    scope: 'cycle',
    writes: ['identityStore:setStrategy'],
    enforcedBy: ['coldPlan:buildAssumptionsHash']
  },
  'strategy.regenerate': {
    id: 'strategy.regenerate',
    label: 'Regenerate route',
    authority: 'AUTHORITATIVE',
    scope: 'cycle',
    writes: ['identityStore:generateColdPlan'],
    enforcedBy: ['coldPlan:generateColdPlan']
  },
  'strategy.rebase': {
    id: 'strategy.rebase',
    label: 'Re-base from today',
    authority: 'AUTHORITATIVE',
    scope: 'cycle',
    writes: ['identityStore:rebaseColdPlan'],
    enforcedBy: ['coldPlan:generateColdPlan']
  },
  'truthPanel.addEntry': {
    id: 'truthPanel.addEntry',
    label: 'Truth panel add entry',
    authority: 'AUTHORITATIVE',
    scope: 'cycle',
    writes: ['identityStore:addTruthEntry']
  },
  'patternLens.panel': {
    id: 'patternLens.panel',
    label: 'Pattern lens',
    authority: 'REFLECTIVE',
    scope: 'cycle',
    reads: ['todayAuthority:materializeBlocksFromEvents']
  },
  'stability.panel': {
    id: 'stability.panel',
    label: 'Stability tab',
    authority: 'REFLECTIVE',
    scope: 'cycle',
    reads: ['identityCompute:stability', 'probabilityScore']
  },
  'proof.planProof': {
    id: 'proof.planProof',
    label: 'Plan proof panel',
    authority: 'REFLECTIVE',
    scope: 'cycle',
    reads: ['goalEquation:compileGoalEquationPlan', 'engine:planProof']
  },
  'proof.probability': {
    id: 'proof.probability',
    label: 'Probability report panel',
    authority: 'REFLECTIVE',
    scope: 'cycle',
    reads: ['engine:probabilityScore']
  },
  'proof.conflicts': {
    id: 'proof.conflicts',
    label: 'Plan conflicts and recovery options',
    authority: 'REFLECTIVE',
    scope: 'cycle',
    reads: ['engine:autoAsanaPlan']
  },
  'cycle.switch': {
    id: 'cycle.switch',
    label: 'Cycle switcher',
    authority: 'AUTHORITATIVE',
    scope: 'cycle',
    writes: ['identityStore:setActiveCycle']
  },
  'cycle.new': {
    id: 'cycle.new',
    label: 'New cycle',
    authority: 'AUTHORITATIVE',
    scope: 'cycle',
    writes: ['identityStore:startNewCycle']
  }
};
