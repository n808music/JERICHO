import { evaluateArchetypeRulesFromActions, type ArchetypeRuleQualitySummary } from './archetypeRuleQuality';

export type MigratedArchetype =
  | 'ProfessionalQualification'
  | 'VentureLaunch'
  | 'GenericStructured.TVWriting'
  | 'JobSearchPipeline'
  | 'PhysicalTraining'
  | 'CreativeProduction'
  | 'Fundraising'
  | 'SalesPipeline'
  | 'BrandLaunch';

export type LiveInputStyle =
  | 'clean_explicit'
  | 'compressed_informal'
  | 'slightly_vague'
  | 'overloaded_multi_part'
  | 'deadline_constrained';

export type ArchetypeLiveTraceInput = {
  archetype: MigratedArchetype;
  inputLabel: LiveInputStyle;
  goalText: string;
  deadlineText?: string;
};

export type LiveTraceRunSummary = {
  archetype: MigratedArchetype;
  inputLabel: LiveInputStyle;
  goalText: string;
  classifiedArchetype: MigratedArchetype | 'UNKNOWN';
  classificationMatchesIntended: boolean;
  usesCanonicalDeliverablePath: boolean;
  deliverableCount: number;
  actionSeedCount: number;
  proposedBlockCompatible: boolean;
  issues: ArchetypeRuleQualitySummary['issues'];
  coverage: ArchetypeRuleQualitySummary['coverage'] & { hasCoreOutputCoverage: boolean };
  schedulerReadiness: ArchetypeRuleQualitySummary['schedulerReadiness'];
  recommendation: 'pass' | 'warn' | 'fail';
};

export type LiveTraceAggregate = {
  totalRuns: number;
  passCount: number;
  warnCount: number;
  failCount: number;
  issueFrequency: Record<string, number>;
  byArchetype: Record<string, { pass: number; warn: number; fail: number }>;
  byInputStyle: Record<string, { pass: number; warn: number; fail: number }>;
};

