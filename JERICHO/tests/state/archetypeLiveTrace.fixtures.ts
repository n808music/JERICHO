import type { ArchetypeLiveTraceInput } from '../../src/state/engine/archetypeLiveTraceEvaluation';

export const archetypeLiveTraceInputs: ArchetypeLiveTraceInput[] = [
  {
    archetype: 'ProfessionalQualification',
    inputLabel: 'clean_explicit',
    goalText: 'Pass the AWS CCP certification exam by May 4',
    deadlineText: 'by May 4',
  },
  {
    archetype: 'ProfessionalQualification',
    inputLabel: 'compressed_informal',
    goalText: 'Get AWS cloud cert done before early May',
    deadlineText: 'early May',
  },
  {
    archetype: 'ProfessionalQualification',
    inputLabel: 'slightly_vague',
    goalText: 'Need to be ready for the CCP exam in six weeks',
    deadlineText: 'in six weeks',
  },
  {
    archetype: 'ProfessionalQualification',
    inputLabel: 'overloaded_multi_part',
    goalText: 'Pass AWS CCP and complete enough practice tests to feel confident by May 4',
    deadlineText: 'by May 4',
  },
  {
    archetype: 'ProfessionalQualification',
    inputLabel: 'deadline_constrained',
    goalText: 'AWS CCP exam pass required before my test date next month',
    deadlineText: 'next month',
  },

  {
    archetype: 'VentureLaunch',
    inputLabel: 'clean_explicit',
    goalText: 'Raise a small seed round for Jericho',
  },
  {
    archetype: 'VentureLaunch',
    inputLabel: 'compressed_informal',
    goalText: 'Need a deck investor list and first outreach wave for fundraising',
  },
  {
    archetype: 'VentureLaunch',
    inputLabel: 'slightly_vague',
    goalText: 'Get startup investment-ready and begin investor outreach this month',
  },
  {
    archetype: 'VentureLaunch',
    inputLabel: 'overloaded_multi_part',
    goalText: 'Finalize pitch materials and contact first 20 investors by the deadline',
  },
  {
    archetype: 'VentureLaunch',
    inputLabel: 'deadline_constrained',
    goalText: 'Seed fundraising launch in 30 days with deck and investor outreach',
    deadlineText: '30 days',
  },

  {
    archetype: 'GenericStructured.TVWriting',
    inputLabel: 'clean_explicit',
    goalText: 'Finish season 1 episode outlines and drafts for my TV series',
  },
  {
    archetype: 'GenericStructured.TVWriting',
    inputLabel: 'compressed_informal',
    goalText: 'Write show bible and episode drafts for season one',
  },
  {
    archetype: 'GenericStructured.TVWriting',
    inputLabel: 'slightly_vague',
    goalText: 'Need arc episodes and continuity locked for the series',
  },
  {
    archetype: 'GenericStructured.TVWriting',
    inputLabel: 'overloaded_multi_part',
    goalText: 'Complete thesis arc outlines and draft episodes before writing deadline',
    deadlineText: 'before writing deadline',
  },
  {
    archetype: 'GenericStructured.TVWriting',
    inputLabel: 'deadline_constrained',
    goalText: 'Lock season arc pilot outline and draft scripts by end of quarter',
    deadlineText: 'end of quarter',
  },
];
