// Semantic cross-lane artifact dependencies. Each entry declares: a consuming
// lane family + phase + descriptor predicate, and the upstream lane family +
// stage whose artifact it should consume. Used by fullHorizonScheduleExpansion
// to attach consumedArtifactIds across lanes so the plan compounds.

export const CROSS_LANE_DEPENDENCIES = [
  // Commercial / BD consumes product proof, traction, and release evidence
  {
    consumingFamily: 'income_stream',
    consumingPhase: 'P1',
    consumingStage: 'outreach_asset',
    upstreamFamily: 'product_software',
    upstreamStage: 'release_prep',
    rationale: 'Outreach assets must reflect what the product actually ships',
  },
  {
    consumingFamily: 'income_stream',
    consumingPhase: 'P2',
    consumingStage: 'proposal_prep',
    upstreamFamily: 'product_software',
    upstreamStage: 'telemetry_monitoring',
    rationale: 'Proposals reference live product traction',
  },
  {
    consumingFamily: 'income_stream',
    consumingPhase: 'P3',
    consumingStage: 'diligence_packet',
    upstreamFamily: 'product_software',
    upstreamStage: 'user_feedback_review',
    rationale: 'Diligence packets cite real user feedback evidence',
  },
  // Capital consumes traction, budget, and release evidence
  {
    consumingFamily: 'capital_real_estate',
    consumingPhase: 'P1',
    consumingStage: 'segment_definition',
    upstreamFamily: 'income_stream',
    upstreamStage: 'close_decision',
    rationale: 'Capital memos cite verified revenue closes',
  },
  {
    consumingFamily: 'capital_real_estate',
    consumingPhase: 'P2',
    consumingStage: 'diligence_packet',
    upstreamFamily: 'product_software',
    upstreamStage: 'telemetry_monitoring',
    rationale: 'Capital diligence cites live product traction',
  },
  {
    consumingFamily: 'capital_real_estate',
    consumingPhase: 'P3',
    consumingStage: 'proposal_prep',
    upstreamFamily: 'income_stream',
    upstreamStage: 'crm_pipeline_update',
    rationale: 'Capital proposals cite recurring pipeline state',
  },
  // Institution / civic consume product proof and brand evidence
  {
    consumingFamily: 'institution_education',
    consumingPhase: 'P1',
    consumingStage: 'proposal_prep',
    upstreamFamily: 'product_software',
    upstreamStage: 'qa_validation',
    rationale: 'Institution pilots require validated product readiness',
  },
  {
    consumingFamily: 'civic_development',
    consumingPhase: 'P1',
    consumingStage: 'proposal_prep',
    upstreamFamily: 'media_channel',
    upstreamStage: null,
    rationale: 'Civic partnerships reference audience and reach evidence',
  },
  // Product backlog consumes commercial feedback
  {
    consumingFamily: 'product_software',
    consumingPhase: 'P2',
    consumingStage: 'iteration_backlog_grooming',
    upstreamFamily: 'income_stream',
    upstreamStage: 'discovery_call',
    rationale: 'Product iteration consumes discovery call notes',
  },
  {
    consumingFamily: 'product_software',
    consumingPhase: 'P2',
    consumingStage: 'requirements_clarification',
    upstreamFamily: 'income_stream',
    upstreamStage: 'objection_handling',
    rationale: 'New requirements address commercial objection themes',
  },
];

export function getDependenciesFor({ family, phase, stage }) {
  return CROSS_LANE_DEPENDENCIES.filter(
    (d) =>
      d.consumingFamily === family &&
      d.consumingPhase === phase &&
      (d.consumingStage === stage || d.consumingStage === null),
  );
}
