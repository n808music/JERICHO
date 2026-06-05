// Canonical commercial/capital/BD pipeline stage taxonomy. Each stage declares
// its target object, artifact, evidence, and pipeline-position so cross-lane
// consumers can find the right upstream output.

export const COMMERCIAL_PIPELINE_STAGES = [
  'segment_definition',
  'target_criteria',
  'lead_sourcing',
  'list_enrichment',
  'outreach_asset',
  'outreach_send',
  'response_tracking',
  'qualification',
  'discovery_call',
  'needs_analysis',
  'proposal_prep',
  'diligence_packet',
  'follow_up',
  'objection_handling',
  'close_decision',
  'crm_pipeline_update',
  'lessons_learned',
];

export const COMMERCIAL_PIPELINE_STAGE_SET = new Set(COMMERCIAL_PIPELINE_STAGES);

const STAGE_METADATA = {
  segment_definition: { artifact: 'ICP and target segment brief', evidence: 'segment brief reviewed against revenue or capital target' },
  target_criteria: { artifact: 'target criteria document with disqualification rules', evidence: 'target criteria approved by lane owner' },
  lead_sourcing: { artifact: 'prospect source list with channel notes', evidence: 'source list audited for fit against target criteria' },
  list_enrichment: { artifact: 'enriched prospect list with contact paths and signal columns', evidence: 'enriched list reviewed for routability and dedupe' },
  outreach_asset: { artifact: 'outreach asset set (script, email, deck)', evidence: 'outreach asset reviewed for tone and target alignment' },
  outreach_send: { artifact: 'outreach log with batch metadata and message body', evidence: 'outreach send confirmed with delivery and bounce counts' },
  response_tracking: { artifact: 'response tracker with reply timestamps and dispositions', evidence: 'response tracker reconciled with CRM' },
  qualification: { artifact: 'qualification scorecard with disqualification rationale where applicable', evidence: 'qualification reviewed against ICP fit' },
  discovery_call: { artifact: 'discovery call notes with prospect needs and objections', evidence: 'discovery notes reviewed with next-step commitment recorded' },
  needs_analysis: { artifact: 'needs analysis with prioritized buyer requirements', evidence: 'needs analysis reviewed with internal stakeholder' },
  proposal_prep: { artifact: 'proposal draft with scope, pricing, and terms', evidence: 'proposal reviewed against needs analysis and qualification scorecard' },
  diligence_packet: { artifact: 'diligence packet with answers to standard buyer questions', evidence: 'diligence packet reviewed for completeness and accuracy' },
  follow_up: { artifact: 'follow-up tracker with cadence and next-touch dates', evidence: 'follow-up cadence executed with replies logged' },
  objection_handling: { artifact: 'objection log with response and outcome', evidence: 'objection log reviewed for pattern themes' },
  close_decision: { artifact: 'signed agreement, LOI, or decline note with reason', evidence: 'close decision recorded with terms and start date' },
  crm_pipeline_update: { artifact: 'pipeline status report with stage transitions', evidence: 'pipeline report reconciled with finance forecast' },
  lessons_learned: { artifact: 'lessons-learned brief with what worked and what to change', evidence: 'lessons-learned reviewed in next-cycle planning' },
};

export function getCommercialArtifact(stage) {
  return STAGE_METADATA[stage]?.artifact || null;
}

export function getCommercialEvidence(stage) {
  return STAGE_METADATA[stage]?.evidence || null;
}

export function isValidCommercialStage(stage) {
  return COMMERCIAL_PIPELINE_STAGE_SET.has(stage);
}