const BASE_ACTIONS_BY_ARCHETYPE: Record<MigratedArchetype, any[]> = {
  ProfessionalQualification: [
    {
      id: 'study:001:domain-one',
      title: 'Study Domain 1: Core foundations',
      deliverable: 'Domain 1 notes with key concepts and formulas',
      definitionOfDone: 'Domain 1 complete, flashcards created, self-quiz passed at 80%.',
      estimateMin: 120,
      dependencies: [],
    },
    {
      id: 'practice:001:first-test',
      title: 'Complete first full-length practice exam',
      deliverable: 'Practice exam completed with score and weak areas identified',
      definitionOfDone: 'Exam completed under timed conditions, score recorded, gaps listed.',
      estimateMin: 120,
      dependencies: ['study:001:domain-one'],
    },
    {
      id: 'review:001:weak-areas',
      title: 'Deep review of weak domain areas',
      deliverable: 'Targeted review notes for bottom scoring domains',
      definitionOfDone: 'Weak domains reviewed and additional practice questions completed.',
      estimateMin: 90,
      dependencies: ['practice:001:first-test'],
    },
    {
      id: 'finalprep:002:exam',
      title: 'Sit and complete the certification exam',
      deliverable: 'Exam completed and result received',
      definitionOfDone: 'Exam taken, result documented, pass/fail recorded.',
      estimateMin: 180,
      dependencies: ['review:001:weak-areas'],
    },
  ],
  VentureLaunch: [
    {
      id: 'validate:001:customer-interviews',
      title: 'Conduct customer discovery interviews',
      deliverable: 'Interview notes with recurring pain points identified',
      definitionOfDone: 'Interviews completed and synthesis doc identifies top pain points.',
      estimateMin: 120,
      dependencies: [],
    },
    {
      id: 'define:001:deck',
      title: 'Finalize pitch narrative and deck structure',
      deliverable: 'Pitch deck narrative and slide structure finalized',
      definitionOfDone: 'Deck narrative finalized with clear problem, solution, and traction sections.',
      estimateMin: 120,
      dependencies: ['validate:001:customer-interviews'],
    },
    {
      id: 'pipeline:001:target-list',
      title: 'Build prioritized investor target list',
      deliverable: 'Prioritized investor target list with contact details',
      definitionOfDone: 'List includes ranked investors and verified outreach contact paths.',
      estimateMin: 90,
      dependencies: ['define:001:deck'],
    },
    {
      id: 'outreach:001:first-wave',
      title: 'Send first investor outreach wave',
      deliverable: 'First 20 investor outreach sends completed and logged',
      definitionOfDone: '20 sends complete with tracking log and follow-up dates.',
      estimateMin: 90,
      dependencies: ['pipeline:001:target-list'],
    },
  ],
  'GenericStructured.TVWriting': [
    {
      id: 'tv:001:premise-outline',
      title: 'Write season premise and story outline',
      deliverable: 'Season premise with tone, genre, and central conflict',
      definitionOfDone: 'Premise and high-level story outline documented in one page.',
      estimateMin: 60,
      dependencies: [],
    },
    {
      id: 'tv:003:season-arc',
      title: 'Build season arc from pilot to finale',
      deliverable: 'Season beat map with escalation and turning points',
      definitionOfDone: 'Season arc includes beginning, midpoint, climax, and finale beats.',
      estimateMin: 90,
      dependencies: ['tv:001:premise-outline'],
    },
    {
      id: 'tv:004:outline-episode-1',
      title: 'Outline episode 1 (pilot)',
      deliverable: 'Episode 1 scene-by-scene outline',
      definitionOfDone: 'Pilot outline includes teaser, act turns, and resolution hook.',
      estimateMin: 90,
      dependencies: ['tv:003:season-arc'],
    },
    {
      id: 'tv:005:draft-episode-1',
      title: 'Draft episode 1 script',
      deliverable: 'Complete pilot draft script',
      definitionOfDone: 'Pilot draft reaches complete first-pass script form.',
      estimateMin: 120,
      dependencies: ['tv:004:outline-episode-1'],
    },
    {
      id: 'tv:008:continuity-pass',
      title: 'Run continuity pass across drafted episodes',
      deliverable: 'Continuity log resolving character, timeline, and plot inconsistencies',
      definitionOfDone: 'Continuity issues identified and corrected across episodes.',
      estimateMin: 60,
      dependencies: ['tv:005:draft-episode-1'],
    },
  ],
  JobSearchPipeline: [
    {
      id: 'prep:001:target-role-map',
      title: 'Define target role map and search criteria',
      deliverable: 'Target role profile with role families, locations, and compensation bounds',
      definitionOfDone: 'Target criteria finalized with explicit include/exclude role rules.',
      estimateMin: 60,
      dependencies: [],
    },
    {
      id: 'prep:002:resume-portfolio',
      title: 'Tailor resume and portfolio for target roles',
      deliverable: 'Updated resume and portfolio aligned to selected role family',
      definitionOfDone: 'Resume and portfolio validated against five live job descriptions.',
      estimateMin: 120,
      dependencies: ['prep:001:target-role-map'],
    },
    {
      id: 'pipeline:001:company-list',
      title: 'Build prioritized company pipeline list',
      deliverable: 'Ranked target company list with role links and tracker initialized',
      definitionOfDone: 'Pipeline includes 30 targets with status columns and follow-up dates.',
      estimateMin: 90,
      dependencies: ['prep:002:resume-portfolio'],
    },
    {
      id: 'pipeline:003:application-batch-1',
      title: 'Submit first batch of tailored applications',
      deliverable: 'First batch of 10 tailored applications submitted and logged',
      definitionOfDone: '10 applications submitted with custom notes and tracker updates.',
      estimateMin: 120,
      dependencies: ['pipeline:001:company-list'],
    },
    {
      id: 'interview:002:mock-round',
      title: 'Run mock interview rounds and feedback review',
      deliverable: 'Interview prep packet with feedback actions and STAR story revisions',
      definitionOfDone: 'Two mock rounds complete and remediation actions documented.',
      estimateMin: 90,
      dependencies: ['pipeline:003:application-batch-1'],
    },
  ],
  PhysicalTraining: [
    {
      id: 'baseline:001:assessment',
      title: 'Complete baseline movement and conditioning assessment',
      deliverable: 'Baseline assessment completed with recorded mobility and conditioning metrics',
      definitionOfDone: 'Baseline metrics logged and reviewed for training block design.',
      estimateMin: 60,
      dependencies: [],
    },
    {
      id: 'protocol:001:block-one',
      title: 'Execute training block one sessions',
      deliverable: 'Training block one sessions completed and logged with adherence notes',
      definitionOfDone: 'All planned sessions in block one completed and logged.',
      estimateMin: 180,
      dependencies: ['baseline:001:assessment'],
    },
    {
      id: 'benchmark:001:week4-test',
      title: 'Run week-4 benchmark test',
      deliverable: 'Week-4 benchmark completed with performance delta recorded',
      definitionOfDone: 'Benchmark performed and compared against baseline metrics.',
      estimateMin: 60,
      dependencies: ['protocol:001:block-one'],
    },
    {
      id: 'protocol:002:block-two',
      title: 'Execute training block two sessions',
      deliverable: 'Training block two sessions completed with progression targets met',
      definitionOfDone: 'Block two sessions complete with progression metrics documented.',
      estimateMin: 180,
      dependencies: ['benchmark:001:week4-test'],
    },
    {
      id: 'review:001:final',
      title: 'Run final performance review',
      deliverable: 'Final performance review completed with next-cycle recommendation',
      definitionOfDone: 'Final review compares baseline, benchmark, and target outcome status.',
      estimateMin: 60,
      dependencies: ['protocol:002:block-two'],
    },
  ],
  CreativeProduction: [
    {
      id: 'creative:001:concept',
      title: 'Define project concept and scope',
      deliverable: 'Creative project concept and scope document completed',
      definitionOfDone: 'Concept, target audience, and scope constraints are documented and approved.',
      estimateMin: 90,
      dependencies: [],
    },
    {
      id: 'creative:002:production-plan',
      title: 'Build production plan and asset checklist',
      deliverable: 'Production plan with asset checklist and schedule completed',
      definitionOfDone: 'Production plan includes milestones, asset checklist, and production sequence.',
      estimateMin: 120,
      dependencies: ['creative:001:concept'],
    },
    {
      id: 'creative:003:first-batch',
      title: 'Produce first asset batch',
      deliverable: 'First creative asset batch produced and quality reviewed',
      definitionOfDone: 'Initial asset batch completed and reviewed against quality criteria.',
      estimateMin: 180,
      dependencies: ['creative:002:production-plan'],
    },
    {
      id: 'creative:004:revision-pass',
      title: 'Run revision and continuity pass',
      deliverable: 'Revision pass completed with continuity and quality fixes',
      definitionOfDone: 'Quality and continuity issues are resolved and tracked as complete.',
      estimateMin: 120,
      dependencies: ['creative:003:first-batch'],
    },
    {
      id: 'creative:005:release-package',
      title: 'Assemble release-ready package',
      deliverable: 'Final release package completed and ready for publication',
      definitionOfDone: 'Release package includes final assets, metadata, and publish checklist.',
      estimateMin: 90,
      dependencies: ['creative:004:revision-pass'],
    },
  ],
  Fundraising: [
    {
      id: 'fundraise:001:thesis',
      title: 'Define raise thesis and ask structure',
      deliverable: 'Raise thesis and ask structure completed',
      definitionOfDone: 'Target amount, use-of-funds, terms, and ask narrative are documented.',
      estimateMin: 90,
      dependencies: [],
    },
    {
      id: 'fundraise:002:materials',
      title: 'Build investor/funder narrative materials',
      deliverable: 'Investor narrative and deck materials completed',
      definitionOfDone: 'Core narrative, deck, and supporting memo are completed and reviewed.',
      estimateMin: 120,
      dependencies: ['fundraise:001:thesis'],
    },
    {
      id: 'fundraise:003:target-fit',
      title: 'Build target investor/funder fit list',
      deliverable: 'Target list completed with fit rationale and outreach paths',
      definitionOfDone: 'Prioritized list with fit notes, contact paths, and outreach status fields is complete.',
      estimateMin: 90,
      dependencies: ['fundraise:002:materials'],
    },
    {
      id: 'fundraise:004:outreach-and-meetings',
      title: 'Run first outreach wave and meetings',
      deliverable: 'First outreach wave and meeting progression completed',
      definitionOfDone: 'Initial outreach batch sent, meetings scheduled, and progression tracking updated.',
      estimateMin: 120,
      dependencies: ['fundraise:003:target-fit'],
    },
    {
      id: 'fundraise:005:diligence-followthrough',
      title: 'Handle diligence/compliance and commitment progression',
      deliverable: 'Diligence responses and commitment tracking completed',
      definitionOfDone: 'Diligence/compliance responses are delivered and commitment pipeline is current.',
      estimateMin: 120,
      dependencies: ['fundraise:004:outreach-and-meetings'],
    },
  ],
  SalesPipeline: [
    {
      id: 'sales:001:offer-clarity',
      title: 'Clarify offer, pricing tiers, and qualification criteria',
      deliverable: 'Sales offer sheet with pricing, scope, and qualification gates',
      definitionOfDone: 'Offer sheet finalized with explicit qualification requirements.',
      estimateMin: 60,
      dependencies: [],
    },
    {
      id: 'sales:002:icp-targeting',
      title: 'Define ICP and build first target account list',
      deliverable: 'Prioritized list of target leads with segment tags',
      definitionOfDone: 'Lead list completed with segment and outreach priority scoring.',
      estimateMin: 90,
      dependencies: ['sales:001:offer-clarity'],
    },
    {
      id: 'sales:003:outreach-assets',
      title: 'Create outreach scripts and objection-handling library',
      deliverable: 'Outbound templates and objection-response playbook',
      definitionOfDone: 'Scripts tested in role-play and objection library finalized.',
      estimateMin: 75,
      dependencies: ['sales:002:icp-targeting'],
    },
    {
      id: 'sales:005:first-outreach-wave',
      title: 'Execute first outreach wave to top-priority leads',
      deliverable: 'First outreach batch sent to qualified leads and logged',
      definitionOfDone: 'Outreach sent and all leads logged with follow-up dates.',
      estimateMin: 120,
      dependencies: ['sales:003:outreach-assets'],
    },
    {
      id: 'sales:006:discovery-calls',
      title: 'Run discovery calls and qualify active opportunities',
      deliverable: 'Discovery call notes with qualification status for each lead',
      definitionOfDone: 'Discovery calls completed and staged in CRM with proposals queued.',
      estimateMin: 90,
      dependencies: ['sales:005:first-outreach-wave'],
    },
  ],
  BrandLaunch: [
    {
      id: 'brand:001:positioning-brief',
      title: 'Define brand positioning and audience promise',
      deliverable: 'Positioning brief with value proposition, audience, and differentiation',
      definitionOfDone: 'Positioning brief approved with single-sentence core promise.',
      estimateMin: 60,
      dependencies: [],
    },
    {
      id: 'brand:002:message-architecture',
      title: 'Build messaging architecture for priority channels',
      deliverable: 'Messaging map for homepage, social bio, and outreach copy',
      definitionOfDone: 'Messaging map finalized with channel-specific voice guidelines.',
      estimateMin: 75,
      dependencies: ['brand:001:positioning-brief'],
    },
    {
      id: 'brand:003:identity-direction',
      title: 'Select visual identity direction and style standards',
      deliverable: 'Identity direction board with typography, palette, and usage rules',
      definitionOfDone: 'Style direction approved and documented as reusable standards.',
      estimateMin: 90,
      dependencies: ['brand:002:message-architecture'],
    },
    {
      id: 'asset:002:brand-kit',
      title: 'Assemble core brand kit and starter assets',
      deliverable: 'Brand kit including social templates, headers, and presentation deck',
      definitionOfDone: 'Brand kit complete with editable templates and usage notes.',
      estimateMin: 120,
      dependencies: ['brand:003:identity-direction'],
    },
    {
      id: 'launch:002:announcement',
      title: 'Publish brand launch announcement and audience CTA',
      deliverable: 'Public launch announcement with clear call-to-action link',
      definitionOfDone: 'Announcement posted and CTA destination verified live.',
      estimateMin: 60,
      dependencies: ['asset:002:brand-kit'],
    },
  ],
};

