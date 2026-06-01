import type { ArchetypeLiveTraceInput } from '../../src/state/engine/archetypeLiveTraceEvaluation';

export const newlyMigratedLiveTraceInputs: ArchetypeLiveTraceInput[] = [
  {
    archetype: 'Fundraising',
    inputLabel: 'clean_explicit',
    goalText: 'Raise a $100,000 angel round in 60 days with investor deck, target list, and first meetings completed.',
    deadlineText: '60 days',
  },
  {
    archetype: 'Fundraising',
    inputLabel: 'compressed_informal',
    goalText: 'Need seed raise narrative deck and investor outreach moving this month',
    deadlineText: 'this month',
  },
  {
    archetype: 'Fundraising',
    inputLabel: 'slightly_vague',
    goalText: 'Get fundraising pipeline active with real investor conversations soon',
  },
  {
    archetype: 'Fundraising',
    inputLabel: 'overloaded_multi_part',
    goalText:
      'Finalize raise thesis, complete investor materials, start outreach wave, and handle diligence follow-up before deadline',
    deadlineText: 'before deadline',
  },
  {
    archetype: 'Fundraising',
    inputLabel: 'deadline_constrained',
    goalText: 'Submit grant and non-dilutive funding applications with compliance docs by end of quarter',
    deadlineText: 'end of quarter',
  },
  {
    archetype: 'CreativeProduction',
    inputLabel: 'clean_explicit',
    goalText:
      'Launch a 10-episode podcast season in 60 days with setup, first batch recordings, and publish package complete.',
    deadlineText: '60 days',
  },
  {
    archetype: 'CreativeProduction',
    inputLabel: 'compressed_informal',
    goalText: 'Need music EP concept tracks recorded and release package ready fast',
  },
  {
    archetype: 'CreativeProduction',
    inputLabel: 'slightly_vague',
    goalText: 'Finish my longform book draft and revision pass this cycle',
  },
  {
    archetype: 'CreativeProduction',
    inputLabel: 'overloaded_multi_part',
    goalText: 'Plan, shoot, edit, and deliver a short branded video with final export and upload checklist done',
  },
  {
    archetype: 'CreativeProduction',
    inputLabel: 'deadline_constrained',
    goalText: 'Complete podcast production workflow and launch-ready episode package by month end',
    deadlineText: 'month end',
  },
];
