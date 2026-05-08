import type { ArchetypeLiveTraceInput } from '../../src/state/engine/archetypeLiveTraceEvaluation';

export const nextGroupLiveTraceInputs: ArchetypeLiveTraceInput[] = [
  {
    archetype: 'JobSearchPipeline',
    inputLabel: 'clean_explicit',
    goalText: 'Get a PM job in the next 60 days',
    deadlineText: 'next 60 days',
  },
  {
    archetype: 'JobSearchPipeline',
    inputLabel: 'compressed_informal',
    goalText: 'Need resume applications and interviews moving by next month',
    deadlineText: 'next month',
  },
  {
    archetype: 'JobSearchPipeline',
    inputLabel: 'slightly_vague',
    goalText: 'Land an operations role and get first batch of applications out fast',
  },
  {
    archetype: 'JobSearchPipeline',
    inputLabel: 'overloaded_multi_part',
    goalText: 'Target PM roles tailor resume send 20 applications and prep interviews',
  },
  {
    archetype: 'JobSearchPipeline',
    inputLabel: 'deadline_constrained',
    goalText: 'Job search pipeline with first batch and interview prep completed by end of month',
    deadlineText: 'end of month',
  },
  {
    archetype: 'PhysicalTraining',
    inputLabel: 'clean_explicit',
    goalText: 'Run a 5k in 8 weeks',
    deadlineText: '8 weeks',
  },
  {
    archetype: 'PhysicalTraining',
    inputLabel: 'compressed_informal',
    goalText: 'Get back to lifting after rehab',
  },
  {
    archetype: 'PhysicalTraining',
    inputLabel: 'slightly_vague',
    goalText: 'Lose 15 pounds by summer',
    deadlineText: 'by summer',
  },
  {
    archetype: 'PhysicalTraining',
    inputLabel: 'overloaded_multi_part',
    goalText: 'Build a 4 day strength routine and hit first benchmark by week 6',
    deadlineText: 'week 6',
  },
  {
    archetype: 'PhysicalTraining',
    inputLabel: 'deadline_constrained',
    goalText: 'Rehab knee rebuild baseline and return to training safely by deadline',
    deadlineText: 'by deadline',
  },
];