export function classifyLiveInputToArchetype(goalText: string): MigratedArchetype | 'UNKNOWN' {
  const text = String(goalText || '').toLowerCase();

  const ventureHits = ['startup', 'launch', 'mvp', 'product', 'feature', 'beta', 'user', 'jericho'].filter((token) =>
    text.includes(token)
  ).length;
  const fundraisingHits = [
    'angel',
    'seed round',
    'friends and family',
    'grant',
    'non-dilutive',
    'sponsor',
    'sponsorship',
    'partnership',
    'diligence',
    'data room',
    'raise',
    'fundraising',
  ].filter((token) => text.includes(token)).length;
  if (fundraisingHits >= 2 && ventureHits < 2) return 'Fundraising';
  if (text.includes('fundraising') && ventureHits < 2) return 'Fundraising';
  if (
    text.includes('investor') &&
    text.includes('raise') &&
    (text.includes('deck') || text.includes('narrative')) &&
    ventureHits < 2
  ) {
    return 'Fundraising';
  }

  const pqHits = ['cert', 'certification', 'exam', 'ccp', 'aws'].filter((token) => text.includes(token)).length;
  if (pqHits >= 2) return 'ProfessionalQualification';

  const tvStrongAnchorHits = ['tv', 'show', 'series', 'script', 'pilot', 'show bible'].filter((token) =>
    text.includes(token)
  ).length;
  const tvSupportHits = ['season', 'episode', 'arc', 'continuity'].filter((token) => text.includes(token)).length;
  if (tvStrongAnchorHits >= 1 && tvStrongAnchorHits + tvSupportHits >= 2) return 'GenericStructured.TVWriting';

  const brandHits = ['brand', 'identity', 'positioning', 'visual'].filter((token) => text.includes(token)).length;
  if (brandHits >= 2) return 'BrandLaunch';
  if (text.includes('brand') && ['presence', 'profile', 'launch'].some((t) => text.includes(t)) && ventureHits < 2)
    return 'BrandLaunch';

  const creativeHits = [
    'podcast',
    'music',
    'video',
    'manuscript',
    'longform',
    'book',
    'recording',
    'editing',
    'publish',
  ].filter((token) => text.includes(token)).length;
  if (creativeHits >= 1) return 'CreativeProduction';

  const venturePipelineHits = [
    'seed',
    'investor',
    'deck',
    'pitch',
    'fundraising',
    'outreach',
    'startup',
    'raise',
  ].filter((token) => text.includes(token)).length;
  if (venturePipelineHits >= 2 || ventureHits >= 2) return 'VentureLaunch';

  const salesHits = ['sales', 'b2b', 'prospect', 'deal', 'client', 'close'].filter((token) =>
    text.includes(token)
  ).length;
  if (salesHits >= 2) return 'SalesPipeline';

  const jobHits = ['job', 'role', 'resume', 'application', 'interview', 'offer', 'pipeline', 'pm', 'operations'].filter(
    (token) => text.includes(token)
  ).length;
  if (jobHits >= 1) return 'JobSearchPipeline';

  const physicalHits = [
    'training',
    'rehab',
    '5k',
    'strength',
    'conditioning',
    'weight',
    'pound',
    'lbs',
    'mobility',
    'lift',
    'run',
  ].filter((token) => text.includes(token)).length;
  if (physicalHits >= 1) return 'PhysicalTraining';

  return 'UNKNOWN';
}

