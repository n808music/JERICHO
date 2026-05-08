import type { ArchetypeLiveTraceInput } from '../../src/state/engine/archetypeLiveTraceEvaluation';

export const closureGroupLiveTraceInputs: ArchetypeLiveTraceInput[] = [
  {
    archetype: 'SalesPipeline',
    inputLabel: 'clean_explicit',
    goalText: 'Close 3 B2B service clients in the next 90 days',
    deadlineText: 'next 90 days',
  },
  {
    archetype: 'SalesPipeline',
    inputLabel: 'compressed_informal',
    goalText: 'Get sales pipeline moving and land first deal this month',
    deadlineText: 'this month',
  },
  {
    archetype: 'SalesPipeline',
    inputLabel: 'slightly_vague',
    goalText: 'Build a client pipeline and start closing deals',
  },
  {
    archetype: 'SalesPipeline',
    inputLabel: 'overloaded_multi_part',
    goalText: 'Identify 20 prospects build outreach sequence qualify and close first client',
  },
  {
    archetype: 'SalesPipeline',
    inputLabel: 'deadline_constrained',
    goalText: 'Build and close B2B service pipeline with first qualified deal by end of quarter',
    deadlineText: 'end of quarter',
  },
  {
    archetype: 'BrandLaunch',
    inputLabel: 'clean_explicit',
    goalText: 'Launch my personal brand online in 8 weeks',
    deadlineText: '8 weeks',
  },
  {
    archetype: 'BrandLaunch',
    inputLabel: 'compressed_informal',
    goalText: 'Get my brand presence off the ground with content and a profile launch',
  },
  {
    archetype: 'BrandLaunch',
    inputLabel: 'slightly_vague',
    goalText: 'Build out my brand identity and start posting consistently',
  },
  {
    archetype: 'BrandLaunch',
    inputLabel: 'overloaded_multi_part',
    goalText: 'Define positioning create visual identity write launch content and publish profile',
  },
  {
    archetype: 'BrandLaunch',
    inputLabel: 'deadline_constrained',
    goalText: 'Complete personal brand identity and launch public profile by end of month',
    deadlineText: 'end of month',
  },
];
