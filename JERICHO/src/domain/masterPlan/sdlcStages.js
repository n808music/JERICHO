// Canonical SDLC stage taxonomy for product/software descriptors. Stages are
// ordered (earlier → later) so consumers can verify progression. Each stage
// declares (a) what action it represents, (b) the artifact it produces, and
// (c) the evidence that proves it passed.

export const SDLC_STAGES = [
  'requirements_clarification',
  'product_spec',
  'technical_design',
  'implementation',
  'test_planning',
  'unit_integration_testing',
  'qa_validation',
  'release_prep',
  'deployment',
  'telemetry_monitoring',
  'user_feedback_review',
  'iteration_backlog_grooming',
];

export const SDLC_STAGE_SET = new Set(SDLC_STAGES);

const STAGE_METADATA = {
  requirements_clarification: { artifact: 'requirements brief', evidence: 'requirements brief signed by product owner' },
  product_spec: { artifact: 'product specification with user stories', evidence: 'product spec reviewed by engineering and design' },
  technical_design: { artifact: 'technical design note', evidence: 'design review with architecture decision record' },
  implementation: { artifact: 'implementation branch with patch', evidence: 'implementation branch passes self-test' },
  test_planning: { artifact: 'test plan covering unit / integration / acceptance scope', evidence: 'test plan reviewed against acceptance criteria' },
  unit_integration_testing: { artifact: 'passing test report', evidence: 'unit and integration tests pass with coverage threshold met' },
  qa_validation: { artifact: 'QA checklist with sign-off', evidence: 'QA checklist completed with zero release blockers' },
  release_prep: { artifact: 'release notes and deployment checklist', evidence: 'release notes approved and deployment checklist complete' },
  deployment: { artifact: 'deployment record with rollback plan', evidence: 'deployment executed with rollback verified' },
  telemetry_monitoring: { artifact: 'telemetry review with health signals', evidence: 'telemetry shows no regressions vs baseline' },
  user_feedback_review: { artifact: 'user feedback summary with prioritized themes', evidence: 'feedback themes triaged with owner and next-step decisions' },
  iteration_backlog_grooming: { artifact: 'backlog refinement notes with sized stories', evidence: 'backlog reviewed with priority and sequencing committed for next cycle' },
};

export function getSdlcArtifact(stage) {
  return STAGE_METADATA[stage]?.artifact || null;
}

export function getSdlcEvidence(stage) {
  return STAGE_METADATA[stage]?.evidence || null;
}

export function isValidSdlcStage(stage) {
  return SDLC_STAGE_SET.has(stage);
}