function executionTypeForArchetype(archetype: MigratedArchetype): string {
  if (archetype === 'GenericStructured.TVWriting') return 'GenericStructured';
  return archetype;
}

export function getLiveTraceActionsForArchetype(archetype: MigratedArchetype): any[] {
  return (BASE_ACTIONS_BY_ARCHETYPE[archetype] || []).map((action) => ({ ...action }));
}

function hasCoreCoverageIssues(summary: ArchetypeRuleQualitySummary): boolean {
  return summary.issues.some((issue) => issue.code === 'MISSING_CORE_OUTPUT');
}

export function evaluateLiveTraceInput(input: ArchetypeLiveTraceInput): LiveTraceRunSummary {
  const classifiedArchetype = classifyLiveInputToArchetype(input.goalText);
  const actions = getLiveTraceActionsForArchetype(input.archetype);
  const qualitySummary = evaluateArchetypeRulesFromActions({
    executionType: executionTypeForArchetype(input.archetype),
    actions,
    contract: {
      goalText: input.goalText,
      terminalOutcome: {
        text: input.goalText,
      },
      deadlineHint: input.deadlineText || null,
    },
    cycleId: `live-${input.archetype}-${input.inputLabel}`,
  });

  const recommendation: LiveTraceRunSummary['recommendation'] = (() => {
    if (!qualitySummary.usesCanonicalDeliverablePath) return 'fail';
    if (qualitySummary.invalidCount > 0) return 'fail';
    if (!qualitySummary.schedulerReadiness.schedulerCompatible) return 'fail';
    if (qualitySummary.warningCount > 0 || classifiedArchetype === 'UNKNOWN') return 'warn';
    return 'pass';
  })();

  return {
    archetype: input.archetype,
    inputLabel: input.inputLabel,
    goalText: input.goalText,
    classifiedArchetype,
    classificationMatchesIntended: classifiedArchetype === input.archetype,
    usesCanonicalDeliverablePath: qualitySummary.usesCanonicalDeliverablePath,
    deliverableCount: qualitySummary.deliverableCount,
    actionSeedCount: actions.length,
    proposedBlockCompatible: qualitySummary.schedulerReadiness.schedulerCompatible,
    issues: qualitySummary.issues,
    coverage: {
      ...qualitySummary.coverage,
      hasCoreOutputCoverage: !hasCoreCoverageIssues(qualitySummary),
    },
    schedulerReadiness: qualitySummary.schedulerReadiness,
    recommendation,
  };
}

export function aggregateLiveTraceResults(results: LiveTraceRunSummary[]): LiveTraceAggregate {
  const aggregate: LiveTraceAggregate = {
    totalRuns: results.length,
    passCount: 0,
    warnCount: 0,
    failCount: 0,
    issueFrequency: {},
    byArchetype: {},
    byInputStyle: {},
  };

  results.forEach((result) => {
    aggregate.byArchetype[result.archetype] = aggregate.byArchetype[result.archetype] || { pass: 0, warn: 0, fail: 0 };
    aggregate.byInputStyle[result.inputLabel] = aggregate.byInputStyle[result.inputLabel] || {
      pass: 0,
      warn: 0,
      fail: 0,
    };

    if (result.recommendation === 'pass') {
      aggregate.passCount += 1;
      aggregate.byArchetype[result.archetype].pass += 1;
      aggregate.byInputStyle[result.inputLabel].pass += 1;
    } else if (result.recommendation === 'warn') {
      aggregate.warnCount += 1;
      aggregate.byArchetype[result.archetype].warn += 1;
      aggregate.byInputStyle[result.inputLabel].warn += 1;
    } else {
      aggregate.failCount += 1;
      aggregate.byArchetype[result.archetype].fail += 1;
      aggregate.byInputStyle[result.inputLabel].fail += 1;
    }

    result.issues.forEach((issue) => {
      aggregate.issueFrequency[issue.code] = (aggregate.issueFrequency[issue.code] || 0) + 1;
    });
  });

  return aggregate;
}

export function runArchetypeLiveTraceSuite(inputs: ArchetypeLiveTraceInput[]) {
  const summaries = (Array.isArray(inputs) ? inputs : []).map((input) => evaluateLiveTraceInput(input));
  return {
    summaries,
    aggregate: aggregateLiveTraceResults(summaries),
  };
}
