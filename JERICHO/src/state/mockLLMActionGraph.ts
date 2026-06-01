/**
 * mockLLMActionGraph.ts
 * Mock Claude responses for typed execution types.
 *
 * Swap in for callClaudeForActionGraph during development.
 * Returns deterministic, schema-valid action graphs that exercise
 * the full pipeline: parse → validate → reducer → calendar render.
 *
 * To switch to real API later, change one import in storeLLMActions.ts:
 *   import { callClaudeForActionGraph } from './llmActionGraph';      // real
 *   import { callClaudeForActionGraph } from './mockLLMActionGraph';  // mock
 */

import { buildAutoDeliverablesFromGoalContract } from '../domain/autoStrategy.ts';
import { generateAutoDeliverables } from '../core/autoDeliverables.ts';
import { parseLLMActionGraph, validateSessionPlan } from './llmActionGraph';
import type { ActionGraphResult } from './llmActionGraph';
import { REGULATED_PHYSICAL_CONSUMABLE_REALISM } from '../domain/goal/regulatedPhysicalConsumableRealism';
import type { StructuredPlanningIntake } from '../domain/goal/StructuredPlanningIntake';

// ---------------------------------------------------------------------------
// Mock responses — one per execution type
// ---------------------------------------------------------------------------

const MOCK_GRAPHS: Record<string, object> = {
  VentureLaunch: {
    version: 'jericho_action_graph_v1',
    executionType: 'VentureLaunch',
    actions: [
      // Phase 1: Validate
      {
        id: 'validate:001:customer-interviews',
        title: 'Conduct 5 customer discovery interviews',
        label: 'Conduct 5 customer discovery interviews',
        deliverable: 'Interview notes with top 3 recurring pain points identified',
        definitionOfDone: 'Five interviews completed, notes synthesized, primary pain point confirmed.',
        estimateMin: 120,
        category: 'VENTURE_LAUNCH',
        dependencies: [],
      },
      {
        id: 'validate:002:problem-hypothesis',
        title: 'Write problem hypothesis document',
        label: 'Write problem hypothesis document',
        deliverable: 'One-page problem hypothesis with target customer and pain point defined',
        definitionOfDone: 'Document written and reviewed against interview findings.',
        estimateMin: 60,
        category: 'VENTURE_LAUNCH',
        dependencies: ['validate:001:customer-interviews'],
      },
      {
        id: 'validate:003:assumption-map',
        title: 'Map riskiest assumptions for landing page',
        label: 'Map riskiest assumptions for landing page',
        deliverable: 'Ranked assumption list with top 3 hypotheses to test via waitlist',
        definitionOfDone: 'Assumptions ranked by risk and testability, shared with at least one peer.',
        estimateMin: 45,
        category: 'VENTURE_LAUNCH',
        dependencies: ['validate:002:problem-hypothesis'],
      },
      // Phase 2: Define
      {
        id: 'define:001:positioning',
        title: 'Draft value proposition and positioning statement',
        label: 'Draft value proposition and positioning statement',
        deliverable: 'One-sentence value prop and positioning statement for target customer',
        definitionOfDone: 'Value prop passes the "so what" test and is approved by founder.',
        estimateMin: 60,
        category: 'VENTURE_LAUNCH',
        dependencies: ['validate:003:assumption-map'],
      },
      {
        id: 'define:002:copy',
        title: 'Write landing page headline and body copy',
        label: 'Write landing page headline and body copy',
        deliverable: 'Headline, subheadline, 3 benefit bullets, and CTA copy',
        definitionOfDone: 'Copy reviewed, headline passes 5-second clarity test.',
        estimateMin: 90,
        category: 'VENTURE_LAUNCH',
        dependencies: ['define:001:positioning'],
      },
      {
        id: 'define:003:naming',
        title: 'Finalize product name and domain availability',
        label: 'Finalize product name and domain availability',
        deliverable: 'Product name selected with available .com domain confirmed',
        definitionOfDone: 'Domain checked, name finalized, no trademark conflicts found.',
        estimateMin: 45,
        category: 'VENTURE_LAUNCH',
        dependencies: ['define:001:positioning'],
      },
      // Phase 3: Build
      {
        id: 'build:001:wireframe',
        title: 'Create landing page wireframe',
        label: 'Create landing page wireframe',
        deliverable: 'Mobile and desktop wireframe with section layout defined',
        definitionOfDone: 'Wireframe reviewed, all sections accounted for, ready to build.',
        estimateMin: 60,
        category: 'VENTURE_LAUNCH',
        dependencies: ['define:002:copy', 'define:003:naming'],
      },
      {
        id: 'build:002:page',
        title: 'Build landing page in chosen platform',
        label: 'Build landing page in chosen platform',
        deliverable: 'Live landing page with email capture form deployed to domain',
        definitionOfDone: 'Page live, form submits correctly, mobile responsive confirmed.',
        estimateMin: 180,
        category: 'VENTURE_LAUNCH',
        dependencies: ['build:001:wireframe'],
      },
      {
        id: 'build:003:email-sequence',
        title: 'Set up waitlist confirmation email sequence',
        label: 'Set up waitlist confirmation email sequence',
        deliverable: 'Automated welcome email sent on signup with confirmation and next steps',
        definitionOfDone: 'Test signup triggers confirmation email within 2 minutes.',
        estimateMin: 60,
        category: 'VENTURE_LAUNCH',
        dependencies: ['build:002:page'],
      },
      // Phase 4: Launch
      {
        id: 'launch:001:soft-launch',
        title: 'Share landing page with personal network',
        label: 'Share landing page with personal network',
        deliverable: 'Page shared via email and social to personal network of 50+ contacts',
        definitionOfDone: 'Sent to full contact list, at least 10 people notified directly.',
        estimateMin: 60,
        category: 'VENTURE_LAUNCH',
        dependencies: ['build:003:email-sequence'],
      },
      {
        id: 'launch:002:distribution',
        title: 'Post in 3 relevant online communities',
        label: 'Post in 3 relevant online communities',
        deliverable: 'Posts live in 3 communities with engagement monitored for 48 hours',
        definitionOfDone: 'Three posts published, links tracked, at least one response received.',
        estimateMin: 90,
        category: 'VENTURE_LAUNCH',
        dependencies: ['launch:001:soft-launch'],
      },
      // Phase 5: Learn
      {
        id: 'learn:001:analyze',
        title: 'Analyze waitlist signups and traffic sources',
        label: 'Analyze waitlist signups and traffic sources',
        deliverable: 'Analysis doc with signup count, top traffic sources, and conversion rate',
        definitionOfDone: 'Data pulled, conversion funnel documented, key learnings written up.',
        estimateMin: 60,
        category: 'VENTURE_LAUNCH',
        dependencies: ['launch:002:distribution'],
      },
    ],
    templates: [
      {
        title: 'Weekly founder review',
        domain: 'Focus',
        durationMinutes: 30,
        frequency: 'weekly',
        reason: 'Review progress against launch milestones and adjust priorities',
      },
      {
        title: 'Daily outreach block',
        domain: 'Resources',
        durationMinutes: 20,
        frequency: 'daily',
        reason: 'Keep distribution momentum and respond to early signups',
      },
    ],
    diagnostics: {
      actionCount: 12,
      totalEstimateMin: 930,
      requiredWeeklyMinutes: 155,
      weeklyCapMinutes: 600,
      weeklyGapMinutes: 445,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for VentureLaunch — replace with live API call when credits available.'],
    },
  },

  SkillAcquisition: {
    version: 'jericho_action_graph_v1',
    executionType: 'SkillAcquisition',
    actions: [
      // Phase 1: Foundation
      {
        id: 'foundation:001:core-concepts',
        title: 'Study core concepts and mental models',
        label: 'Study core concepts and mental models',
        deliverable: 'Notes on 5 core concepts with personal examples',
        definitionOfDone: 'Notes written and reviewed, concepts explained in own words.',
        estimateMin: 60,
        category: 'SKILL_ACQUISITION',
        dependencies: [],
      },
      {
        id: 'foundation:002:setup',
        title: 'Set up practice environment and tools',
        label: 'Set up practice environment and tools',
        deliverable: 'Practice environment configured and tested with first exercise',
        definitionOfDone: 'Environment working, first exercise completed without setup errors.',
        estimateMin: 45,
        category: 'SKILL_ACQUISITION',
        dependencies: [],
      },
      {
        id: 'foundation:003:vocabulary',
        title: 'Build foundational vocabulary and reference sheet',
        label: 'Build foundational vocabulary and reference sheet',
        deliverable: 'Reference sheet with 20+ key terms and definitions',
        definitionOfDone: 'Reference sheet complete and used during first practice session.',
        estimateMin: 45,
        category: 'SKILL_ACQUISITION',
        dependencies: ['foundation:001:core-concepts'],
      },
      // Phase 2: Comprehension
      {
        id: 'comprehension:001:examples',
        title: 'Study 10 worked examples in target skill',
        label: 'Study 10 worked examples in target skill',
        deliverable: 'Annotated examples with observations on patterns',
        definitionOfDone: '10 examples reviewed, 3 key patterns identified and documented.',
        estimateMin: 90,
        category: 'SKILL_ACQUISITION',
        dependencies: ['foundation:003:vocabulary'],
      },
      {
        id: 'comprehension:002:resources',
        title: 'Complete primary learning resource (book/course/videos)',
        label: 'Complete primary learning resource (book/course/videos)',
        deliverable: 'Learning resource completed with chapter notes',
        definitionOfDone: 'Resource finished, notes organized by topic, gaps identified.',
        estimateMin: 120,
        category: 'SKILL_ACQUISITION',
        dependencies: ['foundation:003:vocabulary'],
      },
      {
        id: 'comprehension:003:synthesis',
        title: 'Write synthesis of key principles learned',
        label: 'Write synthesis of key principles learned',
        deliverable: 'One-page synthesis connecting core principles to practice',
        definitionOfDone: 'Synthesis written without referencing source material.',
        estimateMin: 45,
        category: 'SKILL_ACQUISITION',
        dependencies: ['comprehension:001:examples', 'comprehension:002:resources'],
      },
      // Phase 3: Production
      {
        id: 'production:001:first-project',
        title: 'Complete first independent practice project',
        label: 'Complete first independent practice project',
        deliverable: 'Completed practice project applying core skill',
        definitionOfDone: 'Project finished and self-reviewed against success criteria.',
        estimateMin: 120,
        category: 'SKILL_ACQUISITION',
        dependencies: ['comprehension:003:synthesis'],
      },
      {
        id: 'production:002:drills',
        title: 'Complete targeted drills on weak areas',
        label: 'Complete targeted drills on weak areas',
        deliverable: 'Drill log with 20 completed exercises targeting identified gaps',
        definitionOfDone: '20 drills completed, improvement in weak area confirmed.',
        estimateMin: 90,
        category: 'SKILL_ACQUISITION',
        dependencies: ['production:001:first-project'],
      },
      {
        id: 'production:003:second-project',
        title: 'Complete second project with increased complexity',
        label: 'Complete second project with increased complexity',
        deliverable: 'Second project completed at higher difficulty than first',
        definitionOfDone: 'Project finished, complexity step-up achieved, reviewed by self.',
        estimateMin: 150,
        category: 'SKILL_ACQUISITION',
        dependencies: ['production:002:drills'],
      },
      // Phase 4: Integration
      {
        id: 'integration:001:real-application',
        title: 'Apply skill in real-world context',
        label: 'Apply skill in real-world context',
        deliverable: 'Real-world application completed with outcome documented',
        definitionOfDone: 'Skill used in genuine context, not practice environment.',
        estimateMin: 90,
        category: 'SKILL_ACQUISITION',
        dependencies: ['production:003:second-project'],
      },
      {
        id: 'integration:002:feedback',
        title: 'Get feedback from peer or mentor on work',
        label: 'Get feedback from peer or mentor on work',
        deliverable: 'Feedback session completed with notes on improvements',
        definitionOfDone: 'Feedback received from qualified person, action items written.',
        estimateMin: 60,
        category: 'SKILL_ACQUISITION',
        dependencies: ['integration:001:real-application'],
      },
      // Phase 5: Mastery check
      {
        id: 'mastery:001:assessment',
        title: 'Complete self-assessment against target skill level',
        label: 'Complete self-assessment against target skill level',
        deliverable: 'Self-assessment document with skill level rating and evidence',
        definitionOfDone: 'Assessment complete, target level reached or gap plan written.',
        estimateMin: 45,
        category: 'SKILL_ACQUISITION',
        dependencies: ['integration:002:feedback'],
      },
    ],
    templates: [
      {
        title: 'Daily practice session',
        domain: 'Focus',
        durationMinutes: 30,
        frequency: 'daily',
        reason: 'Consistent practice builds retention and fluency',
      },
      {
        title: 'Weekly review and planning',
        domain: 'Focus',
        durationMinutes: 20,
        frequency: 'weekly',
        reason: 'Review progress and adjust learning plan',
      },
    ],
    diagnostics: {
      actionCount: 12,
      totalEstimateMin: 960,
      requiredWeeklyMinutes: 120,
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 180,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for SkillAcquisition.'],
    },
  },

  ProfessionalQualification: {
    version: 'jericho_action_graph_v1',
    executionType: 'ProfessionalQualification',
    actions: [
      {
        id: 'study:001:domain-one',
        title: 'Study Domain 1: Core foundations',
        label: 'Study Domain 1: Core foundations',
        deliverable: 'Domain 1 notes with key concepts and formulas',
        definitionOfDone: 'Domain 1 complete, flashcards created, self-quiz passed at 80%.',
        estimateMin: 120,
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: [],
      },
      {
        id: 'study:002:domain-two',
        title: 'Study Domain 2: Systems and architecture',
        label: 'Study Domain 2: Systems and architecture',
        deliverable: 'Domain 2 notes with diagrams and worked examples',
        definitionOfDone: 'Domain 2 complete, flashcards created, self-quiz passed at 80%.',
        estimateMin: 120,
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: [],
      },
      {
        id: 'study:003:domain-three',
        title: 'Study Domain 3: Operations and processes',
        label: 'Study Domain 3: Operations and processes',
        deliverable: 'Domain 3 notes with process flows documented',
        definitionOfDone: 'Domain 3 complete, flashcards created, self-quiz passed at 80%.',
        estimateMin: 120,
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: [],
      },
      {
        id: 'study:004:domain-four',
        title: 'Study Domain 4: Security and compliance',
        label: 'Study Domain 4: Security and compliance',
        deliverable: 'Domain 4 notes with compliance frameworks mapped',
        definitionOfDone: 'Domain 4 complete, flashcards created, self-quiz passed at 80%.',
        estimateMin: 120,
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: [],
      },
      {
        id: 'practice:001:first-test',
        title: 'Complete first full-length practice exam',
        label: 'Complete first full-length practice exam',
        deliverable: 'Practice exam completed with score and weak areas identified',
        definitionOfDone: 'Exam completed under timed conditions, score recorded, gaps listed.',
        estimateMin: 120,
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: [
          'study:001:domain-one',
          'study:002:domain-two',
          'study:003:domain-three',
          'study:004:domain-four',
        ],
      },
      {
        id: 'practice:002:second-test',
        title: 'Complete second full-length practice exam',
        label: 'Complete second full-length practice exam',
        deliverable: 'Second practice exam with score improvement documented',
        definitionOfDone: 'Score improved by at least 5% over first attempt.',
        estimateMin: 120,
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: ['practice:001:first-test'],
      },
      {
        id: 'review:001:weak-areas',
        title: 'Deep review of weak domain areas',
        label: 'Deep review of weak domain areas',
        deliverable: 'Targeted review notes for bottom 2 scoring domains',
        definitionOfDone: 'Weak domains reviewed, additional practice questions completed.',
        estimateMin: 90,
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: ['practice:002:second-test'],
      },
      {
        id: 'review:002:question-bank',
        title: 'Complete 200-question targeted question bank',
        label: 'Complete 200-question targeted question bank',
        deliverable: '200 practice questions answered with review of all incorrect answers',
        definitionOfDone: '200 questions complete, all wrong answers reviewed and understood.',
        estimateMin: 180,
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: ['review:001:weak-areas'],
      },
      {
        id: 'finalprep:001:review',
        title: 'Final 48-hour review of key formulas and concepts',
        label: 'Final 48-hour review of key formulas and concepts',
        deliverable: 'Final cheat sheet of must-know items reviewed',
        definitionOfDone: 'Cheat sheet reviewed, exam logistics confirmed, rest scheduled.',
        estimateMin: 60,
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: ['review:002:question-bank'],
      },
      {
        id: 'finalprep:002:exam',
        title: 'Sit and complete the certification exam',
        label: 'Sit and complete the certification exam',
        deliverable: 'Exam completed and result received',
        definitionOfDone: 'Exam taken, result documented, pass/fail recorded.',
        estimateMin: 180,
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: ['finalprep:001:review'],
      },
    ],
    templates: [
      {
        title: 'Daily study block',
        domain: 'Focus',
        durationMinutes: 45,
        frequency: 'daily',
        reason: 'Consistent study builds retention for exam success',
      },
      {
        title: 'Weekly practice questions',
        domain: 'Focus',
        durationMinutes: 30,
        frequency: 'weekly',
        reason: 'Regular practice questions identify gaps early',
      },
    ],
    diagnostics: {
      actionCount: 10,
      totalEstimateMin: 1230,
      requiredWeeklyMinutes: 154,
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 146,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for ProfessionalQualification.'],
    },
  },

  PhysicalTraining: {
    version: 'jericho_action_graph_v1',
    executionType: 'PhysicalTraining',
    actions: [
      {
        id: 'base:001:movement-screen',
        title: 'Complete movement screen and set baseline metrics',
        label: 'Complete movement screen and set baseline metrics',
        deliverable: 'Baseline fitness metrics recorded: weight, resting HR, benchmark workout time',
        definitionOfDone: 'All baseline metrics recorded and logged.',
        estimateMin: 45,
        category: 'PHYSICAL_TRAINING',
        dependencies: [],
      },
      {
        id: 'base:002:week1-2',
        title: 'Complete base building weeks 1–2 training sessions',
        label: 'Complete base building weeks 1–2 training sessions',
        deliverable: '6 training sessions logged with effort and form notes',
        definitionOfDone: 'Six sessions completed, no injuries, form cues applied consistently.',
        estimateMin: 180,
        category: 'PHYSICAL_TRAINING',
        dependencies: ['base:001:movement-screen'],
      },
      {
        id: 'base:003:week3-4',
        title: 'Complete base building weeks 3–4 training sessions',
        label: 'Complete base building weeks 3–4 training sessions',
        deliverable: '6 training sessions with progressive volume increase documented',
        definitionOfDone: 'Volume increased 10% over prior block, sessions logged.',
        estimateMin: 180,
        category: 'PHYSICAL_TRAINING',
        dependencies: ['base:002:week1-2'],
      },
      {
        id: 'base:004:mobility-protocol',
        title: 'Establish mobility and recovery protocol',
        label: 'Establish mobility and recovery protocol',
        deliverable: 'Weekly mobility protocol with targeted warmup and cooldown drills',
        definitionOfDone: 'Protocol documented and used before and after each training session for one week.',
        estimateMin: 45,
        category: 'PHYSICAL_TRAINING',
        dependencies: ['base:003:week3-4'],
      },
      {
        id: 'build:001:week5-6',
        title: 'Complete build phase weeks 5–6',
        label: 'Complete build phase weeks 5–6',
        deliverable: '6 sessions with increased intensity and sport-specific work',
        definitionOfDone: 'Intensity up from base phase, sport-specific movements introduced.',
        estimateMin: 180,
        category: 'PHYSICAL_TRAINING',
        dependencies: ['base:003:week3-4'],
      },
      {
        id: 'build:002:week7-8',
        title: 'Complete build phase weeks 7–8',
        label: 'Complete build phase weeks 7–8',
        deliverable: '6 sessions at peak build volume with benchmark re-test',
        definitionOfDone: 'Peak volume reached, benchmark re-test shows improvement.',
        estimateMin: 180,
        category: 'PHYSICAL_TRAINING',
        dependencies: ['build:001:week5-6'],
      },
      {
        id: 'build:003:midpoint-assessment',
        title: 'Midpoint fitness assessment and plan adjustment',
        label: 'Midpoint fitness assessment and plan adjustment',
        deliverable: 'Assessment results with adjusted plan for peak phase',
        definitionOfDone: 'Assessment complete, adjustments made to peak phase plan.',
        estimateMin: 45,
        category: 'PHYSICAL_TRAINING',
        dependencies: ['build:002:week7-8'],
      },
      {
        id: 'peak:001:week9-10',
        title: 'Complete peak phase weeks 9–10',
        label: 'Complete peak phase weeks 9–10',
        deliverable: '6 high-intensity sessions with race/event pace work',
        definitionOfDone: 'Peak sessions complete, target pace or weight achieved in at least one session.',
        estimateMin: 180,
        category: 'PHYSICAL_TRAINING',
        dependencies: ['build:003:midpoint-assessment'],
      },
      {
        id: 'peak:002:week11-12',
        title: 'Complete peak phase weeks 11–12',
        label: 'Complete peak phase weeks 11–12',
        deliverable: '4 sessions with final sharpening and event simulation',
        definitionOfDone: 'Event simulation completed, confidence assessment done.',
        estimateMin: 120,
        category: 'PHYSICAL_TRAINING',
        dependencies: ['peak:001:week9-10'],
      },
      {
        id: 'taper:001:week13-14',
        title: 'Complete taper phase — reduce volume, maintain intensity',
        label: 'Complete taper phase — reduce volume, maintain intensity',
        deliverable: '4 sessions at 50% volume with full intensity maintained',
        definitionOfDone: 'Taper sessions complete, feeling rested and sharp.',
        estimateMin: 90,
        category: 'PHYSICAL_TRAINING',
        dependencies: ['peak:002:week11-12'],
      },
      {
        id: 'event:001:target-performance',
        title: 'Complete target performance event',
        label: 'Complete target performance event',
        deliverable: 'Event completed with result documented',
        definitionOfDone: 'Event finished, result recorded, recovery plan initiated.',
        estimateMin: 120,
        category: 'PHYSICAL_TRAINING',
        dependencies: ['taper:001:week13-14'],
      },
      {
        id: 'event:002:post-event-review',
        title: 'Run post-event review and next-cycle recommendations',
        label: 'Run post-event review and next-cycle recommendations',
        deliverable: 'Post-event review with performance deltas and next cycle priorities',
        definitionOfDone: 'Review completed with objective metrics, lessons learned, and next-cycle plan.',
        estimateMin: 60,
        category: 'PHYSICAL_TRAINING',
        dependencies: ['event:001:target-performance'],
      },
    ],
    templates: [
      {
        title: 'Training session',
        domain: 'Body',
        durationMinutes: 60,
        frequency: '3x/week',
        reason: 'Consistent training stimulus drives adaptation',
      },
      {
        title: 'Recovery and mobility work',
        domain: 'Body',
        durationMinutes: 20,
        frequency: 'daily',
        reason: 'Active recovery reduces injury risk and improves performance',
      },
    ],
    diagnostics: {
      actionCount: 12,
      totalEstimateMin: 1425,
      requiredWeeklyMinutes: 102,
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 198,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for PhysicalTraining.'],
    },
  },

  JobSearchPipeline: {
    version: 'jericho_action_graph_v1',
    executionType: 'JobSearchPipeline',
    actions: [
      {
        id: 'prep:001:target-role-map',
        title: 'Define target role map and search criteria',
        label: 'Define target role map and search criteria',
        deliverable: 'Target role profile with industries, locations, and compensation bounds',
        definitionOfDone: 'Target criteria document finalized with clear include/exclude rules.',
        estimateMin: 60,
        category: 'VENTURE_LAUNCH',
        dependencies: [],
      },
      {
        id: 'prep:002:resume-portfolio',
        title: 'Tailor resume and portfolio for target roles',
        label: 'Tailor resume and portfolio for target roles',
        deliverable: 'Updated resume and portfolio with role-specific positioning',
        definitionOfDone: 'Resume and portfolio reviewed against 5 live job descriptions.',
        estimateMin: 120,
        category: 'VENTURE_LAUNCH',
        dependencies: ['prep:001:target-role-map'],
      },
      {
        id: 'prep:003:linkedin-story',
        title: 'Update LinkedIn narrative and proof highlights',
        label: 'Update LinkedIn narrative and proof highlights',
        deliverable: 'LinkedIn profile updated with measurable outcomes and featured work',
        definitionOfDone: 'Headline, about section, and featured projects aligned to target roles.',
        estimateMin: 75,
        category: 'VENTURE_LAUNCH',
        dependencies: ['prep:002:resume-portfolio'],
      },
      {
        id: 'pipeline:001:company-list',
        title: 'Build prioritized company pipeline list',
        label: 'Build prioritized company pipeline list',
        deliverable: 'Ranked list of 30 target companies and role links',
        definitionOfDone: 'List includes role fit score and contact strategy per company.',
        estimateMin: 90,
        category: 'VENTURE_LAUNCH',
        dependencies: ['prep:003:linkedin-story'],
      },
      {
        id: 'pipeline:002:outreach-plan',
        title: 'Create referral and networking outreach plan',
        label: 'Create referral and networking outreach plan',
        deliverable: 'Weekly outreach sequence with contact targets and scripts',
        definitionOfDone: 'Outreach template tested and first 10 contacts identified.',
        estimateMin: 75,
        category: 'VENTURE_LAUNCH',
        dependencies: ['pipeline:001:company-list'],
      },
      {
        id: 'pipeline:003:application-batch-1',
        title: 'Submit first batch of tailored applications',
        label: 'Submit first batch of tailored applications',
        deliverable: '10 tailored applications submitted with tracking links',
        definitionOfDone: 'Applications sent and logged with follow-up dates.',
        estimateMin: 120,
        category: 'VENTURE_LAUNCH',
        dependencies: ['pipeline:002:outreach-plan'],
      },
      {
        id: 'interview:001:story-bank',
        title: 'Build interview story bank from prior results',
        label: 'Build interview story bank from prior results',
        deliverable: 'STAR story bank covering leadership, impact, and conflict examples',
        definitionOfDone: 'At least 8 polished stories ready for behavioral interviews.',
        estimateMin: 90,
        category: 'VENTURE_LAUNCH',
        dependencies: ['pipeline:003:application-batch-1'],
      },
      {
        id: 'interview:002:mock-round',
        title: 'Run two mock interview rounds',
        label: 'Run two mock interview rounds',
        deliverable: 'Mock interview feedback with gap remediation plan',
        definitionOfDone: 'Two mocks completed and top improvement actions documented.',
        estimateMin: 90,
        category: 'VENTURE_LAUNCH',
        dependencies: ['interview:001:story-bank'],
      },
      {
        id: 'pipeline:004:application-batch-2',
        title: 'Submit second batch of tailored applications',
        label: 'Submit second batch of tailored applications',
        deliverable: 'Second set of 10 tailored applications submitted',
        definitionOfDone: 'Batch submitted with custom cover points and tracker updates.',
        estimateMin: 120,
        category: 'VENTURE_LAUNCH',
        dependencies: ['interview:002:mock-round'],
      },
      {
        id: 'close:001:pipeline-review',
        title: 'Review pipeline conversion and adjust weekly targets',
        label: 'Review pipeline conversion and adjust weekly targets',
        deliverable: 'Pipeline conversion dashboard with next-step target adjustments',
        definitionOfDone: 'Conversion rates reviewed and weekly application/outreach targets recalibrated.',
        estimateMin: 60,
        category: 'VENTURE_LAUNCH',
        dependencies: ['pipeline:004:application-batch-2'],
      },
    ],
    templates: [
      {
        title: 'Daily outreach follow-up block',
        domain: 'Resources',
        durationMinutes: 30,
        frequency: 'daily',
        reason: 'Consistent follow-up keeps pipeline moving to interview stages',
      },
      {
        title: 'Weekly pipeline metrics review',
        domain: 'Focus',
        durationMinutes: 45,
        frequency: 'weekly',
        reason: 'Weekly conversion review keeps search strategy adaptive and honest',
      },
    ],
    diagnostics: {
      actionCount: 10,
      totalEstimateMin: 900,
      requiredWeeklyMinutes: 129,
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 171,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for JobSearchPipeline.'],
    },
  },

  CreativeProduction: {
    version: 'jericho_action_graph_v1',
    executionType: 'CreativeProduction',
    actions: [
      {
        id: 'concept:001:creative-brief',
        title: 'Draft creative brief and narrative intent',
        label: 'Draft creative brief and narrative intent',
        deliverable: 'Creative brief with audience, tone, and success criteria',
        definitionOfDone: 'Brief captures target audience, emotional intent, and release goal.',
        estimateMin: 60,
        category: 'CREATIVE_PRODUCTION',
        dependencies: [],
      },
      {
        id: 'concept:002:reference-board',
        title: 'Build reference board and style direction',
        label: 'Build reference board and style direction',
        deliverable: 'Reference board with visual/audio/story influences and rationale',
        definitionOfDone: 'Reference board finalized with approved style direction notes.',
        estimateMin: 75,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['concept:001:creative-brief'],
      },
      {
        id: 'structure:001:production-outline',
        title: 'Create production outline and scene/content map',
        label: 'Create production outline and scene/content map',
        deliverable: 'Structured outline for core segments, beats, or scenes',
        definitionOfDone: 'Outline complete with ordered sections and timing guidance.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['concept:002:reference-board'],
      },
      {
        id: 'draft:001:first-pass',
        title: 'Produce first full draft of core artifact',
        label: 'Produce first full draft of core artifact',
        deliverable: 'First full draft of script, episode, tracklist, or chapter set',
        definitionOfDone: 'First draft completed end-to-end without missing sections.',
        estimateMin: 120,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['structure:001:production-outline'],
      },
      {
        id: 'draft:002:internal-review',
        title: 'Run internal review and annotate revision priorities',
        label: 'Run internal review and annotate revision priorities',
        deliverable: 'Revision log categorized by high, medium, and low priority changes',
        definitionOfDone: 'Revision log completed with at least 10 concrete edits listed.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['draft:001:first-pass'],
      },
      {
        id: 'revise:001:second-pass',
        title: 'Execute second-pass revision for clarity and flow',
        label: 'Execute second-pass revision for clarity and flow',
        deliverable: 'Second draft with improved structure, pacing, and coherence',
        definitionOfDone: 'Second draft resolves all high-priority revision items.',
        estimateMin: 120,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['draft:002:internal-review'],
      },
      {
        id: 'revise:002:technical-polish',
        title: 'Complete technical polish pass and formatting cleanup',
        label: 'Complete technical polish pass and formatting cleanup',
        deliverable: 'Production-ready draft with format, continuity, and quality checks complete',
        definitionOfDone: 'No major formatting defects and continuity checks pass.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['revise:001:second-pass'],
      },
      {
        id: 'package:001:release-assets',
        title: 'Prepare release package and supporting metadata',
        label: 'Prepare release package and supporting metadata',
        deliverable: 'Release folder including final artifact, descriptions, and supporting assets',
        definitionOfDone: 'Release package includes final files plus publishing metadata.',
        estimateMin: 120,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['revise:002:technical-polish'],
      },
      {
        id: 'publish:001:distribution-setup',
        title: 'Configure distribution channels and publication checklist',
        label: 'Configure distribution channels and publication checklist',
        deliverable: 'Distribution checklist with scheduled publish steps by channel',
        definitionOfDone: 'All channels configured and checklist validated in dry run.',
        estimateMin: 60,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['package:001:release-assets'],
      },
      {
        id: 'publish:002:post-release-review',
        title: 'Publish and run post-release quality review',
        label: 'Publish and run post-release quality review',
        deliverable: 'Post-release report with quality notes and next iteration backlog',
        definitionOfDone: 'Published artifact verified live with issues logged for next cycle.',
        estimateMin: 45,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['publish:001:distribution-setup'],
      },
    ],
    templates: [
      {
        title: 'Daily deep creation block',
        domain: 'Creation',
        durationMinutes: 60,
        frequency: 'daily',
        reason: 'Sustains creative throughput and preserves context.',
      },
      {
        title: 'Weekly critique and revision block',
        domain: 'Focus',
        durationMinutes: 45,
        frequency: 'weekly',
        reason: 'Ensures quality improves with deliberate review loops.',
      },
    ],
    diagnostics: {
      actionCount: 10,
      totalEstimateMin: 870,
      requiredWeeklyMinutes: 124,
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 176,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for CreativeProduction.'],
    },
  },

  BrandLaunch: {
    version: 'jericho_action_graph_v1',
    executionType: 'BrandLaunch',
    actions: [
      {
        id: 'brand:001:positioning-brief',
        title: 'Define brand positioning and audience promise',
        label: 'Define brand positioning and audience promise',
        deliverable: 'Positioning brief with value proposition, audience, and differentiation',
        definitionOfDone: 'Positioning brief approved with single-sentence core promise.',
        estimateMin: 60,
        category: 'CREATIVE_PRODUCTION',
        dependencies: [],
      },
      {
        id: 'brand:002:message-architecture',
        title: 'Build messaging architecture for priority channels',
        label: 'Build messaging architecture for priority channels',
        deliverable: 'Messaging map for homepage, social bio, and outreach copy',
        definitionOfDone: 'Messaging map finalized with channel-specific voice guidelines.',
        estimateMin: 75,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['brand:001:positioning-brief'],
      },
      {
        id: 'brand:003:identity-direction',
        title: 'Select visual identity direction and style standards',
        label: 'Select visual identity direction and style standards',
        deliverable: 'Identity direction board with typography, palette, and usage rules',
        definitionOfDone: 'Style direction approved and documented as reusable standards.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['brand:002:message-architecture'],
      },
      {
        id: 'asset:001:logo-system',
        title: 'Design logo and core visual mark system',
        label: 'Design logo and core visual mark system',
        deliverable: 'Logo package with primary, secondary, and icon lockups',
        definitionOfDone: 'Logo variants exported and validated for web/social use.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['brand:003:identity-direction'],
      },
      {
        id: 'asset:002:brand-kit',
        title: 'Assemble core brand kit and starter assets',
        label: 'Assemble core brand kit and starter assets',
        deliverable: 'Brand kit including social templates, headers, and presentation deck',
        definitionOfDone: 'Brand kit complete with editable templates and usage notes.',
        estimateMin: 120,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['asset:001:logo-system'],
      },
      {
        id: 'channel:001:profile-rollout',
        title: 'Update priority channel profiles and bios',
        label: 'Update priority channel profiles and bios',
        deliverable: 'Updated profiles for website, LinkedIn, and core social channels',
        definitionOfDone: 'All priority profiles updated and visually consistent.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['asset:002:brand-kit'],
      },
      {
        id: 'launch:001:announcement-copy',
        title: 'Prepare launch announcement copy and CTA assets',
        label: 'Prepare launch announcement copy and CTA assets',
        deliverable: 'Announcement draft with CTA copy and channel-ready assets',
        definitionOfDone: 'Announcement copy approved and CTA assets packaged for publishing.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['channel:001:profile-rollout'],
      },
      {
        id: 'launch:002:announcement',
        title: 'Publish brand launch announcement and audience CTA',
        label: 'Publish brand launch announcement and audience CTA',
        deliverable: 'Public launch announcement with clear call-to-action link',
        definitionOfDone: 'Announcement posted and CTA destination verified live.',
        estimateMin: 60,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['launch:001:announcement-copy'],
      },
      {
        id: 'review:001:audience-response-review',
        title: 'Review audience response and channel consistency',
        label: 'Review audience response and channel consistency',
        deliverable: 'Review log of audience response signals and consistency checks',
        definitionOfDone: 'Response review completed with channel consistency notes.',
        estimateMin: 75,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['launch:002:announcement'],
      },
      {
        id: 'review:002:brand-retro',
        title: 'Run launch retrospective and next-cycle brand priorities',
        label: 'Run launch retrospective and next-cycle brand priorities',
        deliverable: 'Retrospective document with top insights and next 30-day priorities',
        definitionOfDone: 'Retrospective completed with 3 measurable next actions.',
        estimateMin: 45,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['review:001:audience-response-review'],
      },
    ],
    templates: [
      {
        title: 'Daily brand consistency check',
        domain: 'Focus',
        durationMinutes: 20,
        frequency: 'daily',
        reason: 'Keeps messaging and visuals aligned across active channels.',
      },
      {
        title: 'Weekly audience feedback review',
        domain: 'Resources',
        durationMinutes: 40,
        frequency: 'weekly',
        reason: 'Improves resonance by iterating from real audience signal.',
      },
    ],
    diagnostics: {
      actionCount: 10,
      totalEstimateMin: 795,
      requiredWeeklyMinutes: 114,
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 186,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for BrandLaunch.'],
    },
  },

  SalesPipeline: {
    version: 'jericho_action_graph_v1',
    executionType: 'SalesPipeline',
    actions: [
      {
        id: 'sales:001:offer-clarity',
        title: 'Clarify offer, pricing tiers, and qualification criteria',
        label: 'Clarify offer, pricing tiers, and qualification criteria',
        deliverable: 'Sales offer sheet with pricing, scope, and qualification gates',
        definitionOfDone: 'Offer sheet finalized with explicit qualification requirements.',
        estimateMin: 60,
        category: 'CREATIVE_PRODUCTION',
        dependencies: [],
      },
      {
        id: 'sales:002:icp-targeting',
        title: 'Define ICP and build first target account list',
        label: 'Define ICP and build first target account list',
        deliverable: 'Prioritized list of 80 target leads with segment tags',
        definitionOfDone: 'Lead list completed with segment and outreach priority scoring.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['sales:001:offer-clarity'],
      },
      {
        id: 'sales:003:outreach-assets',
        title: 'Create outreach scripts and objection-handling library',
        label: 'Create outreach scripts and objection-handling library',
        deliverable: 'Outbound templates and objection-response playbook',
        definitionOfDone: 'Scripts tested in role-play and objection library finalized.',
        estimateMin: 75,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['sales:002:icp-targeting'],
      },
      {
        id: 'sales:004:crm-setup',
        title: 'Configure CRM stages and pipeline tracking dashboard',
        label: 'Configure CRM stages and pipeline tracking dashboard',
        deliverable: 'CRM board with lead stages, owners, and conversion fields',
        definitionOfDone: 'CRM flow tested end-to-end from lead to closed outcome.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['sales:003:outreach-assets'],
      },
      {
        id: 'sales:005:first-outreach-wave',
        title: 'Execute first outreach wave to top-priority leads',
        label: 'Execute first outreach wave to top-priority leads',
        deliverable: 'First outreach batch sent to 40 qualified leads',
        definitionOfDone: 'Outreach sent and all leads logged with follow-up dates.',
        estimateMin: 120,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['sales:004:crm-setup'],
      },
      {
        id: 'sales:006:discovery-calls',
        title: 'Run discovery calls and qualify active opportunities',
        label: 'Run discovery calls and qualify active opportunities',
        deliverable: 'Discovery call notes with qualification status for each lead',
        definitionOfDone: 'At least 10 discovery calls completed and staged in CRM.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['sales:005:first-outreach-wave'],
      },
      {
        id: 'sales:007:proposal-packages',
        title: 'Prepare tailored proposal packages for qualified leads',
        label: 'Prepare tailored proposal packages for qualified leads',
        deliverable: 'Proposal set with scope, pricing, and implementation terms',
        definitionOfDone: 'Proposals delivered to qualified prospects with deadlines.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['sales:006:discovery-calls'],
      },
      {
        id: 'sales:008:followup-negotiation',
        title: 'Execute follow-up and negotiation sequence',
        label: 'Execute follow-up and negotiation sequence',
        deliverable: 'Negotiation tracker with next-step commitments per opportunity',
        definitionOfDone: 'All proposal-stage leads have active next steps scheduled.',
        estimateMin: 120,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['sales:007:proposal-packages'],
      },
      {
        id: 'sales:009:close-and-handoff',
        title: 'Close deals and prepare onboarding handoff package',
        label: 'Close deals and prepare onboarding handoff package',
        deliverable: 'Closed-won summaries with onboarding briefs for delivery team',
        definitionOfDone: 'Closed deals documented and handoff package completed.',
        estimateMin: 60,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['sales:008:followup-negotiation'],
      },
      {
        id: 'sales:010:pipeline-retro',
        title: 'Review conversion metrics and optimize next pipeline cycle',
        label: 'Review conversion metrics and optimize next pipeline cycle',
        deliverable: 'Pipeline metrics report with optimization actions for next sprint',
        definitionOfDone: 'Conversion bottlenecks identified with corrective actions assigned.',
        estimateMin: 60,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['sales:009:close-and-handoff'],
      },
    ],
    templates: [
      {
        title: 'Daily outreach cadence block',
        domain: 'Resources',
        durationMinutes: 45,
        frequency: 'daily',
        reason: 'Maintains top-of-funnel volume and response momentum.',
      },
      {
        title: 'Weekly conversion review',
        domain: 'Focus',
        durationMinutes: 45,
        frequency: 'weekly',
        reason: 'Improves close rate through iterative pipeline tuning.',
      },
    ],
    diagnostics: {
      actionCount: 10,
      totalEstimateMin: 855,
      requiredWeeklyMinutes: 122,
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 178,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for SalesPipeline.'],
    },
  },

  Fundraising: {
    version: 'jericho_action_graph_v1',
    executionType: 'Fundraising',
    actions: [
      {
        id: 'raise:001:funding-thesis',
        title: 'Define raise objective, use-of-funds, and investor thesis',
        label: 'Define raise objective, use-of-funds, and investor thesis',
        deliverable: 'Funding thesis memo with target amount, milestones, and allocation plan',
        definitionOfDone: 'Funding thesis memo finalized with clear milestones and raise size.',
        estimateMin: 75,
        category: 'CREATIVE_PRODUCTION',
        dependencies: [],
      },
      {
        id: 'raise:002:deck-narrative',
        title: 'Build fundraising narrative and deck storyline',
        label: 'Build fundraising narrative and deck storyline',
        deliverable: 'Narrative-first deck outline covering problem, traction, and plan',
        definitionOfDone: 'Deck storyline approved with coherent narrative arc and proof points.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['raise:001:funding-thesis'],
      },
      {
        id: 'raise:003:data-room-checklist',
        title: 'Create diligence checklist and data room structure',
        label: 'Create diligence checklist and data room structure',
        deliverable: 'Diligence checklist and structured data room index',
        definitionOfDone: 'Data room index complete with required document placeholders.',
        estimateMin: 60,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['raise:002:deck-narrative'],
      },
      {
        id: 'raise:004:investor-target-list',
        title: 'Build target investor list and fit scoring model',
        label: 'Build target investor list and fit scoring model',
        deliverable: 'Prioritized investor pipeline with stage, thesis fit, and intro paths',
        definitionOfDone: 'Investor list includes at least 60 targets with fit scores.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['raise:003:data-room-checklist'],
      },
      {
        id: 'raise:005:outreach-sequences',
        title: 'Prepare outreach sequences and intro request scripts',
        label: 'Prepare outreach sequences and intro request scripts',
        deliverable: 'Outbound sequence pack for warm intros and direct outreach',
        definitionOfDone: 'Sequences finalized with follow-up cadences and personalization tokens.',
        estimateMin: 120,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['raise:004:investor-target-list'],
      },
      {
        id: 'raise:006:first-meeting-wave',
        title: 'Run first wave of investor outreach and meetings',
        label: 'Run first wave of investor outreach and meetings',
        deliverable: 'Meeting log with investor responses and status updates',
        definitionOfDone: 'At least 15 investor meetings completed and logged.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['raise:005:outreach-sequences'],
      },
      {
        id: 'raise:007:followup-materials',
        title: 'Deliver follow-up materials and manage diligence requests',
        label: 'Deliver follow-up materials and manage diligence requests',
        deliverable: 'Follow-up packet and diligence response tracker',
        definitionOfDone: 'All active diligence requests answered within target SLA.',
        estimateMin: 120,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['raise:006:first-meeting-wave'],
      },
      {
        id: 'raise:008:term-discussions',
        title: 'Coordinate term discussions and commitment tracking',
        label: 'Coordinate term discussions and commitment tracking',
        deliverable: 'Commitment tracker with soft commits and negotiation status',
        definitionOfDone: 'Commitment tracker reflects active terms and next legal steps.',
        estimateMin: 75,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['raise:007:followup-materials'],
      },
      {
        id: 'raise:009:close-process',
        title: 'Finalize legal close process and signature workflow',
        label: 'Finalize legal close process and signature workflow',
        deliverable: 'Closing checklist with signed documents and funding milestones',
        definitionOfDone: 'Signed documents collected and close checklist completed.',
        estimateMin: 60,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['raise:008:term-discussions'],
      },
      {
        id: 'raise:010:post-close-comms',
        title: 'Publish post-close update and execution plan',
        label: 'Publish post-close update and execution plan',
        deliverable: 'Post-close investor update and next 90-day execution roadmap',
        definitionOfDone: 'Investor update sent and roadmap aligned to use-of-funds plan.',
        estimateMin: 60,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['raise:009:close-process'],
      },
    ],
    templates: [
      {
        title: 'Daily investor pipeline review',
        domain: 'Resources',
        durationMinutes: 30,
        frequency: 'daily',
        reason: 'Maintains continuity across outreach, meetings, and follow-ups.',
      },
      {
        title: 'Weekly diligence readiness block',
        domain: 'Focus',
        durationMinutes: 60,
        frequency: 'weekly',
        reason: 'Keeps data room and responses prepared for momentum.',
      },
    ],
    diagnostics: {
      actionCount: 10,
      totalEstimateMin: 840,
      requiredWeeklyMinutes: 120,
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 180,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for Fundraising.'],
    },
  },

  GenericStructured: {
    version: 'jericho_action_graph_v1',
    executionType: 'GenericStructured',
    actions: [
      {
        id: 'phase1:001:define-scope',
        title: 'Define scope and success criteria for goal',
        label: 'Define scope and success criteria for goal',
        deliverable: 'Written scope document with 3 measurable success criteria',
        definitionOfDone: 'Scope approved, success criteria are specific and measurable.',
        estimateMin: 45,
        category: 'CREATIVE_PRODUCTION',
        dependencies: [],
      },
      {
        id: 'phase1:002:break-down',
        title: 'Break goal into major work areas',
        label: 'Break goal into major work areas',
        deliverable: 'List of 3–5 distinct work areas with estimated effort',
        definitionOfDone: 'Work areas cover full scope, no major gaps identified.',
        estimateMin: 30,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['phase1:001:define-scope'],
      },
      {
        id: 'phase2:001:area-one',
        title: 'Complete work area 1',
        label: 'Complete work area 1',
        deliverable: 'Work area 1 finished with output documented',
        definitionOfDone: 'Area 1 complete, output meets success criteria for that section.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['phase1:002:break-down'],
      },
      {
        id: 'phase2:002:area-two',
        title: 'Complete work area 2',
        label: 'Complete work area 2',
        deliverable: 'Work area 2 finished with output documented',
        definitionOfDone: 'Area 2 complete, output meets success criteria for that section.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['phase1:002:break-down'],
      },
      {
        id: 'phase2:003:area-three',
        title: 'Complete work area 3',
        label: 'Complete work area 3',
        deliverable: 'Work area 3 finished with output documented',
        definitionOfDone: 'Area 3 complete, output meets success criteria for that section.',
        estimateMin: 90,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['phase2:001:area-one'],
      },
      {
        id: 'phase3:001:integrate',
        title: 'Integrate all work areas into final output',
        label: 'Integrate all work areas into final output',
        deliverable: 'Unified final output combining all work areas',
        definitionOfDone: 'All areas integrated, final output reviewed for consistency.',
        estimateMin: 60,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['phase2:002:area-two', 'phase2:003:area-three'],
      },
      {
        id: 'phase3:002:review',
        title: 'Final review against success criteria',
        label: 'Final review against success criteria',
        deliverable: 'Review checklist completed with all criteria assessed',
        definitionOfDone: 'All success criteria met or documented as accepted gaps.',
        estimateMin: 30,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['phase3:001:integrate'],
      },
      {
        id: 'phase3:003:complete',
        title: 'Mark goal complete and document learnings',
        label: 'Mark goal complete and document learnings',
        deliverable: 'Completion note with 3 key learnings for future goals',
        definitionOfDone: 'Completion documented, learnings written, goal closed.',
        estimateMin: 20,
        category: 'CREATIVE_PRODUCTION',
        dependencies: ['phase3:002:review'],
      },
    ],
    templates: [
      {
        title: 'Weekly progress check',
        domain: 'Focus',
        durationMinutes: 20,
        frequency: 'weekly',
        reason: 'Keep goal visible and adjust plan as needed',
      },
    ],
    diagnostics: {
      actionCount: 8,
      totalEstimateMin: 455,
      requiredWeeklyMinutes: 114,
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 186,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for GenericStructured.'],
    },
  },
};

const TV_GENERIC_STRUCTURED_GRAPH = {
  version: 'jericho_action_graph_v1',
  executionType: 'GenericStructured',
  actions: [
    {
      id: 'tv:001:premise-outline',
      title: 'Write season premise and story outline',
      label: 'Write season premise and story outline',
      deliverable: 'Season premise with tone, genre, and central conflict',
      definitionOfDone: 'Premise and high-level story outline documented in one page.',
      estimateMin: 60,
      category: 'CREATIVE_PRODUCTION',
      dependencies: [],
    },
    {
      id: 'tv:002:character-cast',
      title: 'Define core characters and cast dynamics',
      label: 'Define core characters and cast dynamics',
      deliverable: 'Character bios and relationship map for principal cast',
      definitionOfDone: 'Each core character has motivation, arc, and conflict role defined.',
      estimateMin: 75,
      category: 'CREATIVE_PRODUCTION',
      dependencies: ['tv:001:premise-outline'],
    },
    {
      id: 'tv:003:season-arc',
      title: 'Build season arc from pilot to finale',
      label: 'Build season arc from pilot to finale',
      deliverable: 'Season beat map with escalation and turning points',
      definitionOfDone: 'Season arc includes beginning, midpoint, climax, and finale beats.',
      estimateMin: 90,
      category: 'CREATIVE_PRODUCTION',
      dependencies: ['tv:002:character-cast'],
    },
    {
      id: 'tv:004:outline-episode-1',
      title: 'Outline episode 1 (pilot)',
      label: 'Outline episode 1 (pilot)',
      deliverable: 'Episode 1 scene-by-scene outline',
      definitionOfDone: 'Pilot outline includes teaser, act turns, and resolution hook.',
      estimateMin: 90,
      category: 'CREATIVE_PRODUCTION',
      dependencies: ['tv:003:season-arc'],
    },
    {
      id: 'tv:005:draft-episode-1',
      title: 'Draft episode 1 script',
      label: 'Draft episode 1 script',
      deliverable: 'Complete pilot draft script',
      definitionOfDone: 'Pilot draft reaches complete first-pass script form.',
      estimateMin: 120,
      category: 'CREATIVE_PRODUCTION',
      dependencies: ['tv:004:outline-episode-1'],
    },
    {
      id: 'tv:006:outline-episode-2',
      title: 'Outline episode 2',
      label: 'Outline episode 2',
      deliverable: 'Episode 2 scene-by-scene outline',
      definitionOfDone: 'Episode 2 outline continues established season arc and character motion.',
      estimateMin: 90,
      category: 'CREATIVE_PRODUCTION',
      dependencies: ['tv:005:draft-episode-1'],
    },
    {
      id: 'tv:007:draft-episode-2',
      title: 'Draft episode 2 script',
      label: 'Draft episode 2 script',
      deliverable: 'Complete episode 2 first draft',
      definitionOfDone: 'Episode 2 draft is complete and story-coherent with season arc.',
      estimateMin: 120,
      category: 'CREATIVE_PRODUCTION',
      dependencies: ['tv:006:outline-episode-2'],
    },
    {
      id: 'tv:008:continuity-pass',
      title: 'Run continuity pass across drafted episodes',
      label: 'Run continuity pass across drafted episodes',
      deliverable: 'Continuity log resolving character, timeline, and plot inconsistencies',
      definitionOfDone: 'Continuity issues identified and corrected across episodes.',
      estimateMin: 60,
      category: 'CREATIVE_PRODUCTION',
      dependencies: ['tv:007:draft-episode-2'],
    },
    {
      id: 'tv:009:final-revision',
      title: 'Finalize revision package for current season drafts',
      label: 'Finalize revision package for current season drafts',
      deliverable: 'Revised draft package with prioritized next-writing queue',
      definitionOfDone: 'Revision package complete with clear next-episode writing plan.',
      estimateMin: 60,
      category: 'CREATIVE_PRODUCTION',
      dependencies: ['tv:008:continuity-pass'],
    },
  ],
  templates: [
    {
      title: 'Daily writers room review',
      domain: 'Creation',
      durationMinutes: 20,
      frequency: 'daily',
      reason: 'Maintain narrative coherence and momentum',
    },
    {
      title: 'Weekly story arc check',
      domain: 'Focus',
      durationMinutes: 30,
      frequency: 'weekly',
      reason: 'Validate episode work against season arc',
    },
  ],
  diagnostics: {
    actionCount: 9,
    totalEstimateMin: 765,
    requiredWeeklyMinutes: 192,
    weeklyCapMinutes: 300,
    weeklyGapMinutes: 108,
    reasonCodes: ['ON_TRACK'],
    notes: ['Mock graph for TV-writing GenericStructured goals.'],
  },
};

function isTvWritingGoal(goalDraftV2: unknown, contract: unknown) {
  const draft = (goalDraftV2 || {}) as Record<string, unknown>;
  const goalContract = (contract || {}) as Record<string, unknown>;
  const goalText = String(draft?.goalText || draft?.goalLabel || goalContract?.goalText || '').toLowerCase();
  const outcomeText = String((goalContract?.terminalOutcome as Record<string, unknown>)?.text || '').toLowerCase();
  const text = `${goalText} ${outcomeText}`;
  const keywords = ['tv show', 'television', 'season', 'episode', 'pilot', 'script'];
  return keywords.filter((kw) => text.includes(kw)).length >= 2;
}

function isEpisodicPodcastGoal(goalDraftV2: unknown, contract: unknown) {
  const draft = (goalDraftV2 || {}) as Record<string, unknown>;
  const goalContract = (contract || {}) as Record<string, unknown>;
  const terminalOutcome = (goalContract?.terminalOutcome || {}) as Record<string, unknown>;
  const text = `${draft?.goalText || ''} ${draft?.goalLabel || ''} ${goalContract?.goalText || ''} ${
    terminalOutcome?.text || ''
  } ${terminalOutcome?.verificationCriteria || ''}`.toLowerCase();
  const podcastHit = text.includes('podcast');
  const episodicHit = text.includes('episode') || /\b\d+\s+episodes?\b/.test(text);
  return podcastHit && episodicHit;
}

function buildVentureLaunchGraph(goalDraftV2: unknown, contract: unknown, executionType: string) {
  const goalContract = ((contract || {}) as Record<string, unknown>) || {};
  const terminalOutcome = (goalContract?.terminalOutcome || {}) as Record<string, unknown>;
  const startDayKey =
    coerceDayKey(goalContract?.startDayKey) ||
    coerceDayKey(goalContract?.startDateISO) ||
    coerceDayKey(goalContract?.startDate) ||
    '2026-03-21';

  const autoResult = buildAutoDeliverablesFromGoalContract(
    {
      ...(goalContract as object),
      executionType,
      goalText: String(goalContract?.goalText || draftText(goalDraftV2)),
      terminalOutcome: {
        text: String(terminalOutcome?.text || draftText(goalDraftV2)),
        verificationCriteria: String(terminalOutcome?.verificationCriteria || ''),
        isConcrete: terminalOutcome?.isConcrete !== false,
        hash: String(terminalOutcome?.hash || ''),
      },
      deadline: {
        ...(goalContract?.deadline as Record<string, unknown>),
        dayKey: String((goalContract?.deadline as Record<string, unknown>)?.dayKey || ''),
        isHardDeadline: true,
      },
    } as any,
    startDayKey,
    'UTC'
  );

  const deliverables = autoResult.deliverables;

  const deriveVentureActionTitles = (deliverableTitle: string) => {
    const title = String(deliverableTitle || '').trim();
    const lower = title.toLowerCase();
    const objectTitle = title.replace(/^(define|audit|set|build|prepare|run|compile)\s+/i, '');

    let preparationTitle = /^define|^audit/.test(lower)
      ? `Capture customer problem, proof target, and scope for ${objectTitle}`
      : /^run /.test(lower)
        ? `Prepare ${objectTitle}`
        : `Scope ${objectTitle}`;
    let completionTitle = /^(define|audit|set|build|prepare|run|compile)\s+/i.test(lower)
      ? title
      : `Complete ${objectTitle}`;

    if (lower.includes('offer and ideal client profile')) {
      preparationTitle = `Capture problem, value proposition, and buyer profile for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('pricing tiers and qualification gates')) {
      preparationTitle = `Map scope boundaries, pricing logic, and qualification rules for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('onboarding workflow and delivery checklist')) {
      preparationTitle = `Map onboarding steps, delivery milestones, and handoff points for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('outreach scripts and first prospect list')) {
      preparationTitle = `Prepare prospect targets, outreach copy, and reply handling for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('discovery calls and close first client')) {
      preparationTitle = `Prepare discovery agenda, objection handling, and close criteria for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('value proposition and target customer')) {
      preparationTitle = `Capture target customer, core pain point, and promise for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('landing page, waitlist flow, and first-user funnel')) {
      preparationTitle = `Draft landing page messaging, waitlist flow, and first-user CTA for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('customer outreach list and interview script')) {
      preparationTitle = `Prepare customer targets, outreach scripts, and interview prompts for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('first-user validation and feedback loop')) {
      preparationTitle = `Prepare first-user test plan, outreach cadence, and feedback capture for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('traction evidence and launch next-step review')) {
      preparationTitle = `Prepare traction evidence summary and next-step decision criteria for ${objectTitle}`;
      completionTitle = title;
    }

    return { title, lower, preparationTitle, completionTitle };
  };

  const actions = deliverables.flatMap((deliverable, index) => {
    const { title, lower, preparationTitle, completionTitle } = deriveVentureActionTitles(
      String(deliverable.title || '')
    );
    const totalMinutes = Math.max(
      90,
      Number(deliverable.requiredBlocks || 1) * 60 +
        (lower.includes('validation') || lower.includes('review') || lower.includes('close') ? 30 : 0)
    );
    const prepId = `venture:${String(index * 2 + 1).padStart(3, '0')}:${compactSlugifyTitle(preparationTitle)}`;
    const completionId = `venture:${String(index * 2 + 2).padStart(3, '0')}:${compactSlugifyTitle(completionTitle)}`;
    const previousCompletionId = (() => {
      if (index <= 0) return null;
      const previousTitles = deriveVentureActionTitles(String(deliverables[index - 1]?.title || ''));
      return `venture:${String(index * 2).padStart(3, '0')}:${compactSlugifyTitle(previousTitles.completionTitle)}`;
    })();

    return [
      {
        id: prepId,
        title: preparationTitle,
        label: preparationTitle,
        deliverable: title,
        actionType: 'preparation',
        definitionOfDone: `${preparationTitle} is complete and ready for venture execution.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.35)),
        category: 'VENTURE_LAUNCH',
        dependencies: previousCompletionId ? [previousCompletionId] : [],
      },
      {
        id: completionId,
        title: completionTitle,
        label: completionTitle,
        deliverable: title,
        actionType: classifyCompletionActionType(completionTitle),
        definitionOfDone: `${title} is completed with visible venture evidence tied to the admitted goal.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.65)),
        category: 'VENTURE_LAUNCH',
        dependencies: [prepId],
      },
    ];
  });

  return {
    version: 'jericho_action_graph_v1',
    executionType,
    actions,
    templates: [
      {
        title: 'Venture launch execution block',
        domain: 'Focus',
        durationMinutes: 45,
        frequency: 'daily',
        reason: 'Keeps offer, funnel, outreach, and validation work tied to concrete venture evidence.',
      },
      {
        title: 'Weekly venture proof review',
        domain: 'Focus',
        durationMinutes: 30,
        frequency: 'weekly',
        reason: 'Checks traction, customer evidence, and next-step decisions against the admitted venture target.',
      },
    ],
    diagnostics: {
      actionCount: actions.length,
      totalEstimateMin: actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0),
      requiredWeeklyMinutes: Math.max(
        60,
        Math.round(actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0) / 6)
      ),
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 0,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for VentureLaunch goals derived from admitted contract deliverables.'],
    },
  };
}

function buildBrandLaunchGraph(goalDraftV2: unknown, contract: unknown, executionType: string) {
  const goalContract = ((contract || {}) as Record<string, unknown>) || {};
  const terminalOutcome = (goalContract?.terminalOutcome || {}) as Record<string, unknown>;
  const temporalBinding = (goalContract?.temporalBinding || {}) as Record<string, unknown>;
  const startDayKey =
    coerceDayKey(goalContract?.startDayKey) ||
    coerceDayKey(goalContract?.startDateISO) ||
    coerceDayKey(goalContract?.startDate) ||
    coerceDayKey(temporalBinding?.startDayKey) ||
    coerceDayKey((goalContract?.goalExecutionContract as Record<string, unknown>)?.startDayKey) ||
    coerceDayKey(
      ((goalContract?.goalExecutionContract as Record<string, unknown>)?.temporalBinding as Record<string, unknown>)
        ?.startDayKey
    ) ||
    '2026-03-21';

  const deliverables = generateAutoDeliverables({
    ...(goalContract as object),
    executionType,
    startDayKey,
    goalText: String(goalContract?.goalText || draftText(goalDraftV2)),
    terminalOutcome: {
      text: String(terminalOutcome?.text || draftText(goalDraftV2)),
      verificationCriteria: String(terminalOutcome?.verificationCriteria || ''),
    },
  } as any);
  const planningIntake = (goalContract?.planningIntake || goalContract?.goalIntakeContract?.planningIntake || {}) as Record<
    string,
    unknown
  >;
  const regulatedConsumableDetected = isRegulatedPhysicalConsumableGoal(
    [
      planningIntake?.goalClassification,
      goalContract?.goalText,
      draftText(goalDraftV2),
      terminalOutcome?.text,
      terminalOutcome?.verificationCriteria,
      ...deliverables.map((deliverable) => deliverable?.title),
    ]
      .map((value) => String(value || ''))
      .join(' ')
  );
  const commercialProductLaunchDetected =
    regulatedConsumableDetected ||
    deliverables.some((deliverable) =>
      /\b(formula|sample approval|packaging|sourcing|checkout|fulfillment path|first-sales|first sales evidence)\b/i.test(
        String(deliverable?.title || '')
      )
    );

  if (commercialProductLaunchDetected) {
    const actions = buildCommercialProductLaunchActions(deliverables, {
      regulatedConsumable: regulatedConsumableDetected,
      planningIntake: planningIntake as StructuredPlanningIntake,
    });
    return {
      version: 'jericho_action_graph_v1',
      executionType,
      actions,
      templates: [
        {
          title: 'Commercial launch execution block',
          domain: 'Focus',
          durationMinutes: 60,
          frequency: 'multiple weekly',
          reason:
            'Keeps product readiness, commerce setup, launch assets, and first-sales execution moving in parallel.',
        },
        {
          title: 'Commercial evidence review',
          domain: 'Focus',
          durationMinutes: 45,
          frequency: 'weekly',
          reason:
            'Checks sourcing, checkout, outreach, and first-sales evidence against the admitted completion target.',
        },
      ],
      diagnostics: {
        actionCount: actions.length,
        totalEstimateMin: actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0),
        requiredWeeklyMinutes: Math.max(
          60,
          Math.round(actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0) / 26)
        ),
        weeklyCapMinutes: 300,
        weeklyGapMinutes: 0,
        reasonCodes: ['ON_TRACK'],
        notes: [
          'Mock graph for BrandLaunch goals derived from admitted contract deliverables.',
          'Commercial product launch semantic branch selected.',
          'Commercial product launch concrete subtask expansion selected.',
          regulatedConsumableDetected
            ? 'Regulated physical consumable requirement layer selected.'
            : 'Commercial product launch baseline requirement layer selected.',
        ],
      },
    };
  }

  const deriveBrandActionTitles = (deliverableTitle: string) => {
    const title = String(deliverableTitle || '').trim();
    const lower = title.toLowerCase();
    const objectTitle = title.replace(/^(define|refine|build|select|assemble|update|publish)\s+/i, '');

    let preparationTitle = /^define|^refine/.test(lower)
      ? `Capture audience insight, differentiation, and proof target for ${objectTitle}`
      : /^publish /.test(lower)
        ? `Prepare ${objectTitle}`
        : `Scope ${objectTitle}`;
    let completionTitle = /^(define|refine|build|select|assemble|update|publish)\s+/i.test(lower)
      ? title
      : `Complete ${objectTitle}`;

    if (lower.includes('brand positioning and audience promise')) {
      preparationTitle = `Capture audience insight, positioning inputs, and differentiation cues for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('messaging architecture for priority channels')) {
      preparationTitle = `Map message pillars, CTA variants, and channel priorities for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('visual identity direction and standards')) {
      preparationTitle = `Collect references, palette options, and typography cues for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('core brand kit and starter assets')) {
      preparationTitle = `Prepare asset list, template needs, and production checklist for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('priority channel profiles and bios')) {
      preparationTitle = `Audit website, profile, and bio touchpoints for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('brand launch announcement and audience cta')) {
      preparationTitle = `Prepare rollout order, announcement copy, and CTA links for ${objectTitle}`;
      completionTitle = title;
    }

    return { title, lower, preparationTitle, completionTitle };
  };

  const actions = deliverables.flatMap((deliverable, index) => {
    const { title, lower, preparationTitle, completionTitle } = deriveBrandActionTitles(
      String(deliverable.title || '')
    );
    const totalMinutes = Math.max(
      90,
      Number(deliverable.requiredBlocks || 1) * 60 + (lower.includes('launch') || lower.includes('assets') ? 30 : 0)
    );
    const prepId = `brand:${String(index * 2 + 1).padStart(3, '0')}:${compactSlugifyTitle(preparationTitle)}`;
    const completionId = `brand:${String(index * 2 + 2).padStart(3, '0')}:${compactSlugifyTitle(completionTitle)}`;
    const previousCompletionId = (() => {
      if (index <= 0) return null;
      const previousTitles = deriveBrandActionTitles(String(deliverables[index - 1]?.title || ''));
      return `brand:${String(index * 2).padStart(3, '0')}:${compactSlugifyTitle(previousTitles.completionTitle)}`;
    })();

    return [
      {
        id: prepId,
        title: preparationTitle,
        label: preparationTitle,
        deliverable: title,
        actionType: 'preparation',
        definitionOfDone: `${preparationTitle} is complete and ready for brand execution.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.35)),
        category: 'CREATIVE_PRODUCTION',
        dependencies: previousCompletionId ? [previousCompletionId] : [],
      },
      {
        id: completionId,
        title: completionTitle,
        label: completionTitle,
        deliverable: title,
        actionType: classifyCompletionActionType(completionTitle),
        definitionOfDone: `${title} is completed with visible brand-launch output tied to the admitted goal.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.65)),
        category: 'CREATIVE_PRODUCTION',
        dependencies: [prepId],
      },
    ];
  });

  return {
    version: 'jericho_action_graph_v1',
    executionType,
    actions,
    templates: [
      {
        title: 'Brand execution block',
        domain: 'Focus',
        durationMinutes: 45,
        frequency: 'daily',
        reason: 'Keeps positioning, messaging, identity, and rollout work tied to concrete brand outputs.',
      },
      {
        title: 'Weekly brand proof review',
        domain: 'Focus',
        durationMinutes: 30,
        frequency: 'weekly',
        reason: 'Checks brand assets and rollout evidence against the admitted launch target.',
      },
    ],
    diagnostics: {
      actionCount: actions.length,
      totalEstimateMin: actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0),
      requiredWeeklyMinutes: Math.max(
        60,
        Math.round(actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0) / 6)
      ),
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 0,
      reasonCodes: ['ON_TRACK'],
      notes: [
        'Mock graph for BrandLaunch goals derived from admitted contract deliverables.',
        commercialProductLaunchDetected
          ? 'Commercial product launch semantic branch selected.'
          : 'Brand launch semantic branch selected.',
      ],
    },
  };
}

function isRegulatedPhysicalConsumableGoal(text: string) {
  return /\b(caffeinated gum|gum|edible|ingestible|food|beverage|supplement|caffeine|dosage|ingredient|label|labels|labeling|claim|claims|warning|warnings)\b/i.test(
    String(text || '')
  );
}

function regulatedPathwayFromIntake(planningIntake: Partial<StructuredPlanningIntake> | null | undefined) {
  const pathway = String(planningIntake?.formulaPathway || '').trim().toLowerCase();
  if (pathway === 'custom_development' || pathway === 'base_modification' || pathway === 'white_label') {
    return pathway as 'custom_development' | 'base_modification' | 'white_label';
  }
  if (Number(planningIntake?.capitalAvailable || 0) === 0 || planningIntake?.capitalAcquisitionRequired === true) {
    return 'white_label';
  }
  return 'base_modification';
}

function minimumSampleCycleCountForPathway(pathway: 'custom_development' | 'base_modification' | 'white_label') {
  if (pathway === 'custom_development') return 3;
  if (pathway === 'white_label') return 1;
  return 2;
}

function buildCommercialProductLaunchActions(
  deliverables: Array<{ id?: string; title?: string; requiredBlocks?: number }>,
  options: { regulatedConsumable?: boolean; planningIntake?: Partial<StructuredPlanningIntake> } = {}
) {
  const familyDeliverables = new Map<string, { id?: string; title?: string; requiredBlocks?: number }>();
  deliverables.forEach((deliverable, index) => {
    familyDeliverables.set(commercialFamilyKey(String(deliverable?.title || ''), index), deliverable);
  });

  const getDeliverable = (familyKey: string, fallbackIndex: number) =>
    familyDeliverables.get(familyKey) ||
    deliverables[fallbackIndex] || {
      title: 'Commercial product launch work',
      requiredBlocks: 1,
    };
  const productDeliverable = getDeliverable('product', 0);
  const commerceDeliverable = getDeliverable('commerce', 1);
  const communicationsDeliverable = getDeliverable('communications', 2);
  const salesDeliverable = getDeliverable('sales', 3);
  const reviewDeliverable = getDeliverable('review', 4);
  const cycleCount = deriveCommercialLaunchCycleCount(deliverables);
  const selectedPathway = regulatedPathwayFromIntake(options.planningIntake);
  const minimumSampleCycles = minimumSampleCycleCountForPathway(selectedPathway);
  const normalizeDependencyType = (value: unknown) => {
    const normalized = String(value || '')
      .trim()
      .toLowerCase();
    if (normalized === 'hard_gate' || normalized === 'hard-gate' || normalized === 'hard') {
      return 'hard_gate';
    }
    if (normalized === 'directional' || normalized === 'soft') {
      return 'directional';
    }
    if (normalized === 'informational' || normalized === 'info') {
      return 'informational';
    }
    return null;
  };
  const classifyBrandLaunchDependencyType = (actionId: string, actionType: string, dependencyId: string) => {
    if (!actionId || !dependencyId) {
      return 'hard_gate';
    }
    if (dependencyId.startsWith('brand:00:')) {
      if (actionId.startsWith('brand:01:')) {
        return 'hard_gate';
      }
      if (actionId.startsWith('brand:02:') || actionId.startsWith('brand:03:')) {
        if (
          dependencyId.startsWith('brand:00:05:') ||
          dependencyId.startsWith('brand:00:04:') ||
          dependencyId.startsWith('brand:00:01:')
        ) {
          return 'directional';
        }
        return 'informational';
      }
      if (actionId.startsWith('brand:04:') || actionId.startsWith('brand:05:')) {
        if (dependencyId.startsWith('brand:00:05:') || dependencyId.startsWith('brand:00:04:')) {
          return 'directional';
        }
        return 'informational';
      }
    }
    if ((actionId.startsWith('brand:02:') || actionId.startsWith('brand:03:')) && dependencyId.startsWith('brand:01:')) {
      return 'directional';
    }
    if (actionId.startsWith('brand:03:') && dependencyId.startsWith('brand:02:')) {
      return 'directional';
    }
    if (actionType === 'execution' && (dependencyId.startsWith('brand:02:') || dependencyId.startsWith('brand:03:'))) {
      return 'directional';
    }
    return 'hard_gate';
  };
  const buildDependencyDetails = ({
    actionId,
    actionType,
    dependencies = [],
    dependencyDetails = [],
  }: {
    actionId: string;
    actionType: 'preparation' | 'execution';
    dependencies?: string[];
    dependencyDetails?: Array<{ actionId?: string; dependencyId?: string; dependencyType?: string }>;
  }) => {
    const byId = new Map<string, { actionId: string; dependencyType: string }>();
    (dependencyDetails || []).forEach((detail) => {
      const dependencyId = String(detail?.actionId || detail?.dependencyId || '').trim();
      if (!dependencyId) {
        return;
      }
      byId.set(dependencyId, {
        actionId: dependencyId,
        dependencyType:
          normalizeDependencyType(detail?.dependencyType) ||
          classifyBrandLaunchDependencyType(actionId, actionType, dependencyId),
      });
    });
    (dependencies || []).forEach((dependencyId) => {
      const normalizedDependencyId = String(dependencyId || '').trim();
      if (!normalizedDependencyId || byId.has(normalizedDependencyId)) {
        return;
      }
      byId.set(normalizedDependencyId, {
        actionId: normalizedDependencyId,
        dependencyType: classifyBrandLaunchDependencyType(actionId, actionType, normalizedDependencyId),
      });
    });
    return (dependencies || [])
      .map((dependencyId) => byId.get(String(dependencyId || '').trim()))
      .filter(Boolean);
  };

  const makeAction = ({
    id,
    title,
    deliverable,
    actionType,
    dependencies = [],
    dependencyDetails = [],
    sessionTitles,
    phaseHint,
    commercialCycleIndex,
    requiredWorkFamily,
    minimumDurationBusinessDays,
    blockType,
    waitType,
    parallelWorkSuggestions,
    capitalGateId,
    capitalRequirement,
    pathwayTag,
    description,
    costEstimate,
    acceptanceNote,
    phaseLabel,
    planQualityTags,
    capitalTarget,
  }: {
    id: string;
    title: string;
    deliverable: { id?: string; title?: string };
    actionType: 'preparation' | 'execution';
    dependencies?: string[];
    dependencyDetails?: Array<{ actionId?: string; dependencyId?: string; dependencyType?: string }>;
    sessionTitles: string[];
    phaseHint: 'early' | 'mid' | 'late';
    commercialCycleIndex?: number;
    requiredWorkFamily?: string;
    minimumDurationBusinessDays?: number;
    blockType?: 'execution' | 'waiting_period' | 'capital_checkpoint';
    waitType?: string;
    parallelWorkSuggestions?: string[];
    capitalGateId?: string;
    capitalRequirement?: { min: number; typical: number; max: number };
    pathwayTag?: 'custom_development' | 'base_modification' | 'white_label' | 'agnostic';
    description?: string;
    costEstimate?: string;
    acceptanceNote?: string;
    phaseLabel?: string;
    planQualityTags?: string[];
    capitalTarget?: { amount: number; unitPrice?: number; unitsRequired?: number };
  }) => ({
    id,
    title,
    label: title,
    deliverable: String(deliverable?.title || title),
    deliverableId: String(deliverable?.id || id),
    actionType,
    definitionOfDone: `${title} produces concrete evidence for ${String(deliverable?.title || 'the launch')}.`,
    estimateMin: sessionTitles.length * 60,
    category: 'CREATIVE_PRODUCTION',
    dependencies,
    dependencyDetails: buildDependencyDetails({ actionId: id, actionType, dependencies, dependencyDetails }),
    sessionTitles,
    phaseHint,
    commercialCycleIndex,
    commercialCycleCount: cycleCount,
    ...(requiredWorkFamily ? { requiredWorkFamily } : {}),
    ...(Number.isFinite(minimumDurationBusinessDays) ? { minimumDurationBusinessDays } : {}),
    ...(blockType ? { blockType } : {}),
    ...(waitType ? { waitType } : {}),
    ...(Array.isArray(parallelWorkSuggestions) && parallelWorkSuggestions.length > 0 ? { parallelWorkSuggestions } : {}),
    ...(capitalGateId ? { capitalGateId } : {}),
    ...(capitalRequirement ? { capitalRequirement } : {}),
    ...(pathwayTag ? { pathwayTag } : {}),
    ...(description ? { description } : {}),
    ...(costEstimate ? { costEstimate } : {}),
    ...(acceptanceNote ? { acceptanceNote } : {}),
    ...(phaseLabel ? { phaseLabel } : {}),
    ...(Array.isArray(planQualityTags) && planQualityTags.length > 0 ? { planQualityTags } : {}),
    ...(capitalTarget ? { capitalTarget } : {}),
  });

  const shouldUseIllinoisEnergyGumFounderPath = () => {
    const intake = options.planningIntake || {};
    const goalDescription = String(intake?.goalDescription || '').toLowerCase();
    const state = String(intake?.legalFoundation?.existingEntityState || intake?.location?.state || '').toUpperCase();
    const spotifyListeners = Number(intake?.capitalAcquisitionAssets?.existingAudience?.spotifyListeners || 0);
    return (
      options.regulatedConsumable === true &&
      selectedPathway === 'white_label' &&
      Number(intake?.capitalAvailable || 0) === 0 &&
      intake?.capitalAcquisitionRequired === true &&
      intake?.legalFoundation?.existingEntity === true &&
      intake?.legalFoundation?.gumEntityExists === false &&
      state === 'IL' &&
      spotifyListeners >= 1000 &&
      /\b(gum|energy gum|caffeinated functional energy gum)\b/.test(goalDescription)
    );
  };

  const buildIllinoisEnergyGumFounderActions = () => {
    const actionsForPath: any[] = [];
    const administrativeDeliverable = productDeliverable;
    const capitalDeliverable = commerceDeliverable;
    const launchDeliverable = salesDeliverable;
    const reviewDeliverableForPath = reviewDeliverable;

    const investigateSeriesId = 'brand:00:01:investigate-illinois-series-llc-option';
    const fileEntityId = 'brand:00:02:file-gum-brand-entity';
    const obtainEinId = 'brand:00:03:obtain-ein-for-gum-brand-entity';
    const openBankId = 'brand:00:04:open-dedicated-business-bank-account';
    const insuranceResearchId = 'brand:00:05:research-product-liability-insurance-for-functional-food-in-illinois';
    const manufacturerResearchId = 'brand:00:06:research-stock-caffeinated-functional-gum-manufacturers';
    const grasConfirmId = 'brand:00:07:confirm-gras-status-for-caffeine-source';
    const manufacturerCatalogId = 'brand:00:08:request-stock-formula-catalogs-and-moq-requirements';
    const sampleCapitalId = 'brand:00:09:capital-checkpoint-sample-cycle-costs';
    const sampleOrderId = 'brand:00:10:order-bench-samples-from-manufacturers';
    const foundersJourneyId = 'brand:00:11:define-founders-journey-content-series';
    const presaleOfferId = 'brand:00:12:build-the-presale-offer';
    const imageryDirectionId = 'brand:00:13:define-visual-direction-and-reference-examples-for-product-imagery';
    const imageryCommissionId = 'brand:00:14:commission-product-photography-or-3d-rendering';
    const imageryApproveId = 'brand:00:15:review-and-approve-final-hero-imagery';
    const regulatoryCapitalId = 'brand:00:16:capital-checkpoint-regulatory-consultant-engagement';
    const labelReviewId = 'brand:00:17:third-party-food-label-review';
    const labelReviseId = 'brand:00:18:revise-claims-and-label-copy-against-review';
    const claimsLockId = 'brand:00:19:lock-compliance-safe-claims-with-consultant-sign-off';
    const packagingResearchId = 'brand:00:20:research-packaging-suppliers-and-format-options';
    const packagingQuoteAId = 'brand:00:21:request-packaging-quote-and-dieline-requirements-from-supplier-a';
    const packagingQuoteBId = 'brand:00:22:request-packaging-quote-and-dieline-requirements-from-supplier-b';
    const packagingCompareId = 'brand:00:23:compare-packaging-costs-lead-times-minimums-and-print-constraints';
    const packagingCapitalId = 'brand:00:24:capital-checkpoint-packaging-production';
    const packagingProductionId = 'brand:00:25:packaging-production-lead-time';
    const presaleLaunchId = 'brand:00:26:presale-campaign-launch';
    const presaleTrackId = 'brand:00:27:track-presale-revenue-in-dedicated-account';
    const insurancePurchaseId = 'brand:00:28:purchase-product-liability-insurance';
    const moqCapitalId = 'brand:00:29:capital-checkpoint-moq-production-deposit';
    const depositId = 'brand:00:30:pay-50-percent-manufacturing-deposit';
    const productionWaitId = 'brand:00:31:dead-space-management-production-queue';
    const storeBuildId = 'brand:00:32:build-shopify-store-and-hidden-review-site';
    const merchantResearchId = 'brand:00:33:research-high-risk-merchant-processing-options';
    const merchantPrepId = 'brand:00:34:prepare-merchant-account-application-materials-and-product-documentation';
    const merchantSubmitId = 'brand:00:35:submit-merchant-account-application';
    const merchantRespondId = 'brand:00:36:respond-to-underwriter-requests-for-additional-information';
    const merchantApprovalId = 'brand:00:37:confirm-merchant-account-approval';
    const threePlId = 'brand:00:38:set-up-3pl-account-and-inbound-shipment-plan';
    const influencerId = 'brand:00:39:influencer-seeding';
    const fulfillFoundersId = 'brand:00:40:fulfill-founders-kit-pre-orders';
    const coldSaleId = 'brand:00:41:first-cold-sale-tracking';
    const outreachCyclesId = 'brand:00:42:structured-outreach-cycles';
    const checkoutPathId = 'brand:00:43:select-checkout-or-order-capture-path-for-first-real-sales';
    const checkoutFieldsId = 'brand:00:44:configure-checkout-fields';
    const merchantRiskReviewId = 'brand:00:45:review-stop-work-risk-if-underwriting-starts-late';

    actionsForPath.push(
      makeAction({
        id: investigateSeriesId,
        title: 'Investigate Illinois Series LLC option',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 1: Administrative shield',
        description:
          "You already have an Illinois LLC for your project management company. Illinois allows Series LLCs which let you add a cell for the gum brand without a full separate filing. Research whether this saves you the standalone filing cost and whether it provides sufficient liability separation for a food product.",
        costEstimate: '$0 research only',
        acceptanceNote: 'Surface Series LLC vs standalone LLC decision before any filing.',
        sessionTitles: ['Investigate Illinois Series LLC option and decide whether it protects the gum brand sufficiently'],
      }),
      makeAction({
        id: fileEntityId,
        title: 'File gum brand entity (Series cell or standalone LLC)',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [investigateSeriesId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 1: Administrative shield',
        description:
          'Whichever structure you choose, the gum brand must be legally separate from your project management company. Product liability for a consumable must not touch your existing business assets.',
        costEstimate: '$150-$500',
        acceptanceNote: 'Illinois processing time is typically 2-4 weeks. This is a hard gate on downstream business activity.',
        sessionTitles: ['File gum brand entity after choosing Series LLC cell or standalone Illinois LLC structure'],
      }),
      makeAction({
        id: obtainEinId,
        title: 'Obtain EIN for gum brand entity',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [fileEntityId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 1: Administrative shield',
        description: 'Free and immediate online through IRS.gov. Do this the day the entity is approved.',
        costEstimate: '$0',
        sessionTitles: ['Obtain EIN for gum brand entity the day the filing is approved'],
      }),
      makeAction({
        id: openBankId,
        title: 'Open dedicated business bank account for gum brand',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [obtainEinId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 1: Administrative shield',
        description:
          'Mercury or Novo are recommended for early-stage founders: no minimum balance, no monthly fees, digital-first. Every dollar in and out of the gum business runs through this account so you can track capital acquisition progress toward the $8,000 MOQ gate.',
        costEstimate: '$0',
        planQualityTags: ['mercury_or_novo_recommended'],
        sessionTitles: ['Open dedicated gum-brand bank account with Mercury or Novo and route all business cash through it'],
      }),
      makeAction({
        id: insuranceResearchId,
        title: 'Research product liability insurance for functional food in Illinois',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [investigateSeriesId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 1: Administrative shield',
        description:
          'Most reputable food manufacturers will not sign a contract with you until you can show proof of product liability insurance. For a stimulant-adjacent functional food this is non-negotiable. Get quotes before manufacturer outreach so you know the cost and can apply immediately when needed.',
        costEstimate: '$500-$2,000 annually',
        sessionTitles: ['Research Illinois product liability insurance requirements and quotes for stimulant-adjacent functional food'],
      }),
      makeAction({
        id: manufacturerResearchId,
        title: 'Research stock caffeinated functional gum manufacturers',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [openBankId],
        pathwayTag: 'white_label',
        phaseLabel: 'Phase 2: White-label manufacturer research',
        description:
          "You are looking for manufacturers who already have an existing caffeinated gum base formula, not contract manufacturers who will develop a custom formula. Search terms: white label caffeinated gum manufacturer, stock functional gum private label, OEM caffeinated chewing gum. Target 5-8 manufacturers for outreach. Being unemployed right now means you can do 40 hours of manufacturer research in 3 days. Use this velocity window.",
        sessionTitles: ['Research stock caffeinated functional gum manufacturers and shortlist 5-8 realistic white-label options'],
      }),
      makeAction({
        id: grasConfirmId,
        title: 'Confirm GRAS status for caffeine source',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [manufacturerResearchId],
        pathwayTag: 'white_label',
        phaseLabel: 'Phase 2: White-label manufacturer research',
        description:
          'Since you are positioning as a functional food rather than a dietary supplement, the caffeine source must be GRAS certified at your intended dose. Ask each manufacturer explicitly what the caffeine source is and whether they have GRAS documentation for it at the target dose levels in this formula.',
        planQualityTags: ['gras_confirmation_required'],
        sessionTitles: ['Ask each manufacturer for caffeine source and GRAS documentation at the intended functional-food dose'],
      }),
      makeAction({
        id: manufacturerCatalogId,
        title: 'Request stock formula catalogs and MOQ requirements',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [manufacturerResearchId, grasConfirmId],
        blockType: 'waiting_period',
        waitType: 'manufacturer_initial_response',
        minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.manufacturerInitialResponse.min,
        parallelWorkSuggestions: ['founder content series', 'packaging supplier outreach', 'insurance quotes'],
        pathwayTag: 'white_label',
        phaseLabel: 'Phase 2: White-label manufacturer research',
        description:
          'Contact each manufacturer and request available caffeinated gum base formulas, caffeine dose options, flavor options, MOQ for private label runs, sample cost, lead time from deposit to delivery, and whether they require proof of insurance before contracting.',
        sessionTitles: ['Request stock formula catalogs, MOQ requirements, sample cost, lead time, and insurance requirements from each shortlisted manufacturer'],
      }),
      makeAction({
        id: sampleCapitalId,
        title: 'Capital checkpoint 2 - Sample cycle costs',
        deliverable: capitalDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [manufacturerCatalogId],
        blockType: 'capital_checkpoint',
        requiredWorkFamily: 'CAPITAL_GATE_CHECKPOINTS',
        capitalGateId: 'sample_cycle_costs',
        capitalRequirement: { min: 50, typical: 150, max: 200 },
        pathwayTag: 'white_label',
        phaseLabel: 'Phase 2: White-label manufacturer research',
        description:
          'Sample production and shipping typically costs $50-$200 per manufacturer in this white-label branch. Fund this first real capital expenditure from project-management revenue before ordering.',
        sessionTitles: ['Confirm capital availability for the first white-label bench sample orders'],
      }),
      makeAction({
        id: sampleOrderId,
        title: 'Order bench samples from 2-3 manufacturers',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [sampleCapitalId],
        blockType: 'waiting_period',
        waitType: 'sample_cycle_per_iteration',
        minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.sampleCyclePerIteration.min,
        parallelWorkSuggestions: ['presale offer drafting', 'hero imagery direction', 'packaging format research'],
        pathwayTag: 'white_label',
        phaseLabel: 'Phase 2: White-label manufacturer research',
        description:
          'Select 2-3 formulas that match your flavor vision and order bench samples. Evaluate taste, texture, caffeine delivery feel, and whether the product matches your brand positioning. This is your first real capital expenditure and should be funded from project management revenue.',
        costEstimate: '$50-$200 per manufacturer',
        sessionTitles: ['Order bench samples from 2-3 manufacturers and wait for taste, texture, and delivery validation'],
      }),
      makeAction({
        id: foundersJourneyId,
        title: "Define the Founder's Journey content series",
        deliverable: capitalDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [openBankId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 3: Capital acquisition track',
        description:
          'You have a music audience who knows you as a creator. You are now building a physical product brand. Document what you are building, why, what the process actually looks like, the real obstacles, and the real progress. This is not optional marketing; it is your capital acquisition engine. Publish 2-3 posts per week minimum on Instagram and TikTok.',
        planQualityTags: ['presale_is_capital_acquisition'],
        sessionTitles: ["Define the Founder's Journey content series for Instagram and TikTok as the capital-acquisition engine"],
      }),
      makeAction({
        id: presaleOfferId,
        title: 'Build the presale offer',
        deliverable: capitalDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [foundersJourneyId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 3: Capital acquisition track',
        description:
          "Structure a Founder's Kit presale at $35-$45 for the first shipment pack, with a founding-customer list benefit. Presale target math is explicit: 200 units x $40 = $8,000. You are not taking money until sample validation is complete and a real ship date estimate exists. That is an ethical and legal requirement, not just a best practice.",
        capitalTarget: { amount: 8000, unitPrice: 40, unitsRequired: 200 },
        planQualityTags: ['presale_math_present'],
        sessionTitles: ["Build the Founder's Kit presale offer around 200 units at $40 to close the $8,000 MOQ gap"],
      }),
      makeAction({
        id: imageryDirectionId,
        title: 'Define visual direction and reference examples for product imagery',
        deliverable: communicationsDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [presaleOfferId],
        requiredWorkFamily: 'HERO_IMAGERY_PRODUCTION',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 3: Capital acquisition track',
        description:
          'Physical food products convert poorly without visual proof. Define the visual direction before commissioning renders or photography so the founder audience sees something concrete, not abstract claims.',
        sessionTitles: ['Define hero-imagery direction from the Founders Kit offer and early packaging references'],
      }),
      makeAction({
        id: imageryCommissionId,
        title: 'Commission product photography or 3D rendering',
        deliverable: communicationsDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [imageryDirectionId, sampleOrderId],
        requiredWorkFamily: 'HERO_IMAGERY_PRODUCTION',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 3: Capital acquisition track',
        description:
          'Commission visual proof once you have either a physical sample or an approved render reference. This is a hard gate on launch assets and on the product page going live.',
        sessionTitles: ['Commission hero imagery using sample references or approved 3D render specifications'],
      }),
      makeAction({
        id: imageryApproveId,
        title: 'Review and approve final hero imagery',
        deliverable: communicationsDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [imageryCommissionId],
        requiredWorkFamily: 'HERO_IMAGERY_PRODUCTION',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 3: Capital acquisition track',
        description:
          'Approve final hero imagery before the product page goes live or first outreach sends. Physical product conversion requires visual proof.',
        sessionTitles: ['Review and approve final hero imagery before launch assets and checkout go live'],
      }),
      makeAction({
        id: regulatoryCapitalId,
        title: 'Capital checkpoint 1 - Regulatory consultant engagement',
        deliverable: capitalDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [sampleOrderId],
        blockType: 'capital_checkpoint',
        requiredWorkFamily: 'CAPITAL_GATE_CHECKPOINTS',
        capitalGateId: 'regulatory_consultant',
        capitalRequirement: { min: 500, typical: 1000, max: 1500 },
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description:
          'Third-party food label review for this Illinois functional-food launch typically costs $500-$1,500. Confirm this capital is available before engaging the reviewer.',
        sessionTitles: ['Confirm capital availability for third-party food label review before engaging the reviewer'],
      }),
      makeAction({
        id: labelReviewId,
        title: 'Third-party food label review',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [regulatoryCapitalId],
        requiredWorkFamily: 'REGULATORY_AND_LABEL_REVIEW',
        blockType: 'waiting_period',
        waitType: 'regulatory_review',
        minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.regulatoryReviewEngagement.min,
        parallelWorkSuggestions: ['buyer segment definition', 'CTA drafting', 'merchant preparation'],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description:
          'Illinois has strict food labeling requirements. Before packaging goes to print, a third-party regulatory consultant must review the label for FDA food labeling compliance, Illinois-specific requirements, and caffeine disclosure requirements for functional food. This costs $500-$1,500 and takes 2-3 weeks. Do not skip this.',
        costEstimate: '$500-$1,500',
        planQualityTags: ['illinois_label_review_required'],
        sessionTitles: ['Submit label copy, warnings, and claims for third-party Illinois/FDA food label review'],
      }),
      makeAction({
        id: labelReviseId,
        title: 'Receive and revise claims and label copy against consultant recommendations',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [labelReviewId],
        requiredWorkFamily: 'REGULATORY_AND_LABEL_REVIEW',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        sessionTitles: ['Receive label review report and revise claims, warnings, and label copy against consultant recommendations'],
      }),
      makeAction({
        id: claimsLockId,
        title: 'Lock compliance-safe claims with consultant sign-off',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [labelReviseId],
        requiredWorkFamily: 'REGULATORY_AND_LABEL_REVIEW',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        sessionTitles: ['Lock compliance-safe claims with consultant sign-off before packaging print and live product copy'],
      }),
      makeAction({
        id: packagingResearchId,
        title: 'Research packaging suppliers and format options',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [manufacturerResearchId],
        dependencyDetails: [{ actionId: manufacturerResearchId, dependencyType: 'directional' }],
        requiredWorkFamily: 'PARALLEL_PACKAGING_TRACK',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 3: Capital acquisition track',
        description:
          'Begin packaging supplier outreach concurrently with manufacturer work. Full formula lock is not required to have meaningful packaging conversations for a white-label gum product.',
        sessionTitles: ['Research packaging suppliers and format options in parallel with white-label manufacturer outreach'],
      }),
      makeAction({
        id: packagingQuoteAId,
        title: 'Request packaging quote and dieline requirements from supplier A',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [packagingResearchId],
        requiredWorkFamily: 'PARALLEL_PACKAGING_TRACK',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 3: Capital acquisition track',
        sessionTitles: ['Request packaging quote and dieline requirements from supplier A'],
      }),
      makeAction({
        id: packagingQuoteBId,
        title: 'Request packaging quote and dieline requirements from supplier B',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [packagingResearchId],
        requiredWorkFamily: 'PARALLEL_PACKAGING_TRACK',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 3: Capital acquisition track',
        sessionTitles: ['Request packaging quote and dieline requirements from supplier B'],
      }),
      makeAction({
        id: packagingCompareId,
        title: 'Compare packaging costs, lead times, minimums, and print constraints',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [packagingQuoteAId, packagingQuoteBId],
        requiredWorkFamily: 'PARALLEL_PACKAGING_TRACK',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 3: Capital acquisition track',
        sessionTitles: ['Compare packaging costs, lead times, minimums, and print constraints before production approval'],
      }),
      makeAction({
        id: packagingCapitalId,
        title: 'Capital checkpoint 3 - Packaging production',
        deliverable: capitalDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [packagingCompareId, claimsLockId],
        blockType: 'capital_checkpoint',
        requiredWorkFamily: 'CAPITAL_GATE_CHECKPOINTS',
        capitalGateId: 'packaging_design_and_production',
        capitalRequirement: { min: 2000, typical: 3500, max: 5000 },
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description: 'Custom packaging design and production typically costs $2,000-$5,000. Confirm capital availability before approving production.',
        sessionTitles: ['Confirm capital availability before approving custom packaging production'],
      }),
      makeAction({
        id: packagingProductionId,
        title: 'Packaging production lead time',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [packagingCapitalId],
        blockType: 'waiting_period',
        waitType: 'packaging_production',
        requiredWorkFamily: 'PARALLEL_PACKAGING_TRACK',
        minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.packagingProductionLeadTime.min,
        parallelWorkSuggestions: ['presale launch prep', 'merchant underwriting', '3PL setup'],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        sessionTitles: ['Approve packaging design for production and wait for printed packaging delivery'],
      }),
      makeAction({
        id: presaleLaunchId,
        title: 'Presale campaign launch',
        deliverable: capitalDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [presaleOfferId, sampleOrderId, imageryApproveId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 3: Capital acquisition track',
        description:
          'Activate your warm list through artist social channels, Instagram, and your entrepreneur and influencer network. Launch only after sample validation is complete and you have a real ship date estimate. If you do not raise the $8,000 in this phase, you do not move to production. The system does not let you pretend.',
        acceptanceNote: "If you don't raise the $8,000 you don't move to production.",
        planQualityTags: ['plain_language_moq_gate'],
        sessionTitles: ['Launch the Founders Kit presale to warm audience only after sample validation and ship-date confidence'],
      }),
      makeAction({
        id: presaleTrackId,
        title: 'Track presale revenue in dedicated account',
        deliverable: capitalDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [presaleLaunchId, openBankId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 3: Capital acquisition track',
        description:
          'Every presale dollar goes into the gum-brand Mercury account. When the balance hits $8,000 the MOQ gate unlocks. Until then, production is not scheduled.',
        capitalTarget: { amount: 8000, unitPrice: 40, unitsRequired: 200 },
        sessionTitles: ['Track presale revenue in the dedicated gum-brand account against the $8,000 MOQ target'],
      }),
      makeAction({
        id: insurancePurchaseId,
        title: 'Purchase product liability insurance',
        deliverable: administrativeDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [insuranceResearchId, manufacturerCatalogId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description:
          'You researched this in Phase 1. Purchase it now. You need the certificate of insurance before the manufacturer will sign the production contract.',
        costEstimate: '$500-$2,000 annually',
        planQualityTags: ['insurance_hard_gate'],
        sessionTitles: ['Purchase product liability insurance before manufacturer contract and deposit payment'],
      }),
      makeAction({
        id: moqCapitalId,
        title: 'Capital checkpoint 4 - MOQ production deposit',
        deliverable: capitalDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [presaleTrackId, claimsLockId, insurancePurchaseId, packagingProductionId],
        blockType: 'capital_checkpoint',
        requiredWorkFamily: 'CAPITAL_GATE_CHECKPOINTS',
        capitalGateId: 'moq_production_deposit',
        capitalRequirement: { min: 5000, typical: 6500, max: 8000 },
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description:
          'The production deposit is the largest capital commitment in this plan. Based on a typical white-label MOQ run this is estimated at $5,000-$8,000 and is irreversible. Confirm label review complete, insurance active, packaging approved, and the $8,000 target reached before production is unlocked.',
        acceptanceNote: "If you don't raise the $8,000 you don't move to production.",
        sessionTitles: ['Confirm the $8,000 MOQ deposit gate is unlocked before scheduling production'],
      }),
      makeAction({
        id: depositId,
        title: 'Pay 50% manufacturing deposit',
        deliverable: capitalDeliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [moqCapitalId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description:
          'This is the point of no return. Once you pay the deposit you are committed to the production run. Confirm before paying: label review complete, insurance active, presale target met, and packaging approved for production.',
        costEstimate: '$5,000-$8,000',
        sessionTitles: ['Pay 50% manufacturing deposit only after the four upstream confirmations are true'],
      }),
      makeAction({
        id: productionWaitId,
        title: 'Dead space management - production queue',
        deliverable: launchDeliverable,
        actionType: 'preparation',
        phaseHint: 'late',
        dependencies: [depositId],
        blockType: 'waiting_period',
        waitType: 'production_run',
        minimumDurationBusinessDays: Math.max(
          70,
          REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.productionRunLeadTime.max
        ),
        parallelWorkSuggestions: [
          'Build Shopify store',
          'Complete high-risk merchant account underwriting',
          'Set up 3PL account and inbound shipment plan',
          'Create influencer seeding strategy and outreach',
          'Prepare fulfillment process for Founders Kit orders',
          'Build post-purchase sequence for first customers',
        ],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description:
          'The factory now has your order. You will not hear much from them for 10-14 weeks. This is not dead time. It is the window for everything that would have blocked your launch if you had left it until later.',
        planQualityTags: ['dead_space_framing_present'],
        sessionTitles: ['Manage the 10-14 week production queue as active launch preparation rather than dead time'],
      }),
      makeAction({
        id: storeBuildId,
        title: 'Build Shopify store and hidden review site for merchant underwriting',
        deliverable: launchDeliverable,
        actionType: 'preparation',
        phaseHint: 'late',
        dependencies: [imageryApproveId, claimsLockId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description:
          'Merchant underwriting requires a finished but hidden website with product photos and claims already reviewed. Build it during the production wait, not after inventory arrives.',
        sessionTitles: ['Build the Shopify store and hidden review site required for merchant underwriting during the production wait'],
      }),
      makeAction({
        id: merchantResearchId,
        title: 'Research high-risk merchant processing options for caffeine functional food',
        deliverable: launchDeliverable,
        actionType: 'preparation',
        phaseHint: 'late',
        dependencies: [claimsLockId],
        requiredWorkFamily: 'MERCHANT_ACCOUNT_UNDERWRITING',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description:
          'Caffeine functional food is supplement-adjacent. Stripe and Shopify Payments may flag or terminate the category. Start explicit high-risk processor research during the production wait, not after inventory arrives.',
        sessionTitles: ['Research high-risk merchant processors during the production wait rather than after inventory arrives'],
      }),
      makeAction({
        id: merchantPrepId,
        title: 'Prepare merchant account application materials and product documentation',
        deliverable: launchDeliverable,
        actionType: 'preparation',
        phaseHint: 'late',
        dependencies: [merchantResearchId, storeBuildId],
        requiredWorkFamily: 'MERCHANT_ACCOUNT_UNDERWRITING',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        sessionTitles: ['Prepare merchant application materials using the hidden review site, product docs, and imagery set'],
      }),
      makeAction({
        id: merchantSubmitId,
        title: 'Submit merchant account application',
        deliverable: launchDeliverable,
        actionType: 'preparation',
        phaseHint: 'late',
        dependencies: [merchantPrepId],
        requiredWorkFamily: 'MERCHANT_ACCOUNT_UNDERWRITING',
        blockType: 'waiting_period',
        waitType: 'merchant_account_underwriting',
        minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.merchantAccountUnderwriting.min,
        parallelWorkSuggestions: ['3PL setup', 'fulfillment prep', 'influencer seeding plan'],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description:
          'Underwriting takes 3-5 weeks and must begin during the production wait. If it starts late, treat that as a stop-work risk in the plan rather than something to solve after inventory arrives.',
        sessionTitles: ['Submit merchant account application during the production wait and begin underwriting'],
      }),
      makeAction({
        id: merchantRespondId,
        title: 'Respond to underwriter requests for additional information',
        deliverable: launchDeliverable,
        actionType: 'preparation',
        phaseHint: 'late',
        dependencies: [merchantSubmitId],
        requiredWorkFamily: 'MERCHANT_ACCOUNT_UNDERWRITING',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        sessionTitles: ['Respond to underwriter requests for additional information quickly enough to protect the launch date'],
      }),
      makeAction({
        id: merchantApprovalId,
        title: 'Confirm merchant account approval',
        deliverable: launchDeliverable,
        actionType: 'preparation',
        phaseHint: 'late',
        dependencies: [merchantRespondId],
        requiredWorkFamily: 'MERCHANT_ACCOUNT_UNDERWRITING',
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        sessionTitles: ['Confirm merchant account approval before any real order acceptance'],
      }),
      makeAction({
        id: merchantRiskReviewId,
        title: 'Review stop-work risk if underwriting starts late',
        deliverable: reviewDeliverableForPath,
        actionType: 'preparation',
        phaseHint: 'late',
        dependencies: [merchantResearchId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description:
          'Merchant underwriting must start during the production wait. If it slips, call out the stop-work risk explicitly in the plan summary rather than pretending it can be solved after inventory arrives.',
        sessionTitles: ['Review stop-work risk if merchant underwriting starts too late to clear before first sale'],
      }),
      makeAction({
        id: threePlId,
        title: 'Set up 3PL account and inbound shipment plan',
        deliverable: launchDeliverable,
        actionType: 'preparation',
        phaseHint: 'late',
        dependencies: [depositId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 4: Production and compliance',
        description:
          'Complete 3PL setup and inbound shipment planning before inventory arrives and before the first Founders Kit order ships so fulfillment does not stall on logistics.',
        planQualityTags: ['three_pl_before_fulfillment'],
        sessionTitles: ['Set up 3PL account and inbound shipment plan before the first Founders Kit order ships'],
      }),
      makeAction({
        id: influencerId,
        title: 'Influencer seeding',
        deliverable: launchDeliverable,
        actionType: 'execution',
        phaseHint: 'late',
        dependencies: [productionWaitId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 5: Launch and first sales evidence',
        description:
          'Send product to your influencer network before the public launch. Ask for honest reaction content, not paid promotion. Authentic reaction from people your audience trusts is worth more than ads at this stage.',
        sessionTitles: ['Prepare and send influencer seeding batch before public launch using trusted warm-network voices'],
      }),
      makeAction({
        id: checkoutPathId,
        title: 'Select checkout or order-capture path for first real sales',
        deliverable: launchDeliverable,
        actionType: 'preparation',
        phaseHint: 'late',
        dependencies: [merchantApprovalId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 5: Launch and first sales evidence',
        sessionTitles: ['Select checkout or order-capture path only after merchant approval is confirmed'],
      }),
      makeAction({
        id: checkoutFieldsId,
        title: 'Configure checkout fields',
        deliverable: launchDeliverable,
        actionType: 'preparation',
        phaseHint: 'late',
        dependencies: [checkoutPathId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 5: Launch and first sales evidence',
        sessionTitles: ['Configure checkout fields after merchant approval and checkout-path selection are both complete'],
      }),
      makeAction({
        id: fulfillFoundersId,
        title: "Fulfill Founder's Kit pre-orders",
        deliverable: launchDeliverable,
        actionType: 'execution',
        phaseHint: 'late',
        dependencies: [productionWaitId, merchantApprovalId, threePlId, checkoutFieldsId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 5: Launch and first sales evidence',
        description:
          'Your presale customers bought trust. Fulfill on time, communicate proactively, and make the unboxing worth posting about. These 200 buyers are your first street team if you treat them right.',
        sessionTitles: ["Fulfill Founder's Kit pre-orders with proactive communication and street-team-level customer experience"],
      }),
      makeAction({
        id: coldSaleId,
        title: 'First cold sale tracking',
        deliverable: reviewDeliverableForPath,
        actionType: 'execution',
        phaseHint: 'late',
        dependencies: [fulfillFoundersId, influencerId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 5: Launch and first sales evidence',
        description:
          'A cold sale is a purchase from someone who did not know you before this product existed, not a music fan, network contact, or presale buyer. Track when it happens, where it came from, and what the buyer says. This is a distinct proof-of-market gate, not the same thing as presale fulfillment.',
        planQualityTags: ['cold_sale_distinct_milestone'],
        sessionTitles: ['Track the first cold sale as a separate milestone from presale fulfillment and warm-network orders'],
      }),
      makeAction({
        id: outreachCyclesId,
        title: 'Structured outreach cycles',
        deliverable: reviewDeliverableForPath,
        actionType: 'execution',
        phaseHint: 'late',
        dependencies: [coldSaleId],
        pathwayTag: 'agnostic',
        phaseLabel: 'Phase 5: Launch and first sales evidence',
        description:
          'After the first 100 orders, run structured outreach cycles: identify highest-intent buyer segments, refine the offer based on real feedback, expand outreach to cold channels, and repeat every 2-3 weeks.',
        sessionTitles: ['Run structured outreach cycles after first-sales evidence to refine segment, offer, and cold-channel expansion'],
      })
    );

    return actionsForPath;
  };

  if (shouldUseIllinoisEnergyGumFounderPath()) {
    return buildIllinoisEnergyGumFounderActions();
  }

  const makeFoundationActions = ({
    familyNumber,
    deliverable,
    dependencies = [],
    chunkDependencies = () => [],
    chunkPhaseHint = () => 'early',
  }: {
    familyNumber: number;
    deliverable: { id?: string; title?: string; requiredBlocks?: number };
    dependencies?: string[];
    chunkDependencies?: (chunkIndex: number, chunk: string[]) => string[];
    chunkPhaseHint?: (chunkIndex: number, chunk: string[]) => 'early' | 'mid' | 'late';
  }) => {
    const sessionTitles = commercialProductSessionTitles(
      String(deliverable?.title || ''),
      Math.max(1, Number(deliverable?.requiredBlocks || 1))
    );
    const chunks: string[][] = [];
    const foundationChunkSize = options.regulatedConsumable && (familyNumber === 1 || familyNumber === 2) ? 5 : 4;
    for (let index = 0; index < sessionTitles.length; index += foundationChunkSize) {
      chunks.push(sessionTitles.slice(index, index + foundationChunkSize));
    }
    const actionsForFamily: any[] = [];
    const usedActionTitles = new Set<string>();
    chunks.forEach((chunk, chunkIndex) => {
      const actionTitle =
        chunk.find((title) => !usedActionTitles.has(String(title || '').toLowerCase())) ||
        (chunk[0] ? `${chunk[0]} follow-up pass ${chunkIndex + 1}` : 'Advance commercial product launch readiness');
      usedActionTitles.add(String(actionTitle || '').toLowerCase());
      const priorId = actionsForFamily[chunkIndex - 1]?.id;
      const additionalChunkDependencies = chunkDependencies(chunkIndex, chunk);
      const resolvedDependencies = Array.from(
        new Set([...(priorId ? [priorId] : dependencies), ...additionalChunkDependencies].filter(Boolean))
      );
      actionsForFamily.push(
        makeAction({
          id: `brand:${String(familyNumber).padStart(2, '0')}:${String(chunkIndex + 1).padStart(
            2,
            '0'
          )}:${compactSlugifyTitle(actionTitle)}`,
          title: actionTitle,
          deliverable,
          actionType: 'preparation',
          phaseHint: chunkPhaseHint(chunkIndex, chunk),
          dependencies: resolvedDependencies,
          sessionTitles: chunk,
        })
      );
    });
    return actionsForFamily;
  };

  const buildRegulatedConsumableRequirementActions = (deliverable: {
    id?: string;
    title?: string;
    requiredBlocks?: number;
  }) => {
    const dosageBasisId = 'brand:00:01:caffeine-dosage-serving-assumptions';
    const ingredientHandlingId = 'brand:00:02:ingredient-handling-stability-assumptions';
    const regulatoryCapitalId = 'brand:00:03:capital-checkpoint-regulatory-consultant';
    const engageRegulatoryId = 'brand:00:04:engage-regulatory-label-review-consultant';
    const submitRegulatoryId = 'brand:00:05:submit-formula-and-claims-for-compliance-review';
    const receiveRegulatoryId = 'brand:00:06:receive-and-review-consultant-compliance-report';
    const reviseClaimsId = 'brand:00:07:revise-claims-and-label-copy-against-consultant-report';
    const claimsLabelId = 'brand:00:08:lock-compliance-safe-claims-with-consultant-sign-off';
    const merchantResearchId = 'brand:00:09:research-high-risk-merchant-processing-options';
    const merchantPrepId = 'brand:00:10:prepare-merchant-account-application-materials';
    const merchantSubmitId = 'brand:00:11:submit-merchant-account-application';
    const merchantRespondId = 'brand:00:12:respond-to-underwriter-information-requests';
    const merchantApprovalId = 'brand:00:13:confirm-merchant-account-approval';
    const imageryDirectionId = 'brand:00:14:define-visual-direction-for-hero-imagery';
    const imageryCommissionId = 'brand:00:15:commission-product-photography-or-rendering';
    const imageryApproveId = 'brand:00:16:review-and-approve-final-hero-imagery';
    const imageryIntegrateId = 'brand:00:17:integrate-approved-imagery-into-product-page-and-outreach-assets';
    const packagingResearchId = 'brand:00:18:research-packaging-suppliers-and-format-options';
    const packagingQuoteAId = 'brand:00:19:request-packaging-quote-and-dieline-from-supplier-a';
    const packagingQuoteBId = 'brand:00:20:request-packaging-quote-and-dieline-from-supplier-b';
    const packagingCompareId = 'brand:00:21:compare-packaging-costs-lead-times-minimums-and-print-constraints';
    const packagingCapitalId = 'brand:00:22:capital-checkpoint-packaging-production';
    const packagingProductionId = 'brand:00:23:packaging-production-lead-time';
    const productionCapitalId = 'brand:00:24:capital-checkpoint-moq-production-deposit';
    const productionRunId = 'brand:00:25:production-run-lead-time';

    const actionsForLayer: any[] = [
      makeAction({
        id: dosageBasisId,
        title: 'Define caffeine dosage and serving-size assumptions',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        pathwayTag: 'agnostic',
        sessionTitles: [
          'Confirm caffeine dosage range, serving assumptions, and ingredient safety boundaries',
          'List evidence needed to support caffeine, benefit, ingredient, and use claims',
        ],
      }),
      makeAction({
        id: ingredientHandlingId,
        title: 'Define ingredient handling, storage, and stability assumptions',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [dosageBasisId],
        pathwayTag: 'agnostic',
        sessionTitles: [
          'Document gum handling, storage, and stability assumptions before buyer claims',
          'Map ingredient and sample-handling assumptions that manufacturer responses must confirm',
        ],
      }),
      makeAction({
        id: regulatoryCapitalId,
        title: 'Capital checkpoint 1 - Regulatory consultant engagement',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [dosageBasisId],
        blockType: 'capital_checkpoint',
        requiredWorkFamily: 'CAPITAL_GATE_CHECKPOINTS',
        capitalGateId: 'regulatory_consultant',
        capitalRequirement: { min: 2000, typical: 5000, max: 8000 },
        pathwayTag: 'agnostic',
        sessionTitles: ['Confirm capital availability for regulatory consultant engagement before scheduling this work'],
      }),
      makeAction({
        id: engageRegulatoryId,
        title: 'Engage regulatory/label review consultant',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [regulatoryCapitalId],
        requiredWorkFamily: 'REGULATORY_AND_LABEL_REVIEW',
        pathwayTag: 'agnostic',
        sessionTitles: ['Engage regulatory consultant and define review scope for claims, label copy, and warnings'],
      }),
      makeAction({
        id: submitRegulatoryId,
        title: 'Submit formula and intended claims for compliance review',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [engageRegulatoryId],
        dependencyDetails: [
          { actionId: dosageBasisId, dependencyType: 'directional' },
          { actionId: ingredientHandlingId, dependencyType: 'directional' },
        ],
        requiredWorkFamily: 'REGULATORY_AND_LABEL_REVIEW',
        blockType: 'waiting_period',
        waitType: 'regulatory_review',
        minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.regulatoryReviewEngagement.min,
        parallelWorkSuggestions: ['commerce hypothesis work', 'buyer segment definition', 'CTA drafting'],
        pathwayTag: 'agnostic',
        sessionTitles: ['Submit draft formula and intended claims for compliance review'],
      }),
      makeAction({
        id: receiveRegulatoryId,
        title: 'Receive and review consultant compliance report',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [submitRegulatoryId],
        requiredWorkFamily: 'REGULATORY_AND_LABEL_REVIEW',
        pathwayTag: 'agnostic',
        sessionTitles: ['Receive and review consultant compliance report for claims, warnings, and evidence gaps'],
      }),
      makeAction({
        id: reviseClaimsId,
        title: 'Revise claims and label copy against consultant recommendations',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [receiveRegulatoryId],
        requiredWorkFamily: 'REGULATORY_AND_LABEL_REVIEW',
        pathwayTag: 'agnostic',
        sessionTitles: ['Revise claims and label copy against consultant recommendations'],
      }),
      makeAction({
        id: claimsLabelId,
        title: 'Lock compliance-safe claims with consultant sign-off',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [reviseClaimsId],
        requiredWorkFamily: 'REGULATORY_AND_LABEL_REVIEW',
        pathwayTag: 'agnostic',
        sessionTitles: ['Lock compliance-safe claims with consultant sign-off'],
      }),
      makeAction({
        id: merchantResearchId,
        title: 'Research high-risk merchant processing options for food and supplement categories',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        requiredWorkFamily: 'MERCHANT_ACCOUNT_UNDERWRITING',
        pathwayTag: 'agnostic',
        sessionTitles: ['Research high-risk merchant processing options for food and supplement categories'],
      }),
      makeAction({
        id: merchantPrepId,
        title: 'Prepare merchant account application materials and product documentation',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [merchantResearchId],
        requiredWorkFamily: 'MERCHANT_ACCOUNT_UNDERWRITING',
        pathwayTag: 'agnostic',
        sessionTitles: ['Prepare merchant account application materials and product documentation'],
      }),
      makeAction({
        id: merchantSubmitId,
        title: 'Submit merchant account application',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [merchantPrepId],
        requiredWorkFamily: 'MERCHANT_ACCOUNT_UNDERWRITING',
        blockType: 'waiting_period',
        waitType: 'merchant_account_underwriting',
        minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.merchantAccountUnderwriting.min,
        parallelWorkSuggestions: ['checkout configuration drafting', 'fulfillment handling definition', 'product page refinement'],
        pathwayTag: 'agnostic',
        sessionTitles: ['Submit merchant account application and begin underwriting review'],
      }),
      makeAction({
        id: merchantRespondId,
        title: 'Respond to underwriter requests for additional information',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [merchantSubmitId],
        requiredWorkFamily: 'MERCHANT_ACCOUNT_UNDERWRITING',
        pathwayTag: 'agnostic',
        sessionTitles: ['Respond to underwriter requests for additional information'],
      }),
      makeAction({
        id: merchantApprovalId,
        title: 'Confirm merchant account approval',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [merchantRespondId],
        requiredWorkFamily: 'MERCHANT_ACCOUNT_UNDERWRITING',
        pathwayTag: 'agnostic',
        sessionTitles: ['Confirm merchant account approval before checkout activation'],
      }),
      makeAction({
        id: imageryDirectionId,
        title: 'Define visual direction and reference examples for product imagery',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        requiredWorkFamily: 'HERO_IMAGERY_PRODUCTION',
        pathwayTag: 'agnostic',
        sessionTitles: ['Define visual direction and reference examples for product imagery'],
      }),
      makeAction({
        id: imageryCommissionId,
        title: 'Commission product photography or 3D rendering',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [imageryDirectionId],
        requiredWorkFamily: 'HERO_IMAGERY_PRODUCTION',
        pathwayTag: 'agnostic',
        sessionTitles: ['Commission product photography or 3D rendering'],
      }),
      makeAction({
        id: imageryApproveId,
        title: 'Review and approve final hero imagery',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [imageryCommissionId],
        requiredWorkFamily: 'HERO_IMAGERY_PRODUCTION',
        pathwayTag: 'agnostic',
        sessionTitles: ['Review and approve final hero imagery'],
      }),
      makeAction({
        id: imageryIntegrateId,
        title: 'Integrate approved imagery into product page and outreach assets',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'mid',
        dependencies: [imageryApproveId],
        requiredWorkFamily: 'HERO_IMAGERY_PRODUCTION',
        pathwayTag: 'agnostic',
        sessionTitles: ['Integrate approved imagery into product page and outreach assets'],
      }),
      makeAction({
        id: packagingResearchId,
        title: 'Research packaging suppliers and format options',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [dosageBasisId],
        dependencyDetails: [{ actionId: dosageBasisId, dependencyType: 'directional' }],
        requiredWorkFamily: 'PARALLEL_PACKAGING_TRACK',
        pathwayTag: 'agnostic',
        sessionTitles: ['Research packaging suppliers and format options'],
      }),
      makeAction({
        id: packagingQuoteAId,
        title: 'Request packaging quote and dieline requirements from supplier A',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [packagingResearchId],
        requiredWorkFamily: 'PARALLEL_PACKAGING_TRACK',
        pathwayTag: 'agnostic',
        sessionTitles: ['Request packaging quote and dieline requirements from supplier A'],
      }),
      makeAction({
        id: packagingQuoteBId,
        title: 'Request packaging quote and dieline requirements from supplier B',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [packagingResearchId],
        requiredWorkFamily: 'PARALLEL_PACKAGING_TRACK',
        pathwayTag: 'agnostic',
        sessionTitles: ['Request packaging quote and dieline requirements from supplier B'],
      }),
      makeAction({
        id: packagingCompareId,
        title: 'Compare packaging costs, lead times, minimums, and print constraints',
        deliverable,
        actionType: 'preparation',
        phaseHint: 'early',
        dependencies: [packagingQuoteAId, packagingQuoteBId],
        requiredWorkFamily: 'PARALLEL_PACKAGING_TRACK',
        pathwayTag: 'agnostic',
        sessionTitles: ['Compare packaging costs, lead times, minimums, and print constraints'],
      }),
    ];

    const pathwayActions: any[] = [];
    let formulaDirectionId = dosageBasisId;
    let formulaLockId = ingredientHandlingId;
    let manufacturerWaitId = '';
    let sampleRequestCapitalId = '';
    let firstSampleRequestId = '';

    if (selectedPathway === 'custom_development') {
      const formulationCapitalId = 'brand:00:26:capital-checkpoint-formulation-consultant';
      const engageFormulationId = 'brand:00:27:engage-formulation-consultant-and-define-development-brief';
      const reviewProposalId = 'brand:00:28:review-formulation-consultant-proposal-and-confirm-scope';
      const iterationOneId = 'brand:00:29:formulation-development-iteration-1';
      const iterationTwoId = 'brand:00:30:formulation-development-iteration-2';
      const formulationSignoffId = 'brand:00:31:formulation-development-sign-off';
      manufacturerWaitId = 'brand:00:32:manufacturer-initial-response-wait';
      sampleRequestCapitalId = 'brand:00:33:capital-checkpoint-sample-cycle-costs';
      firstSampleRequestId = 'brand:00:34:first-sample-request-to-manufacturer';
      pathwayActions.push(
        makeAction({ id: formulationCapitalId, title: 'Capital checkpoint - Formulation consultant engagement', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [ingredientHandlingId], blockType: 'capital_checkpoint', capitalGateId: 'formulation_consultant', capitalRequirement: { min: 5000, typical: 12000, max: 20000 }, pathwayTag: 'custom_development', sessionTitles: ['Confirm capital availability for formulation consultant engagement'] }),
        makeAction({ id: engageFormulationId, title: 'Engage formulation consultant and define development brief', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [formulationCapitalId], pathwayTag: 'custom_development', sessionTitles: ['Engage formulation consultant and define development brief'] }),
        makeAction({ id: reviewProposalId, title: 'Review formulation consultant proposal and confirm scope', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [engageFormulationId], pathwayTag: 'custom_development', sessionTitles: ['Review formulation consultant proposal and confirm scope'] }),
        makeAction({ id: iterationOneId, title: 'Formulation development iteration 1 - consultant produces draft formula', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [reviewProposalId], pathwayTag: 'custom_development', sessionTitles: ['Formulation development iteration 1 - consultant produces draft formula'] }),
        makeAction({ id: iterationTwoId, title: 'Formulation development iteration 2 - revise against acceptance criteria', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [iterationOneId], pathwayTag: 'custom_development', sessionTitles: ['Formulation development iteration 2 - revise against acceptance criteria'] }),
        makeAction({ id: formulationSignoffId, title: 'Formulation development sign-off - lock formula for manufacturer handoff', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [iterationTwoId], pathwayTag: 'custom_development', sessionTitles: ['Formulation development sign-off - lock formula for manufacturer handoff'] }),
        makeAction({ id: manufacturerWaitId, title: 'Manufacturer initial response and quote wait', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [formulationSignoffId], dependencyDetails: [{ actionId: formulationSignoffId, dependencyType: 'directional' }], blockType: 'waiting_period', waitType: 'manufacturer_initial_response', minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.manufacturerInitialResponse.min, parallelWorkSuggestions: ['packaging supplier outreach', 'regulatory consultant engagement', 'merchant account research'], pathwayTag: 'custom_development', sessionTitles: ['Submit custom formula for manufacturer capability review, quote, and lead-time response'] }),
        makeAction({ id: sampleRequestCapitalId, title: 'Capital checkpoint 2 - Sample cycle costs', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [manufacturerWaitId], blockType: 'capital_checkpoint', requiredWorkFamily: 'CAPITAL_GATE_CHECKPOINTS', capitalGateId: 'sample_cycle_costs', capitalRequirement: { min: 1500, typical: 4500, max: 9000 }, pathwayTag: 'custom_development', sessionTitles: ['Confirm capital availability for expected custom-development sample cycles'] }),
        makeAction({ id: firstSampleRequestId, title: 'First sample request to manufacturer', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [sampleRequestCapitalId], pathwayTag: 'custom_development', sessionTitles: ['Request first custom sample run from manufacturer'] })
      );
      formulaDirectionId = reviewProposalId;
      formulaLockId = formulationSignoffId;
    } else if (selectedPathway === 'white_label') {
      const selectionId = 'brand:00:26:select-white-label-formula-and-confirm-availability';
      manufacturerWaitId = 'brand:00:27:white-label-manufacturer-initial-response';
      sampleRequestCapitalId = 'brand:00:28:capital-checkpoint-sample-cycle-costs';
      firstSampleRequestId = 'brand:00:29:first-sample-request-to-manufacturer';
      pathwayActions.push(
        makeAction({ id: selectionId, title: 'Select white-label formula and confirm availability with manufacturer', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [ingredientHandlingId], pathwayTag: 'white_label', sessionTitles: ['Select white-label formula and confirm availability with manufacturer'] }),
        makeAction({ id: manufacturerWaitId, title: 'Manufacturer initial response and quote wait', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [selectionId], blockType: 'waiting_period', waitType: 'manufacturer_initial_response', minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.manufacturerInitialResponse.min, parallelWorkSuggestions: ['packaging supplier outreach', 'regulatory consultant engagement', 'merchant account research'], pathwayTag: 'white_label', sessionTitles: ['Request white-label sample availability, quote, certifications, and initial lead-time response'] }),
        makeAction({ id: sampleRequestCapitalId, title: 'Capital checkpoint 2 - Sample cycle costs', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [manufacturerWaitId], blockType: 'capital_checkpoint', requiredWorkFamily: 'CAPITAL_GATE_CHECKPOINTS', capitalGateId: 'sample_cycle_costs', capitalRequirement: { min: 500, typical: 1500, max: 2000 }, pathwayTag: 'white_label', sessionTitles: ['Confirm capital availability for the expected white-label validation sample cycle'] }),
        makeAction({ id: firstSampleRequestId, title: 'First sample request to manufacturer', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [sampleRequestCapitalId], pathwayTag: 'white_label', sessionTitles: ['Request white-label validation sample from manufacturer'] })
      );
      formulaDirectionId = selectionId;
      formulaLockId = selectionId;
    } else {
      const catalogId = 'brand:00:26:request-manufacturer-base-formula-catalog-and-modification-options';
      const selectBaseId = 'brand:00:27:select-base-formula-and-define-modification-parameters';
      const modifyConfirmId = 'brand:00:28:confirm-modification-feasibility-and-cost-with-manufacturer';
      manufacturerWaitId = 'brand:00:29:manufacturer-initial-response-and-quote-wait';
      sampleRequestCapitalId = 'brand:00:30:capital-checkpoint-sample-cycle-costs';
      firstSampleRequestId = 'brand:00:31:first-sample-request-to-manufacturer';
      pathwayActions.push(
        makeAction({ id: catalogId, title: 'Request manufacturer base formula catalog and modification options', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [ingredientHandlingId], pathwayTag: 'base_modification', sessionTitles: ['Request manufacturer base formula catalog and modification options'] }),
        makeAction({ id: selectBaseId, title: 'Select base formula and define modification parameters', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [catalogId], pathwayTag: 'base_modification', sessionTitles: ['Select base formula and define modification parameters'] }),
        makeAction({ id: modifyConfirmId, title: 'Confirm modification feasibility and cost with manufacturer', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [selectBaseId], pathwayTag: 'base_modification', sessionTitles: ['Confirm modification feasibility and cost with manufacturer'] }),
        makeAction({ id: manufacturerWaitId, title: 'Manufacturer initial response and quote wait', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [modifyConfirmId], dependencyDetails: [{ actionId: catalogId, dependencyType: 'directional' }], blockType: 'waiting_period', waitType: 'manufacturer_initial_response', minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.manufacturerInitialResponse.min, parallelWorkSuggestions: ['packaging supplier outreach', 'regulatory consultant engagement', 'merchant account research'], pathwayTag: 'base_modification', sessionTitles: ['Wait for manufacturer quote, capability confirmation, and base modification response'] }),
        makeAction({ id: sampleRequestCapitalId, title: 'Capital checkpoint 2 - Sample cycle costs', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [manufacturerWaitId], blockType: 'capital_checkpoint', requiredWorkFamily: 'CAPITAL_GATE_CHECKPOINTS', capitalGateId: 'sample_cycle_costs', capitalRequirement: { min: 1000, typical: 3000, max: 6000 }, pathwayTag: 'base_modification', sessionTitles: ['Confirm capital availability for the expected base-modification sample cycles'] }),
        makeAction({ id: firstSampleRequestId, title: 'First sample request to manufacturer', deliverable, actionType: 'preparation', phaseHint: 'early', dependencies: [sampleRequestCapitalId], pathwayTag: 'base_modification', sessionTitles: ['Request first modified-base sample run from manufacturer'] })
      );
      formulaDirectionId = selectBaseId;
      formulaLockId = modifyConfirmId;
    }

    const sampleCycleBaseOffset = selectedPathway === 'custom_development' ? 35 : selectedPathway === 'white_label' ? 30 : 32;
    for (let sampleIndex = 0; sampleIndex < minimumSampleCycles; sampleIndex += 1) {
      const cycleNumber = sampleIndex + 1;
      const sampleCycleId = `brand:00:${String(sampleCycleBaseOffset + sampleIndex).padStart(2, '0')}:sample-cycle-${cycleNumber}`;
      const dependencyId = sampleIndex === 0 ? firstSampleRequestId : pathwayActions[pathwayActions.length - 1]?.id || firstSampleRequestId;
      pathwayActions.push(
        makeAction({
          id: sampleCycleId,
          title: `Sample cycle ${cycleNumber} - production, shipping, evaluation, and decision wait`,
          deliverable,
          actionType: 'preparation',
          phaseHint: cycleNumber >= minimumSampleCycles ? 'mid' : 'early',
          dependencies: [dependencyId],
          blockType: 'waiting_period',
          waitType: 'sample_cycle_per_iteration',
          minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.sampleCyclePerIteration.min,
          parallelWorkSuggestions: ['marketing asset production', 'packaging design iteration', 'product page drafting'],
          pathwayTag: selectedPathway,
          sessionTitles: [`Sample cycle ${cycleNumber} - wait for production, shipping, evaluation, and revision decision`],
        })
      );
      formulaLockId = sampleCycleId;
    }

    actionsForLayer.push(
      ...pathwayActions,
      makeAction({ id: packagingCapitalId, title: 'Capital checkpoint 3 - Packaging production', deliverable, actionType: 'preparation', phaseHint: 'mid', dependencies: [packagingCompareId], blockType: 'capital_checkpoint', requiredWorkFamily: 'CAPITAL_GATE_CHECKPOINTS', capitalGateId: 'packaging_design_and_production', capitalRequirement: { min: 3000, typical: 5500, max: 8000 }, pathwayTag: 'agnostic', sessionTitles: ['Confirm capital availability before approving packaging design for production'] }),
      makeAction({ id: packagingProductionId, title: 'Packaging production lead time', deliverable, actionType: 'preparation', phaseHint: 'mid', dependencies: [packagingCapitalId], blockType: 'waiting_period', waitType: 'packaging_production', requiredWorkFamily: 'PARALLEL_PACKAGING_TRACK', minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.packagingProductionLeadTime.min, parallelWorkSuggestions: ['outreach preparation', 'merchant account underwriting', 'sales cycle preparation'], pathwayTag: 'agnostic', sessionTitles: ['Approve packaging design for production and wait for printed packaging delivery'] }),
      makeAction({ id: productionCapitalId, title: 'Capital checkpoint 4 - MOQ production deposit', deliverable, actionType: 'preparation', phaseHint: 'mid', dependencies: [packagingProductionId], blockType: 'capital_checkpoint', requiredWorkFamily: 'CAPITAL_GATE_CHECKPOINTS', capitalGateId: 'moq_production_deposit', capitalRequirement: { min: 8000, typical: 15000, max: 25000 }, pathwayTag: 'agnostic', sessionTitles: ['Confirm capital availability before committing to production run and deposit payment'] }),
      makeAction({ id: productionRunId, title: 'Production run lead time', deliverable, actionType: 'preparation', phaseHint: 'late', dependencies: [productionCapitalId], blockType: 'waiting_period', waitType: 'production_run', minimumDurationBusinessDays: REGULATED_PHYSICAL_CONSUMABLE_REALISM.durations.productionRunLeadTime.min, parallelWorkSuggestions: ['first sales outreach', 'buyer response capture', 'commerce friction resolution'], pathwayTag: 'agnostic', sessionTitles: ['Commit to production run, pay deposit, and track inventory lead time to first receipt'] })
    );

    return {
      actions: actionsForLayer,
      dosageSafetyId: dosageBasisId,
      claimsLabelId,
      manufacturerSampleId: manufacturerWaitId,
      costEconomicsId: productionCapitalId,
      channelShipId: productionCapitalId,
      formulaDirectionId,
      formulaLockId,
      merchantApprovalId,
      heroImageryApprovalId: imageryApproveId,
      packagingCompareId,
      packagingProductionId,
      productionRunId,
      sampleCycleCount: minimumSampleCycles,
      selectedPathway,
    };
  };

  const regulatedLayer = options.regulatedConsumable
    ? buildRegulatedConsumableRequirementActions(productDeliverable)
    : null;
  const productActions = makeFoundationActions({
    familyNumber: 1,
    deliverable: productDeliverable,
    dependencies: regulatedLayer
      ? [regulatedLayer.formulaDirectionId, regulatedLayer.formulaLockId].filter(Boolean)
      : [],
  });
  const setDependencyTypeForAction = (
    actionsForFamily: any[],
    actionIdFragment: string,
    dependencyIdFragment: string,
    dependencyType: 'hard_gate' | 'directional' | 'informational'
  ) => {
    const action = actionsForFamily.find((candidate) => String(candidate?.id || '').includes(actionIdFragment));
    if (!action) {
      return;
    }
    action.dependencyDetails = (Array.isArray(action.dependencyDetails) ? action.dependencyDetails : []).map((detail) => {
      const detailActionId = String(detail?.actionId || detail?.dependencyId || '').trim();
      if (!detailActionId.includes(dependencyIdFragment)) {
        return detail;
      }
      return {
        ...detail,
        dependencyType,
      };
    });
  };
  setDependencyTypeForAction(
    productActions,
    'list-caffeine-dosage-flavor-texture-and-compliance-assumptions',
    'caffeine-dosage-serving-assumptions',
    'directional'
  );
  setDependencyTypeForAction(
    productActions,
    'list-caffeine-dosage-flavor-texture-and-compliance-assumptions',
    'manufacturer-sample-lead-time-fallback-loop',
    'directional'
  );
  setDependencyTypeForAction(
    productActions,
    'validate-sellable-unit-readiness-with-packaging-labeling-and-fulfillment',
    'confirm-sample-approval-path-and-evidence-needed-before-sales',
    'directional'
  );
  const commerceActions = makeFoundationActions({
    familyNumber: 2,
    deliverable: commerceDeliverable,
    dependencies: [
      productActions[0]?.id,
      ...(regulatedLayer ? [regulatedLayer.claimsLabelId, regulatedLayer.merchantApprovalId] : []),
    ].filter(Boolean),
    chunkDependencies: regulatedLayer
      ? (chunkIndex) =>
          chunkIndex >= 1 ? [regulatedLayer.costEconomicsId, regulatedLayer.channelShipId, regulatedLayer.productionRunId] : []
      : undefined,
    chunkPhaseHint: options.regulatedConsumable ? (chunkIndex) => (chunkIndex >= 1 ? 'mid' : 'early') : undefined,
  });
  if (commerceActions[0]) {
    commerceActions[0] = {
      ...commerceActions[0],
      requiredWorkFamily: 'MERCHANT_ACCOUNT_UNDERWRITING',
    };
  }
  const communicationsActions = makeFoundationActions({
    familyNumber: 3,
    deliverable: communicationsDeliverable,
    dependencies: [
      productActions[0]?.id,
      commerceActions[0]?.id,
      ...(regulatedLayer ? [regulatedLayer.claimsLabelId, regulatedLayer.heroImageryApprovalId] : []),
    ].filter(Boolean),
  });
  if (communicationsActions[0]) {
    communicationsActions[0] = {
      ...communicationsActions[0],
      requiredWorkFamily: 'HERO_IMAGERY_PRODUCTION',
    };
  }

  const actions: any[] = regulatedLayer ? [...regulatedLayer.actions] : [];
  const maxFoundationChunks = Math.max(productActions.length, commerceActions.length, communicationsActions.length);
  for (let index = 0; index < maxFoundationChunks; index += 1) {
    if (productActions[index]) actions.push(productActions[index]);
    if (commerceActions[index]) actions.push(commerceActions[index]);
    if (communicationsActions[index]) actions.push(communicationsActions[index]);
  }
  const productReadyId = productActions[productActions.length - 1]?.id;
  const commerceReadyId = commerceActions[commerceActions.length - 1]?.id;
  const communicationsReadyId = communicationsActions[communicationsActions.length - 1]?.id;
  let priorCycleTerminalId = '';
  for (let cycleIndex = 1; cycleIndex <= cycleCount; cycleIndex += 1) {
    const phaseHint = cycleIndex >= Math.max(3, cycleCount - 2) ? 'late' : 'mid';
    const frictionProfile = commercialCycleFrictionProfile(cycleIndex, cycleCount);
    const baseDependencies =
      cycleIndex === 1
        ? [
            productReadyId,
            commerceReadyId,
            communicationsReadyId,
            regulatedLayer?.merchantApprovalId,
            regulatedLayer?.heroImageryApprovalId,
            regulatedLayer?.packagingProductionId,
          ].filter(Boolean)
        : [priorCycleTerminalId].filter(Boolean);
    const buyerOfferId = `brand:04:${String(cycleIndex).padStart(2, '0')}:cycle-${cycleIndex}-buyer-offer`;
    const outreachResponseId = `brand:04:${String(cycleIndex).padStart(2, '0')}:cycle-${cycleIndex}-outreach-response`;
    const purchaseFrictionId = `brand:04:${String(cycleIndex).padStart(2, '0')}:cycle-${cycleIndex}-purchase-friction`;
    const adjustmentId = `brand:05:${String(cycleIndex).padStart(2, '0')}:cycle-${cycleIndex}-adjustment`;
    const decisionRoles = commercialCycleDecisionRoles(cycleIndex === cycleCount, frictionProfile);
    const interpretationId = `brand:05:${String(cycleIndex).padStart(
      2,
      '0'
    )}:cycle-${cycleIndex}-evidence-interpretation`;
    const decisionId = `brand:05:${String(cycleIndex).padStart(2, '0')}:cycle-${cycleIndex}-next-move-decision`;
    const hasInterpretationDecision = decisionRoles.includes('interpret_cycle_evidence');
    const finalDecisionDependency = hasInterpretationDecision ? interpretationId : adjustmentId;

    actions.push(
      makeAction({
        id: buyerOfferId,
        title: `Cycle ${cycleIndex} buyer segment and offer prep`,
        deliverable: salesDeliverable,
        actionType: 'execution',
        phaseHint,
        commercialCycleIndex: cycleIndex,
        dependencies: baseDependencies,
        sessionTitles: commercialCycleBuyerAndOfferTitles(cycleIndex),
      }),
      makeAction({
        id: outreachResponseId,
        title: `Cycle ${cycleIndex} outreach batch and response capture`,
        deliverable: salesDeliverable,
        actionType: 'execution',
        phaseHint,
        commercialCycleIndex: cycleIndex,
        dependencies: [buyerOfferId],
        sessionTitles: commercialCycleOutreachAndResponseTitles(cycleIndex, frictionProfile),
      }),
      makeAction({
        id: purchaseFrictionId,
        title: `Cycle ${cycleIndex} purchase-path attempt and friction capture`,
        deliverable: salesDeliverable,
        actionType: 'execution',
        phaseHint,
        commercialCycleIndex: cycleIndex,
        dependencies: [outreachResponseId],
        sessionTitles: commercialCyclePurchaseAndFrictionTitles(cycleIndex, frictionProfile),
      }),
      makeAction({
        id: adjustmentId,
        title: commercialCycleAdjustmentActionTitle(cycleIndex, frictionProfile),
        deliverable: reviewDeliverable,
        actionType: 'execution',
        phaseHint,
        commercialCycleIndex: cycleIndex,
        dependencies: [purchaseFrictionId, outreachResponseId],
        sessionTitles: commercialCycleAdjustmentTitles(cycleIndex, frictionProfile),
      })
    );

    if (hasInterpretationDecision) {
      actions.push(
        makeAction({
          id: interpretationId,
          title: commercialCycleDecisionTitleForRole(cycleIndex, 'interpret_cycle_evidence', frictionProfile),
          deliverable: reviewDeliverable,
          actionType: 'execution',
          phaseHint,
          commercialCycleIndex: cycleIndex,
          dependencies: [adjustmentId],
          sessionTitles: [commercialCycleDecisionTitleForRole(cycleIndex, 'interpret_cycle_evidence', frictionProfile)],
        })
      );
    }

    actions.push(
      makeAction({
        id: decisionId,
        title:
          cycleIndex === cycleCount
            ? commercialCycleDecisionTitleForRole(cycleIndex, 'terminal_launch_push_or_handoff', frictionProfile)
            : commercialCycleDecisionTitleForRole(cycleIndex, 'commit_next_market_move', frictionProfile),
        deliverable: reviewDeliverable,
        actionType: 'execution',
        phaseHint,
        commercialCycleIndex: cycleIndex,
        dependencies: [finalDecisionDependency],
        sessionTitles: [
          commercialCycleDecisionTitleForRole(
            cycleIndex,
            cycleIndex === cycleCount ? 'terminal_launch_push_or_handoff' : 'commit_next_market_move',
            frictionProfile
          ),
        ],
      })
    );
    priorCycleTerminalId = decisionId;
  }

  return actions;
}

type CommercialFrictionDomain =
  | 'weak_clicks_or_no_response'
  | 'pricing_resistance'
  | 'trust_proof_safety_objections'
  | 'checkout_payment_friction'
  | 'shipping_fulfillment_uncertainty'
  | 'segment_mismatch'
  | 'weak_order_intent';

type CommercialDecisionRole =
  | 'interpret_cycle_evidence'
  | 'commit_next_market_move'
  | 'terminal_launch_push_or_handoff';

function commercialCycleFrictionProfile(cycleIndex: number, cycleCount: number): CommercialFrictionDomain[] {
  const profiles: CommercialFrictionDomain[][] = [
    ['weak_clicks_or_no_response', 'trust_proof_safety_objections', 'checkout_payment_friction'],
    ['pricing_resistance', 'segment_mismatch'],
    ['checkout_payment_friction', 'shipping_fulfillment_uncertainty', 'weak_order_intent'],
    [
      'weak_clicks_or_no_response',
      'pricing_resistance',
      'trust_proof_safety_objections',
      'segment_mismatch',
      'weak_order_intent',
    ],
    ['pricing_resistance', 'checkout_payment_friction', 'shipping_fulfillment_uncertainty', 'weak_order_intent'],
  ];
  const profile = profiles[Math.max(0, cycleIndex - 1)] || profiles[profiles.length - 1];
  if (cycleIndex === cycleCount && !profile.includes('weak_order_intent')) {
    return [...profile, 'weak_order_intent'];
  }
  return profile;
}

function hasCommercialFriction(profile: CommercialFrictionDomain[], domain: CommercialFrictionDomain) {
  return profile.includes(domain);
}

function commercialCycleFrictionSummary(profile: CommercialFrictionDomain[]) {
  if (profile.length <= 2) {
    return profile
      .map((domain) => {
        if (domain === 'pricing_resistance') return 'pricing';
        if (domain === 'segment_mismatch') return 'segment-fit';
        if (domain === 'weak_clicks_or_no_response') return 'response';
        if (domain === 'trust_proof_safety_objections') return 'trust-proof';
        if (domain === 'checkout_payment_friction') return 'checkout';
        if (domain === 'shipping_fulfillment_uncertainty') return 'fulfillment';
        return 'order-intent';
      })
      .join(' and ');
  }
  return 'multi-domain commercial';
}

function commercialCycleDecisionRoles(
  isTerminalCycle: boolean,
  frictionProfile: CommercialFrictionDomain[]
): CommercialDecisionRole[] {
  if (isTerminalCycle) {
    return frictionProfile.length > 2
      ? ['interpret_cycle_evidence', 'terminal_launch_push_or_handoff']
      : ['terminal_launch_push_or_handoff'];
  }
  if (frictionProfile.length > 2) {
    return ['interpret_cycle_evidence', 'commit_next_market_move'];
  }
  return ['commit_next_market_move'];
}

function commercialCycleDecisionTitleForRole(
  cycleIndex: number,
  role: CommercialDecisionRole,
  frictionProfile: CommercialFrictionDomain[]
) {
  if (role === 'interpret_cycle_evidence') {
    return `Synthesize cycle ${cycleIndex} evidence conclusion from ${commercialCycleFrictionSummary(
      frictionProfile
    )} friction`;
  }
  if (role === 'terminal_launch_push_or_handoff') {
    return `Make terminal first-sales push, remaining-risk call, and launch handoff from cycle ${cycleIndex}`;
  }
  return `Commit cycle ${cycleIndex} next market move: segment, channel, offer, and follow-up push`;
}

function deriveCommercialLaunchCycleCount(
  deliverables: Array<{ id?: string; title?: string; requiredBlocks?: number }>
) {
  const totalRequiredBlocks = deliverables.reduce(
    (sum, deliverable) => sum + Math.max(0, Number(deliverable?.requiredBlocks || 0)),
    0
  );
  // totalRequiredBlocks / 28 accurately recovers operatingCycles from autoStrategy because
  // the per-deliverable formulas produce exactly 28 total blocks per cycle. The old
  // salesBlocks/8 override overstated the cycle count (yielding 9 for a 5-cycle plan)
  // and was always clamped away — removing it keeps the derivation clean.
  return Math.max(3, Math.min(8, Math.ceil(totalRequiredBlocks / 28)));
}

function commercialCycleBuyerAndOfferTitles(cycleIndex: number) {
  if (cycleIndex === 1) {
    return [
      'Target and segment first buyers from warm contacts, niche communities, and likely early adopters',
      'Prepare cycle 1 offer with CTA, proof points, pricing angle, guarantee, and purchase path',
    ];
  }
  return [
    `Target and segment buyers for cycle ${cycleIndex} from prior objections, clicked channels, and order-intent signals`,
    `Prepare cycle ${cycleIndex} revised offer with CTA, proof, pricing angle, guarantee, and purchase path`,
  ];
}

function commercialCycleOutreachAndResponseTitles(cycleIndex: number, frictionProfile: CommercialFrictionDomain[]) {
  const titles = [
    cycleIndex === 1
      ? 'Send first 10 buyer outreach messages with purchase-path CTA and version tracking'
      : `Send outreach batch ${cycleIndex} with revised proof, pricing cue, and purchase-path CTA`,
    `Capture cycle ${cycleIndex} response signal: replies, clicks, objections, questions, silence, and order intent`,
  ];
  if (hasCommercialFriction(frictionProfile, 'weak_clicks_or_no_response')) {
    titles.push(`Review cycle ${cycleIndex} weak clicks, silence patterns, and no-response buyer segments`);
  }
  if (hasCommercialFriction(frictionProfile, 'pricing_resistance')) {
    titles.push(`Review cycle ${cycleIndex} pricing objections, discount requests, and guarantee concerns`);
  }
  if (hasCommercialFriction(frictionProfile, 'trust_proof_safety_objections')) {
    titles.push(`Review cycle ${cycleIndex} trust, proof, ingredient, and caffeine-safety objections`);
  }
  if (hasCommercialFriction(frictionProfile, 'segment_mismatch')) {
    titles.push(`Review cycle ${cycleIndex} segment mismatch from buyer fit, channel quality, and response depth`);
  }
  if (hasCommercialFriction(frictionProfile, 'weak_order_intent')) {
    titles.push(
      `Review cycle ${cycleIndex} weak order intent from buyer questions, clicks, and stalled purchase signals`
    );
  }
  return titles;
}

function commercialCyclePurchaseAndFrictionTitles(cycleIndex: number, frictionProfile: CommercialFrictionDomain[]) {
  const titles = [`Run cycle ${cycleIndex} purchase-path attempt with highest-intent buyer or real checkout test`];
  if (hasCommercialFriction(frictionProfile, 'checkout_payment_friction')) {
    titles.push(`Break down cycle ${cycleIndex} checkout and payment friction from product page through order capture`);
  }
  if (hasCommercialFriction(frictionProfile, 'shipping_fulfillment_uncertainty')) {
    titles.push(`Break down cycle ${cycleIndex} shipping, fulfillment, refund, and delivery-timing friction`);
  }
  if (hasCommercialFriction(frictionProfile, 'weak_order_intent')) {
    titles.push(`Trace cycle ${cycleIndex} weak order-intent dropoff from CTA click through purchase decision`);
  }
  return titles;
}

function commercialCycleAdjustmentActionTitle(cycleIndex: number, frictionProfile: CommercialFrictionDomain[]) {
  return `Resolve cycle ${cycleIndex} ${commercialCycleFrictionSummary(frictionProfile)} friction`;
}

function commercialCycleAdjustmentTitles(cycleIndex: number, frictionProfile: CommercialFrictionDomain[]) {
  const titles: string[] = [];
  if (hasCommercialFriction(frictionProfile, 'weak_clicks_or_no_response')) {
    titles.push(`Revise cycle ${cycleIndex} CTA hook and channel opener after weak clicks and silence`);
  }
  if (hasCommercialFriction(frictionProfile, 'pricing_resistance')) {
    titles.push(`Revise cycle ${cycleIndex} pricing, guarantee, and pack-size angle after price resistance`);
  }
  if (hasCommercialFriction(frictionProfile, 'trust_proof_safety_objections')) {
    titles.push(`Strengthen cycle ${cycleIndex} proof, ingredient, and caffeine-safety cues after trust objections`);
  }
  if (hasCommercialFriction(frictionProfile, 'checkout_payment_friction')) {
    titles.push(`Fix cycle ${cycleIndex} checkout, payment, and order-capture friction before the next push`);
  }
  if (hasCommercialFriction(frictionProfile, 'shipping_fulfillment_uncertainty')) {
    titles.push(`Clarify cycle ${cycleIndex} shipping, refund, fulfillment, and delivery timing assumptions`);
  }
  if (hasCommercialFriction(frictionProfile, 'segment_mismatch')) {
    titles.push(`Retarget cycle ${cycleIndex} buyer segment and channel from mismatch evidence`);
  }
  if (hasCommercialFriction(frictionProfile, 'weak_order_intent')) {
    titles.push(`Rebuild cycle ${cycleIndex} purchase-intent proof and follow-up prompt after weak order signals`);
  }
  return titles.length > 0
    ? titles
    : [`Confirm cycle ${cycleIndex} no material commercial friction before the next sales push`];
}

function commercialCycleDecisionTitles(
  cycleIndex: number,
  isTerminalCycle: boolean,
  frictionProfile: CommercialFrictionDomain[]
) {
  return commercialCycleDecisionRoles(isTerminalCycle, frictionProfile).map((role) =>
    commercialCycleDecisionTitleForRole(cycleIndex, role, frictionProfile)
  );
}

function commercialFamilyKey(title: string, fallbackIndex: number) {
  const lower = title.toLowerCase();
  if (/\bformula|sample|packaging|sourcing|sellable unit\b/.test(lower)) return 'product';
  if (/\boffer|pricing|product page|checkout|ordering|fulfillment\b/.test(lower)) return 'commerce';
  if (/\bpositioning|messaging|campaign assets|sales cta\b/.test(lower)) return 'communications';
  if (/\bfirst-sales outreach|first order attempts|initial buyers\b/.test(lower)) return 'sales';
  if (/\bfirst-sales evidence|conversion results|next-step decision\b/.test(lower)) return 'review';
  return `family-${fallbackIndex + 1}`;
}

function commercialProductSessionTitles(deliverableTitle: string, requiredBlocks: number) {
  const lower = deliverableTitle.toLowerCase();
  let base: string[];
  let refinements: string[];

  if (/\bformula|sample|packaging|sourcing|sellable unit\b/.test(lower)) {
    base = [
      'List caffeine dosage, flavor, texture, and compliance assumptions for the gum formula',
      'Shortlist viable stimulant dosage and gum base formulation options',
      'Request sample capability notes from two gum manufacturers',
      'Compare manufacturer MOQ, lead time, certifications, and sample cost',
      'Choose initial formula direction and sample acceptance criteria',
      'Define packaging format, count size, label claims, and required warnings',
      'Request packaging quote and dieline requirements from supplier A',
      'Request packaging quote and dieline requirements from supplier B',
      'Compare packaging costs, lead times, minimums, and print constraints',
      'Create sellable unit readiness checklist for formula, packaging, and sourcing',
      'Confirm sample approval path and evidence needed before sales',
      'Lock sourcing next steps, owner, risk, and fallback manufacturer',
    ];
    refinements = [
      'Refine gum formula tolerances after sample feedback and manufacturing review',
      'Resolve supplier risk and MOQ issues from manufacturer responses',
      'Update packaging proof points based on sample handling and compliance evidence',
      'Validate sellable unit readiness with packaging, labeling, and fulfillment checks',
      'Finalize formula and sample acceptance criteria from buyer safety signals',
      'Reconcile label warnings with caffeine dose, ingredient, and compliance assumptions',
      'Compare fallback manufacturer readiness against primary supplier gaps',
      'Revise packaging dieline and print constraints after supplier quote review',
      'Check sample stability and handling assumptions before first paid-order claims',
      'Lock minimum sellable-unit evidence for safe launch communication',
      'Confirm inventory, sample, or preorder boundary for first real sales',
      'Prepare manufacturer follow-up questions for unresolved sourcing risks',
    ];
  } else if (/\boffer|pricing|product page|checkout|ordering|fulfillment\b/.test(lower)) {
    base = [
      'Define launch offer promise, pack size, price hypothesis, and buyer guarantee',
      'Compare unit economics using formula, packaging, shipping, and platform fees',
      'Draft pricing test assumptions and minimum viable margin threshold',
      'Outline product page sections for benefits, ingredients, usage, and proof',
      'Write product page copy for caffeine benefit, flavor, safety, and buyer fit',
      'Select checkout or order-capture path for first real sales',
      'Configure checkout fields, payment method, tax/shipping assumptions, and confirmation flow',
      'Test order path from product page click through payment or order capture',
      'Define fulfillment handling for paid orders, samples, backorders, and refunds',
      'Create purchase-path readiness checklist and failure recovery notes',
      'Run buyer-perspective checkout review and record friction points',
      'Lock commercial readiness evidence for first-sales execution',
    ];
    refinements = [
      'Tighten pricing hypothesis after early objection patterns',
      'Improve product page clarity and CTA after low click-through evidence',
      'Address checkout friction found in a buyer-perspective purchase test',
      'Verify payment and fulfillment flow with a sample order attempt',
      'Refine fulfillment and payment assumptions from blocked order evidence',
      'Revise guarantee and pack-size framing after buyer hesitation signals',
      'Audit checkout confirmation copy and order-status messaging for trust gaps',
      'Compare shipping, refund, and backorder assumptions against buyer questions',
      'Retest product page CTA from benefit claim through order-capture path',
      'Document purchase-path failure recovery for blocked first-sale attempts',
      'Update unit economics after supplier, packaging, and fulfillment changes',
      'Confirm first-order handling owner, timing, and buyer communication steps',
    ];
  } else if (/\bpositioning|messaging|campaign assets|sales cta\b/.test(lower)) {
    base = [
      'Define target buyer segment and strongest caffeinated gum use case',
      'Write positioning statement tied to energy, convenience, taste, and trust',
      'Draft three message pillars for product benefit, safety, and buying reason',
      'Create product proof points from formula, packaging, sourcing, and offer assumptions',
      'Draft launch CTA tied to real purchase or order attempt',
      'Build product page hero copy and buyer objection answers',
      'Create starter asset checklist for product image, pack mockup, CTA, and proof',
      'Draft outreach message variant for early buyers',
      'Draft channel announcement variant with purchase-path link',
      'Review messaging against product readiness and commercial truth',
    ];
    refinements = [
      'Refine buyer segment after weak early response quality',
      'Adjust proof points and trust cues based on outreach reaction evidence',
      'Test revised CTA messaging for clearer purchase intent',
      'Update launch assets with stronger buyer-facing proof and urgency',
      'Review campaign asset effectiveness and prune nonperforming messaging',
      'Rewrite buyer use-case copy from strongest objection and trigger patterns',
      'Strengthen safety, caffeine, and ingredient proof for skeptical buyers',
      'Revise outreach copy to connect pack size, price, and purchase path',
      'Align announcement copy with current offer, checkout, and fulfillment truth',
      'Prepare alternate message variant for lower-trust buyer segment',
      'Cut vague brand language that does not support real purchase intent',
      'Refresh asset checklist from latest product and offer constraints',
    ];
  } else if (/\bfirst-sales outreach|first order attempts|initial buyers\b/.test(lower)) {
    base = [
      'Build first-buyer list from warm contacts, niche communities, and likely early adopters',
      'Segment first-buyer list by urgency, relationship strength, and purchase likelihood',
      'Send first 10 buyer outreach messages with purchase-path CTA',
      'Log buyer replies, objections, clicks, and order intent evidence',
      'Send follow-up wave to non-responders with clearer offer and CTA',
      'Run direct first-order attempt with highest-intent buyer segment',
      'Capture checkout failures, order objections, and fulfillment blockers',
      'Track first order attempts, conversions, and blocked transactions',
      'Escalate working channel and pause nonperforming outreach',
      'Prepare evidence packet for first-sales review',
    ];
    refinements = [
      'Log buyer reply quality, objections, clicks, and order intent after the first outreach',
      'Draft revised outreach offer and CTA after low intent or weak response signals',
      'Run a second buyer outreach wave with revised proof and segmented targeting',
      'Capture and fix checkout friction and blocked conversion signals from first orders',
      'Escalate the strongest channel and pause low-conversion outreach segments',
      'Prepare outreach follow-up queue for late-horizon buyer reactivation',
    ];
  } else {
    // REVIEW FAMILY: Distinguish preparation (chunk 0) from analysis (later chunks)
    if (requiredBlocks > 1) {
      // Return analysis titles - filtering for chunk 0 happens at chunk level
      base = [
        'Compile first-sales evidence from orders, replies, clicks, objections, and checkout attempts',
        'Review conversion path from outreach to product page to purchase attempt',
        'Separate product-readiness blockers from messaging and purchase-path blockers',
        'Calculate first-sales conversion results and evidence strength',
        'Identify whether formula, packaging, pricing, or fulfillment blocked sales',
        'Decide next commercial action: iterate offer, fix purchase path, or expand outreach',
        'Document buyer evidence and next-step decision for the gum launch',
        'Prepare terminal sales review summary and remaining risk list',
      ];
      refinements = base; // Use same titles for refinements
    } else {
      // Single chunk: Mix of preparation and analysis
      base = [
        'Define first-sales evidence checklist and success signals to track',
        'Prepare buyer response logging framework and objection categories',
        'Set up conversion path monitoring and friction capture points',
        'Create evidence review criteria and decision triggers for first sales',
        'Compile first-sales evidence from orders, replies, clicks, objections, and checkout attempts',
        'Review conversion path from outreach to product page to purchase attempt',
        'Calculate first-sales conversion results and evidence strength',
        'Decide next commercial action from sales evidence',
      ];
      refinements = [
        'Compare evidence across buyer segments and conversion paths',
        'Review the strongest blockers in the first-sales corridor',
        'Decide whether to adjust offer, purchase path, or targeting based on evidence',
        'Prepare the next commercial milestone from first-sales results',
        'Record sales evidence trends and update the launch plan',
      ];
    }
  }

  const titles: string[] = [];
  for (let index = 0; index < requiredBlocks; index += 1) {
    const roundIndex = Math.floor(index / base.length);
    const cycleIndex = index % base.length;
    if (roundIndex === 0) {
      titles.push(base[cycleIndex]);
      continue;
    }
    const refinement = refinements[cycleIndex % refinements.length] || refinements[0];
    titles.push(refinement);
  }
  return titles;
}

function buildSalesPipelineGraph(goalDraftV2: unknown, contract: unknown, executionType: string) {
  const goalContract = ((contract || {}) as Record<string, unknown>) || {};
  const terminalOutcome = (goalContract?.terminalOutcome || {}) as Record<string, unknown>;

  const deliverables = generateAutoDeliverables({
    ...(goalContract as object),
    executionType,
    goalText: String(goalContract?.goalText || draftText(goalDraftV2)),
    terminalOutcome: {
      text: String(terminalOutcome?.text || draftText(goalDraftV2)),
      verificationCriteria: String(terminalOutcome?.verificationCriteria || ''),
    },
  } as any);

  const deriveSalesActionTitles = (deliverableTitle: string) => {
    const title = String(deliverableTitle || '').trim();
    const lower = title.toLowerCase();
    const objectTitle = title.replace(
      /^(audit|clarify|define|build|create|configure|execute|run|prepare|close)\s+/i,
      ''
    );

    let preparationTitle = /^audit|^clarify|^define/.test(lower)
      ? `Capture scope, requirements, and proof target for ${objectTitle}`
      : /^run /.test(lower)
        ? `Prepare ${objectTitle}`
        : `Scope ${objectTitle}`;
    let completionTitle = /^(audit|clarify|define|build|create|configure|execute|run|prepare|close)\s+/i.test(lower)
      ? title
      : `Complete ${objectTitle}`;

    if (lower.includes('offer, pricing tiers, and qualification criteria')) {
      preparationTitle = `Capture offer scope, pricing logic, and qualification rules for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('target account list')) {
      preparationTitle = `Define ICP signals, account filters, and lead-priority scoring for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('outreach scripts and objection-handling library')) {
      preparationTitle = `Prepare outreach messaging, objection handling, and reply branches for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('pipeline tracking dashboard') || lower.includes('crm stages')) {
      preparationTitle = `Map CRM stages, owner fields, and conversion tracking for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('outreach wave')) {
      preparationTitle = `Prepare lead batches, send plan, and follow-up cadence for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('discovery calls') || lower.includes('qualify active opportunities')) {
      preparationTitle = `Prepare discovery agenda, qualification notes, and opportunity criteria for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('proposal packages')) {
      preparationTitle = `Prepare proposal structure, pricing options, and implementation terms for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('negotiation sequence')) {
      preparationTitle = `Prepare negotiation plan, follow-up timing, and commitment tracking for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('onboarding handoff package')) {
      preparationTitle = `Prepare onboarding summary, closed-won notes, and handoff details for ${objectTitle}`;
      completionTitle = title;
    }

    return { title, lower, preparationTitle, completionTitle };
  };

  const actions = deliverables.flatMap((deliverable, index) => {
    const { title, lower, preparationTitle, completionTitle } = deriveSalesActionTitles(
      String(deliverable.title || '')
    );
    const totalMinutes = Math.max(
      90,
      Number(deliverable.requiredBlocks || 1) * 60 +
        (lower.includes('outreach') || lower.includes('discovery') || lower.includes('negotiation') ? 30 : 0)
    );
    const prepId = `sales:${String(index * 2 + 1).padStart(3, '0')}:${compactSlugifyTitle(preparationTitle)}`;
    const completionId = `sales:${String(index * 2 + 2).padStart(3, '0')}:${compactSlugifyTitle(completionTitle)}`;
    const previousCompletionId = (() => {
      if (index <= 0) return null;
      const previousTitles = deriveSalesActionTitles(String(deliverables[index - 1]?.title || ''));
      return `sales:${String(index * 2).padStart(3, '0')}:${compactSlugifyTitle(previousTitles.completionTitle)}`;
    })();

    return [
      {
        id: prepId,
        title: preparationTitle,
        label: preparationTitle,
        deliverable: title,
        actionType: 'preparation',
        definitionOfDone: `${preparationTitle} is complete and ready for pipeline execution.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.35)),
        category: 'VENTURE_LAUNCH',
        dependencies: previousCompletionId ? [previousCompletionId] : [],
      },
      {
        id: completionId,
        title: completionTitle,
        label: completionTitle,
        deliverable: title,
        actionType: classifyCompletionActionType(completionTitle),
        definitionOfDone: `${title} is completed with visible pipeline evidence tied to the admitted goal.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.65)),
        category: 'VENTURE_LAUNCH',
        dependencies: [prepId],
      },
    ];
  });

  return {
    version: 'jericho_action_graph_v1',
    executionType,
    actions,
    templates: [
      {
        title: 'Sales pipeline execution block',
        domain: 'Resources',
        durationMinutes: 45,
        frequency: 'daily',
        reason: 'Keeps offer, targeting, outreach, and close work tied to concrete pipeline outputs.',
      },
      {
        title: 'Weekly pipeline conversion review',
        domain: 'Focus',
        durationMinutes: 45,
        frequency: 'weekly',
        reason:
          'Checks conversion movement, opportunity quality, and next-step decisions against the admitted revenue target.',
      },
    ],
    diagnostics: {
      actionCount: actions.length,
      totalEstimateMin: actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0),
      requiredWeeklyMinutes: Math.max(
        60,
        Math.round(actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0) / 6)
      ),
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 0,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for SalesPipeline goals derived from admitted contract deliverables.'],
    },
  };
}

function buildFundraisingGraph(goalDraftV2: unknown, contract: unknown, executionType: string) {
  const goalContract = ((contract || {}) as Record<string, unknown>) || {};
  const terminalOutcome = (goalContract?.terminalOutcome || {}) as Record<string, unknown>;
  const fundraisingText = `${String(goalContract?.goalText || draftText(goalDraftV2))} ${String(
    terminalOutcome?.verificationCriteria || ''
  )}`.toLowerCase();
  const packagePrepMode =
    /\b(package|pitch|investor-ready|investor ready|materials?)\b/.test(fundraisingText) &&
    /\b(prepare|clear|ready|readiness|story|ask|use[- ]of[- ]funds)\b/.test(fundraisingText) &&
    !/\b(meetings?|diligence\s+(?:started|requests?)|commitments?|term(?:s)?\b|close\b|closing\b|signature\b|investor conversations?)\b/.test(
      fundraisingText
    );

  const deliverables = generateAutoDeliverables({
    ...(goalContract as object),
    executionType,
    goalText: String(goalContract?.goalText || draftText(goalDraftV2)),
    terminalOutcome: {
      text: String(terminalOutcome?.text || draftText(goalDraftV2)),
      verificationCriteria: String(terminalOutcome?.verificationCriteria || ''),
    },
  } as any);

  const deriveFundraisingActionTitles = (deliverableTitle: string) => {
    const title = String(deliverableTitle || '').trim();
    const lower = title.toLowerCase();
    const objectTitle = title.replace(/^(audit|define|build|create|prepare|run|deliver|coordinate|finalize)\s+/i, '');

    let preparationTitle = /^audit|^define/.test(lower)
      ? `Capture scope, evidence target, and raise constraints for ${objectTitle}`
      : /^run /.test(lower)
        ? `Prepare ${objectTitle}`
        : `Scope ${objectTitle}`;
    let completionTitle = /^(audit|define|build|create|prepare|run|deliver|coordinate|finalize)\s+/i.test(lower)
      ? title
      : `Complete ${objectTitle}`;

    if (lower.includes('raise objective, use-of-funds, and investor thesis')) {
      preparationTitle = `Capture raise size, use-of-funds, and investor fit logic for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('fundraising narrative, pitch deck, and financial ask storyline')) {
      preparationTitle = `Prepare fundraising story, pitch deck proof points, and financial ask arc for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('fundraising narrative and deck storyline')) {
      preparationTitle = `Prepare fundraising story, proof points, and deck arc for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('diligence checklist, financial package, and data room structure')) {
      preparationTitle = `Map diligence requirements, financial package contents, and data-room structure for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('diligence checklist and data room structure')) {
      preparationTitle = `Map diligence requirements, document checklist, and data-room structure for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('target investor list and fit scoring model')) {
      preparationTitle = `Define investor filters, fit scoring, and target pipeline criteria for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('outreach sequences, intro request scripts, and send package checklist')) {
      preparationTitle = `Prepare outreach messaging, intro requests, and send-package checklist for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('outreach sequences and intro request scripts')) {
      preparationTitle = `Prepare outreach messaging, intro requests, and follow-up timing for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('fundraising readiness review, objection handling, and investor-ready materials check')) {
      preparationTitle = `Prepare objection handling, package review criteria, and investor-ready materials check for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('first wave of investor outreach and meetings')) {
      preparationTitle = `Prepare investor batch, outreach cadence, and meeting agenda for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('follow-up materials and manage diligence requests')) {
      preparationTitle = `Prepare follow-up packet, diligence responses, and request tracking for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('term discussions and commitment tracking')) {
      preparationTitle = `Prepare term discussion points, commitment tracker, and next-step decisions for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('legal close process and signature workflow')) {
      preparationTitle = `Prepare legal close checklist, signature flow, and funding milestones for ${objectTitle}`;
      completionTitle = title;
    }

    return { title, lower, preparationTitle, completionTitle };
  };

  const actions = deliverables.flatMap((deliverable, index) => {
    const { title, lower, preparationTitle, completionTitle } = deriveFundraisingActionTitles(
      String(deliverable.title || '')
    );
    const totalMinutes = Math.max(
      90,
      Number(deliverable.requiredBlocks || 1) * 60 +
        (lower.includes('outreach') || lower.includes('meetings') || lower.includes('diligence') ? 30 : 0)
    );
    const prepId = `raise:${String(index * 2 + 1).padStart(3, '0')}:${compactSlugifyTitle(preparationTitle)}`;
    const completionId = `raise:${String(index * 2 + 2).padStart(3, '0')}:${compactSlugifyTitle(completionTitle)}`;
    const previousCompletionId = (() => {
      if (index <= 0) return null;
      const previousTitles = deriveFundraisingActionTitles(String(deliverables[index - 1]?.title || ''));
      return `raise:${String(index * 2).padStart(3, '0')}:${compactSlugifyTitle(previousTitles.completionTitle)}`;
    })();

    return [
      {
        id: prepId,
        title: preparationTitle,
        label: preparationTitle,
        deliverable: title,
        actionType: 'preparation',
        definitionOfDone: `${preparationTitle} is complete and ready for fundraising execution.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.35)),
        category: 'VENTURE_LAUNCH',
        dependencies: previousCompletionId ? [previousCompletionId] : [],
      },
      {
        id: completionId,
        title: completionTitle,
        label: completionTitle,
        deliverable: title,
        actionType: classifyCompletionActionType(completionTitle),
        definitionOfDone: `${title} is completed with visible fundraising evidence tied to the admitted goal.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.65)),
        category: 'VENTURE_LAUNCH',
        dependencies: [prepId],
      },
    ];
  });

  return {
    version: 'jericho_action_graph_v1',
    executionType,
    actions,
    templates: [
      {
        title: packagePrepMode ? 'Fundraising package preparation block' : 'Fundraising execution block',
        domain: 'Resources',
        durationMinutes: 45,
        frequency: 'daily',
        reason: packagePrepMode
          ? 'Keeps pitch, ask, investor materials, and package-readiness work tied to concrete fundraising outputs.'
          : 'Keeps thesis, investor pipeline, diligence, and close work tied to concrete fundraising outputs.',
      },
      {
        title: packagePrepMode ? 'Weekly fundraising package readiness review' : 'Weekly fundraising diligence review',
        domain: 'Focus',
        durationMinutes: 45,
        frequency: 'weekly',
        reason: packagePrepMode
          ? 'Checks package completeness, objection handling quality, and send readiness against the admitted raise target.'
          : 'Checks investor movement, diligence response quality, and close readiness against the admitted raise target.',
      },
    ],
    diagnostics: {
      actionCount: actions.length,
      totalEstimateMin: actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0),
      requiredWeeklyMinutes: Math.max(
        60,
        Math.round(actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0) / 6)
      ),
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 0,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for Fundraising goals derived from admitted contract deliverables.'],
    },
  };
}

function buildJobSearchPipelineGraph(goalDraftV2: unknown, contract: unknown, executionType: string) {
  const goalContract = ((contract || {}) as Record<string, unknown>) || {};
  const terminalOutcome = (goalContract?.terminalOutcome || {}) as Record<string, unknown>;

  const deliverables = generateAutoDeliverables({
    ...(goalContract as object),
    executionType,
    goalText: String(goalContract?.goalText || draftText(goalDraftV2)),
    terminalOutcome: {
      text: String(terminalOutcome?.text || draftText(goalDraftV2)),
      verificationCriteria: String(terminalOutcome?.verificationCriteria || ''),
    },
  } as any);

  const deriveJobSearchActionTitles = (deliverableTitle: string) => {
    const title = String(deliverableTitle || '').trim();
    const lower = title.toLowerCase();
    const objectTitle = title.replace(/^(define|audit|tailor|build|create|submit|prepare|run|log)\s+/i, '');

    let preparationTitle = /^define|^audit/.test(lower)
      ? `Capture targeting inputs, response gaps, and success criteria for ${objectTitle}`
      : /^run /.test(lower)
        ? `Prepare ${objectTitle}`
        : `Scope ${objectTitle}`;
    let completionTitle = /^(define|audit|tailor|build|create|submit|prepare|run|log)\s+/i.test(lower)
      ? title
      : `Complete ${objectTitle}`;

    if (lower.includes('target role family and search criteria')) {
      preparationTitle = `Capture role family targets, location filters, and search criteria for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('submitted applications, and response gaps')) {
      preparationTitle = `Capture submitted applications, interview signals, and response gaps for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('existing materials gaps')) {
      preparationTitle = `Capture target roles, resume strengths, and materials gaps for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('resume and portfolio for target roles')) {
      preparationTitle = `Prepare resume proof points, portfolio evidence, and tailoring rules for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('target company list and prioritization model')) {
      preparationTitle = `Prepare company targets, fit signals, and prioritization rules for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('application pipeline tracking and outreach workflow')) {
      preparationTitle = `Define tracker stages, outreach sequence, and follow-up rules for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('first tailored application batch')) {
      preparationTitle = `Prepare role-specific materials and submission checklist for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('interview story bank and answer framework')) {
      preparationTitle = `Prepare STAR stories, role examples, and answer framework for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('mock interviews and follow-up practice')) {
      preparationTitle = `Prepare mock questions, feedback rubric, and follow-up practice plan for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('responses and manage active interview stages')) {
      preparationTitle = `Prepare response tracker, interview stage updates, and follow-up decisions for ${objectTitle}`;
      completionTitle = title;
    }

    return { title, lower, preparationTitle, completionTitle };
  };

  const actions = deliverables.flatMap((deliverable, index) => {
    const { title, lower, preparationTitle, completionTitle } = deriveJobSearchActionTitles(
      String(deliverable.title || '')
    );
    const totalMinutes = Math.max(
      90,
      Number(deliverable.requiredBlocks || 1) * 60 +
        (lower.includes('interview') || lower.includes('application') || lower.includes('responses') ? 30 : 0)
    );
    const prepId = `job:${String(index * 2 + 1).padStart(3, '0')}:${compactSlugifyTitle(preparationTitle)}`;
    const completionId = `job:${String(index * 2 + 2).padStart(3, '0')}:${compactSlugifyTitle(completionTitle)}`;
    const previousCompletionId = (() => {
      if (index <= 0) return null;
      const previousTitles = deriveJobSearchActionTitles(String(deliverables[index - 1]?.title || ''));
      return `job:${String(index * 2).padStart(3, '0')}:${compactSlugifyTitle(previousTitles.completionTitle)}`;
    })();

    return [
      {
        id: prepId,
        title: preparationTitle,
        label: preparationTitle,
        deliverable: title,
        actionType: 'preparation',
        definitionOfDone: `${preparationTitle} is complete and ready for job-search execution.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.35)),
        category: 'VENTURE_LAUNCH',
        dependencies: previousCompletionId ? [previousCompletionId] : [],
      },
      {
        id: completionId,
        title: completionTitle,
        label: completionTitle,
        deliverable: title,
        actionType: classifyCompletionActionType(completionTitle),
        definitionOfDone: `${title} is completed with visible job-search evidence tied to the admitted goal.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.65)),
        category: 'VENTURE_LAUNCH',
        dependencies: [prepId],
      },
    ];
  });

  return {
    version: 'jericho_action_graph_v1',
    executionType,
    actions,
    templates: [
      {
        title: 'Job search execution block',
        domain: 'Resources',
        durationMinutes: 45,
        frequency: 'daily',
        reason:
          'Keeps role targeting, applications, outreach, and interview preparation tied to concrete job-search outputs.',
      },
      {
        title: 'Weekly pipeline review',
        domain: 'Focus',
        durationMinutes: 30,
        frequency: 'weekly',
        reason:
          'Checks response rate, interview movement, and next-step adjustments against the admitted search target.',
      },
    ],
    diagnostics: {
      actionCount: actions.length,
      totalEstimateMin: actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0),
      requiredWeeklyMinutes: Math.max(
        60,
        Math.round(actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0) / 6)
      ),
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 0,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for JobSearchPipeline goals derived from admitted contract deliverables.'],
    },
  };
}

function buildPodcastEpisodeGraph(goalDraftV2: unknown, contract: unknown, executionType: string) {
  const goalContract = ((contract || {}) as Record<string, unknown>) || {};
  const terminalOutcome = (goalContract?.terminalOutcome || {}) as Record<string, unknown>;
  const startDayKey =
    coerceDayKey(goalContract?.startDayKey) ||
    coerceDayKey(goalContract?.startDateISO) ||
    coerceDayKey(goalContract?.startDate) ||
    '2026-03-21';

  const autoResult = buildAutoDeliverablesFromGoalContract(
    {
      ...(goalContract as object),
      terminalOutcome: {
        text: String(terminalOutcome?.text || draftText(goalDraftV2)),
        verificationCriteria: String(terminalOutcome?.verificationCriteria || ''),
        isConcrete: terminalOutcome?.isConcrete !== false,
        hash: String(terminalOutcome?.hash || ''),
      },
      deadline: {
        ...(goalContract?.deadline as Record<string, unknown>),
        dayKey: String((goalContract?.deadline as Record<string, unknown>)?.dayKey || ''),
        isHardDeadline: true,
      },
    } as any,
    startDayKey,
    'UTC'
  );

  const deliverables = autoResult.deliverables;
  const actions = deliverables.map((deliverable, index) => {
    const lower = deliverable.title.toLowerCase();
    const estimateMin = lower.includes('record episode')
      ? 90
      : lower.includes('edit episode')
        ? 75
        : lower.includes('release')
          ? 60
          : 45;
    return {
      id: `podcast:${String(index + 1).padStart(3, '0')}:${slugifyTitle(deliverable.title)}`,
      title: deliverable.title,
      label: deliverable.title,
      deliverable: deliverable.title,
      actionType: classifyCompletionActionType(deliverable.title),
      definitionOfDone: `${deliverable.title} is completed and ready for the next production dependency.`,
      estimateMin,
      category: 'CREATIVE_PRODUCTION',
      dependencies:
        index > 0 ? [`podcast:${String(index).padStart(3, '0')}:${slugifyTitle(deliverables[index - 1].title)}`] : [],
    };
  });

  return {
    version: 'jericho_action_graph_v1',
    executionType,
    actions,
    templates: [
      {
        title: 'Episode production block',
        domain: 'Creation',
        durationMinutes: 60,
        frequency: 'daily',
        reason: 'Keeps recording and editing cadence attached to concrete episode outputs.',
      },
      {
        title: 'Weekly release readiness review',
        domain: 'Focus',
        durationMinutes: 30,
        frequency: 'weekly',
        reason: 'Checks episode progress against the release package and deadline.',
      },
    ],
    diagnostics: {
      actionCount: actions.length,
      totalEstimateMin: actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0),
      requiredWeeklyMinutes: Math.max(
        60,
        Math.round(actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0) / 6)
      ),
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 0,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for episodic podcast goals derived from admitted contract deliverables.'],
    },
  };
}

function buildSkillAcquisitionGraph(goalDraftV2: unknown, contract: unknown, executionType: string) {
  const goalContract = ((contract || {}) as Record<string, unknown>) || {};
  const terminalOutcome = (goalContract?.terminalOutcome || {}) as Record<string, unknown>;
  const startDayKey =
    coerceDayKey(goalContract?.startDayKey) ||
    coerceDayKey(goalContract?.startDateISO) ||
    coerceDayKey(goalContract?.startDate) ||
    '2026-03-21';

  const deliverables = generateAutoDeliverables({
    ...(goalContract as object),
    executionType,
    goalText: String(goalContract?.goalText || draftText(goalDraftV2)),
    terminalOutcome: {
      text: String(terminalOutcome?.text || draftText(goalDraftV2)),
      verificationCriteria: String(terminalOutcome?.verificationCriteria || ''),
    },
  } as any);

  const isSqlLane = /\bsql\b/.test(
    `${String(goalContract?.goalText || draftText(goalDraftV2))} ${String(terminalOutcome?.text || '')} ${String(
      terminalOutcome?.verificationCriteria || ''
    )}`.toLowerCase()
  );

  const deriveSkillActionTitles = (deliverableTitle: string) => {
    const title = String(deliverableTitle || '').trim();
    const lower = title.toLowerCase();
    const objectTitle = title.replace(/^(complete|produce|run|build|establish|audit|prepare|finalize|publish)\s+/i, '');
    const skillObjectTitle =
      objectTitle
        .replace(/\bfundamentals baseline and reference set\b/i, '')
        .replace(/\bguided exercises and drill set\b/i, '')
        .replace(/\bapplied project or case study\b/i, '')
        .replace(/\bportfolio demonstration and explanation package\b/i, '')
        .replace(/\breadiness drill and weak-skill remediation review\b/i, '')
        .replace(/\s+/g, ' ')
        .trim() || objectTitle;
    let preparationTitle = /^establish|^audit/.test(lower)
      ? `Define success criteria for ${objectTitle}`
      : /^run /.test(lower)
        ? `Prepare ${objectTitle}`
        : `Scope ${objectTitle}`;
    let completionTitle = /^complete|^produce|^run|^build|^establish|^audit|^prepare|^finalize|^publish/.test(lower)
      ? title
      : `Complete ${objectTitle}`;

    if (isSqlLane) {
      if (lower.includes('fundamentals query practice baseline')) {
        preparationTitle = 'Set up SQL practice database and baseline query checklist';
        completionTitle = 'Write SELECT, WHERE, ORDER BY, and aggregate practice queries';
      } else if (lower.includes('relational schema and data import project')) {
        preparationTitle = 'Define schema, tables, and import checks for relational dataset project';
        completionTitle = 'Import CSV tables and complete relational schema SQL project';
      } else if (lower.includes('business analysis query case study')) {
        preparationTitle = 'Scope business questions and JOIN-based query plan for SQL case study';
        completionTitle = 'Answer business questions with JOIN and GROUP BY SQL case study';
      } else if (lower.includes('advanced reporting and window function project')) {
        preparationTitle = 'Design advanced reporting metrics with CTE and window function approach';
        completionTitle = 'Build advanced SQL reporting project with CTEs and window functions';
      } else if (lower.includes('github portfolio and query explanation package')) {
        preparationTitle = 'Prepare README structure and query explanation outline for SQL portfolio';
        completionTitle = 'Publish GitHub SQL portfolio package with query walkthroughs';
      } else if (lower.includes('sql interview drill and readiness review')) {
        preparationTitle = 'Prepare timed SQL interview drills and project walkthrough prompts';
        completionTitle = 'Run SQL interview drills and explain project decisions aloud';
      }
    } else if (lower.includes('fundamentals baseline and reference set')) {
      preparationTitle = `Define ${skillObjectTitle} baseline, learning targets, and reference checklist`;
      completionTitle = `Build ${skillObjectTitle} fundamentals notes and baseline practice set`;
    } else if (lower.includes('guided exercises and drill set')) {
      preparationTitle = `Prepare ${skillObjectTitle} exercise list, worked examples, and drill checklist`;
      completionTitle = `Complete ${skillObjectTitle} guided exercises and drill set`;
    } else if (lower.includes('applied project or case study')) {
      preparationTitle = `Scope ${skillObjectTitle} project brief, success criteria, and example output`;
      completionTitle = `Complete ${skillObjectTitle} applied project or case study`;
    } else if (lower.includes('portfolio demonstration and explanation package')) {
      preparationTitle = `Prepare ${skillObjectTitle} demo walkthrough and explanation outline`;
      completionTitle = `Publish ${skillObjectTitle} portfolio demonstration and explanation package`;
    } else if (lower.includes('readiness drill and weak-skill remediation review')) {
      preparationTitle = `Prepare ${skillObjectTitle} readiness drills and weak-skill remediation plan`;
      completionTitle = `Run ${skillObjectTitle} readiness drill and remediate weak skill gaps`;
    }

    return { title, lower, preparationTitle, completionTitle };
  };

  const actions = deliverables.flatMap((deliverable, index) => {
    const { title, lower, preparationTitle, completionTitle } = deriveSkillActionTitles(
      String(deliverable.title || '')
    );
    const totalMinutes = Math.max(
      90,
      Number(deliverable.requiredBlocks || 1) * 60 +
        (lower.includes('project') || lower.includes('proof artifact') ? 30 : 0)
    );
    const prepId = `skill:${String(index * 2 + 1).padStart(3, '0')}:${slugifyTitle(preparationTitle)}`;
    const completionId = `skill:${String(index * 2 + 2).padStart(3, '0')}:${slugifyTitle(completionTitle)}`;
    const previousCompletionId = (() => {
      if (index <= 0) return null;
      const previousTitles = deriveSkillActionTitles(String(deliverables[index - 1]?.title || ''));
      return `skill:${String(index * 2).padStart(3, '0')}:${slugifyTitle(previousTitles.completionTitle)}`;
    })();
    return [
      {
        id: prepId,
        title: preparationTitle,
        label: preparationTitle,
        deliverable: title,
        actionType: 'preparation',
        definitionOfDone: `${preparationTitle} is complete and ready for execution.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.35)),
        category: 'SKILL_ACQUISITION',
        dependencies: previousCompletionId ? [previousCompletionId] : [],
      },
      {
        id: completionId,
        title: completionTitle,
        label: completionTitle,
        deliverable: title,
        actionType: classifyCompletionActionType(completionTitle),
        definitionOfDone: `${title} is completed with visible proof tied to the goal object.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.65)),
        category: 'SKILL_ACQUISITION',
        dependencies: [prepId],
      },
    ];
  });

  return {
    version: 'jericho_action_graph_v1',
    executionType,
    actions,
    templates: [
      {
        title: 'Goal-object practice block',
        domain: 'Focus',
        durationMinutes: 45,
        frequency: 'daily',
        reason:
          'Keeps learning tied to the concrete object, exercise set, or project output rather than generic study.',
      },
      {
        title: 'Weekly skill proof review',
        domain: 'Focus',
        durationMinutes: 30,
        frequency: 'weekly',
        reason: 'Checks concrete exercises, projects, and proof outputs against the admitted definition of done.',
      },
    ],
    diagnostics: {
      actionCount: actions.length,
      totalEstimateMin: actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0),
      requiredWeeklyMinutes: Math.max(
        60,
        Math.round(actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0) / 6)
      ),
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 0,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for SkillAcquisition goals derived from admitted contract deliverables.'],
    },
  };
}

function buildProfessionalQualificationGraph(goalDraftV2: unknown, contract: unknown, executionType: string) {
  const goalContract = ((contract || {}) as Record<string, unknown>) || {};
  const terminalOutcome = (goalContract?.terminalOutcome || {}) as Record<string, unknown>;

  const deliverables = generateAutoDeliverables({
    ...(goalContract as object),
    executionType,
    goalText: String(goalContract?.goalText || draftText(goalDraftV2)),
    terminalOutcome: {
      text: String(terminalOutcome?.text || draftText(goalDraftV2)),
      verificationCriteria: String(terminalOutcome?.verificationCriteria || ''),
    },
  } as any);

  const deriveQualificationActionTitles = (deliverableTitle: string) => {
    const title = String(deliverableTitle || '').trim();
    const lower = title.toLowerCase();
    const objectTitle = title.replace(/^(verify|audit|build|complete|compile|run)\s+/i, '');
    const qualificationStem = objectTitle
      .replace(
        /\s+(requirements, eligibility, and exam boundary|requirements, eligibility, and scheduling gaps|domain coverage map and study note set|question bank and timed mock exam set|weak-domain remediation log and cheat sheet|readiness review and credential-day checklist)$/i,
        ''
      )
      .trim();
    let preparationTitle = /^verify|^audit/.test(lower)
      ? `Capture requirements and pass criteria for ${objectTitle}`
      : /^run /.test(lower)
        ? `Prepare ${objectTitle}`
        : `Scope ${objectTitle}`;
    let completionTitle = /^verify|^audit|^build|^complete|^compile|^run/.test(lower)
      ? title
      : `Complete ${objectTitle}`;

    if (lower.includes('requirements, eligibility, and exam boundary')) {
      preparationTitle = `Capture ${qualificationStem} eligibility rules, scoring policy, and exam-day constraints`;
      completionTitle = title;
    } else if (lower.includes('requirements, eligibility, and scheduling gaps')) {
      preparationTitle = `Review ${qualificationStem} eligibility rules and outstanding scheduling gaps`;
      completionTitle = title;
    } else if (lower.includes('domain coverage map and study note set')) {
      preparationTitle = `Map ${qualificationStem} core domains, weak areas, and scoring priorities`;
      completionTitle = `Build ${qualificationStem} study notes, flashcards, and review set`;
    } else if (lower.includes('question bank and timed mock exam set')) {
      preparationTitle = `Assemble ${qualificationStem} question bank, timer rules, and error log`;
      completionTitle = `Complete ${qualificationStem} timed mock exam set and review misses`;
    } else if (lower.includes('weak-domain remediation log and cheat sheet')) {
      preparationTitle = `Identify ${qualificationStem} weak domains and remediation targets`;
      completionTitle = title;
    } else if (lower.includes('readiness review and credential-day checklist')) {
      preparationTitle = `Prepare ${qualificationStem} readiness criteria, logistics, and final drill prompts`;
      completionTitle = title;
    }

    return { title, lower, preparationTitle, completionTitle };
  };

  const actions = deliverables.flatMap((deliverable, index) => {
    const { title, lower, preparationTitle, completionTitle } = deriveQualificationActionTitles(
      String(deliverable.title || '')
    );
    const totalMinutes = Math.max(
      90,
      Number(deliverable.requiredBlocks || 1) * 60 +
        (lower.includes('mock exam') || lower.includes('readiness review') ? 30 : 0)
    );
    const prepId = `qual:${String(index * 2 + 1).padStart(3, '0')}:${compactSlugifyTitle(preparationTitle)}`;
    const completionId = `qual:${String(index * 2 + 2).padStart(3, '0')}:${compactSlugifyTitle(completionTitle)}`;
    const previousCompletionId = (() => {
      if (index <= 0) return null;
      const previousTitles = deriveQualificationActionTitles(String(deliverables[index - 1]?.title || ''));
      return `qual:${String(index * 2).padStart(3, '0')}:${compactSlugifyTitle(previousTitles.completionTitle)}`;
    })();
    return [
      {
        id: prepId,
        title: preparationTitle,
        label: preparationTitle,
        deliverable: title,
        actionType: 'preparation',
        definitionOfDone: `${preparationTitle} is complete and ready for timed qualification work.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.35)),
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: previousCompletionId ? [previousCompletionId] : [],
      },
      {
        id: completionId,
        title: completionTitle,
        label: completionTitle,
        deliverable: title,
        actionType: classifyCompletionActionType(completionTitle),
        definitionOfDone: `${title} is completed with visible qualification evidence tied to the credential goal.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.65)),
        category: 'PROFESSIONAL_QUALIFICATION',
        dependencies: [prepId],
      },
    ];
  });

  return {
    version: 'jericho_action_graph_v1',
    executionType,
    actions,
    templates: [
      {
        title: 'Qualification domain review block',
        domain: 'Focus',
        durationMinutes: 45,
        frequency: 'daily',
        reason: 'Keeps study work tied to the actual credential object, weak domains, and proof requirements.',
      },
      {
        title: 'Timed mock and remediation checkpoint',
        domain: 'Focus',
        durationMinutes: 30,
        frequency: 'weekly',
        reason: 'Verifies timed readiness and weak-domain remediation against the admitted qualification target.',
      },
    ],
    diagnostics: {
      actionCount: actions.length,
      totalEstimateMin: actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0),
      requiredWeeklyMinutes: Math.max(
        60,
        Math.round(actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0) / 6)
      ),
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 0,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for ProfessionalQualification goals derived from admitted contract deliverables.'],
    },
  };
}

function buildPhysicalTrainingGraph(goalDraftV2: unknown, contract: unknown, executionType: string) {
  const goalContract = ((contract || {}) as Record<string, unknown>) || {};
  const terminalOutcome = (goalContract?.terminalOutcome || {}) as Record<string, unknown>;

  const deliverables = generateAutoDeliverables({
    ...(goalContract as object),
    executionType,
    goalText: String(goalContract?.goalText || draftText(goalDraftV2)),
    terminalOutcome: {
      text: String(terminalOutcome?.text || draftText(goalDraftV2)),
      verificationCriteria: String(terminalOutcome?.verificationCriteria || ''),
    },
  } as any);

  const derivePhysicalActionTitles = (deliverableTitle: string) => {
    const title = String(deliverableTitle || '').trim();
    const lower = title.toLowerCase();
    const objectTitle = title.replace(/^(assess|audit|establish|build|complete|run)\s+/i, '');

    let preparationTitle = /^assess|^audit|^establish/.test(lower)
      ? `Capture baseline metrics and constraints for ${objectTitle}`
      : /^run /.test(lower)
        ? `Prepare ${objectTitle}`
        : `Scope ${objectTitle}`;
    let completionTitle = /^(assess|audit|establish|build|complete|run)\s+/i.test(lower)
      ? title
      : `Complete ${objectTitle}`;

    if (lower.includes('baseline run benchmark and pacing profile')) {
      preparationTitle = `Capture baseline run benchmark, pacing splits, and recovery limits for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('baseline lift benchmark and load profile')) {
      preparationTitle = `Capture lift benchmark, load tolerance, and movement quality for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('body composition baseline and calorie/protein targets')) {
      preparationTitle = `Capture body composition baseline, calorie target, and protein target for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('baseline benchmark and recovery profile')) {
      preparationTitle = `Capture benchmark metrics, recovery profile, and training constraints for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('recovery baseline and load tolerance')) {
      preparationTitle = `Capture pain triggers, tolerated load, and recovery constraints for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('periodized strength progression and load structure')) {
      preparationTitle = `Map lifting split, volume targets, and load progression for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('periodized endurance structure and pacing plan')) {
      preparationTitle = `Map weekly endurance blocks, long-run pacing, and recovery cadence for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('weekly conditioning and strength sessions')) {
      preparationTitle = `Plan weekly conditioning sessions, strength sessions, and progression targets for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('nutrition adherence and weigh-in tracking block')) {
      preparationTitle = `Set daily nutrition adherence rules, weigh-in cadence, and tracking prompts for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('periodized training structure and load progression')) {
      preparationTitle = `Map weekly training blocks, load progression, and recovery cadence for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('return-to-training blocks and recovery checkpoints')) {
      preparationTitle = `Prepare return-to-training session sequence, checkpoint criteria, and pain-monitoring rules for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('training block with recovery checkpoints')) {
      preparationTitle = `Prepare training block sequence, recovery checkpoints, and adherence targets for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('benchmark re-test and pacing review')) {
      preparationTitle = `Prepare benchmark re-test protocol, pacing comparison, and adjustment notes for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('benchmark re-test and readiness review')) {
      preparationTitle = `Prepare benchmark re-test protocol, readiness criteria, and next-cycle review for ${objectTitle}`;
      completionTitle = title;
    }

    let reviewTitle = `Review ${objectTitle}`;

    if (lower.includes('baseline run benchmark and pacing profile')) {
      reviewTitle = `Review baseline run benchmark data and pacing limits for ${objectTitle}`;
    } else if (lower.includes('baseline lift benchmark and load profile')) {
      reviewTitle = `Review lift benchmark data and load limits for ${objectTitle}`;
    } else if (lower.includes('body composition baseline and calorie/protein targets')) {
      reviewTitle = `Review body composition baseline and calorie/protein targets for ${objectTitle}`;
    } else if (lower.includes('baseline benchmark and recovery profile')) {
      reviewTitle = `Review baseline benchmark data and recovery limits for ${objectTitle}`;
    } else if (lower.includes('recovery baseline and load tolerance')) {
      reviewTitle = `Review recovery baseline and tolerated load markers for ${objectTitle}`;
    } else if (lower.includes('periodized strength progression and load structure')) {
      reviewTitle = `Review strength progression metrics and recovery response for ${objectTitle}`;
    } else if (lower.includes('periodized endurance structure and pacing plan')) {
      reviewTitle = `Review endurance progression metrics and pacing response for ${objectTitle}`;
    } else if (lower.includes('weekly conditioning and strength sessions')) {
      reviewTitle = `Review conditioning volume, strength adherence, and recovery response for ${objectTitle}`;
    } else if (lower.includes('nutrition adherence and weigh-in tracking block')) {
      reviewTitle = `Review weigh-in trend, nutrition adherence, and adjustment signals for ${objectTitle}`;
    } else if (lower.includes('periodized training structure and load progression')) {
      reviewTitle = `Review training progression metrics and recovery response for ${objectTitle}`;
    } else if (lower.includes('return-to-training blocks and recovery checkpoints')) {
      reviewTitle = `Review pain response and recovery checkpoints for ${objectTitle}`;
    } else if (lower.includes('training block with recovery checkpoints')) {
      reviewTitle = `Review training block adherence and recovery checkpoints for ${objectTitle}`;
    } else if (lower.includes('benchmark re-test and pacing review')) {
      reviewTitle = `Review benchmark re-test results and pacing adjustments for ${objectTitle}`;
    } else if (lower.includes('benchmark re-test and readiness review')) {
      reviewTitle = `Review benchmark re-test results and readiness decision for ${objectTitle}`;
    }

    return { title, lower, preparationTitle, completionTitle, reviewTitle };
  };

  const actions = deliverables.flatMap((deliverable, index) => {
    const { title, lower, preparationTitle, completionTitle, reviewTitle } = derivePhysicalActionTitles(
      String(deliverable.title || '')
    );
    const totalMinutes = Math.max(
      90,
      Number(deliverable.requiredBlocks || 1) * 60 +
        (lower.includes('progression') || lower.includes('training block') ? 30 : 0)
    );
    const prepId = `physical:${String(index * 3 + 1).padStart(3, '0')}:${compactSlugifyTitle(preparationTitle)}`;
    const completionId = `physical:${String(index * 3 + 2).padStart(3, '0')}:${compactSlugifyTitle(completionTitle)}`;
    const reviewId = `physical:${String(index * 3 + 3).padStart(3, '0')}:${compactSlugifyTitle(reviewTitle)}`;
    const previousCompletionId = (() => {
      if (index <= 0) return null;
      const previousTitles = derivePhysicalActionTitles(String(deliverables[index - 1]?.title || ''));
      return `physical:${String(index * 3).padStart(3, '0')}:${compactSlugifyTitle(previousTitles.reviewTitle)}`;
    })();

    return [
      {
        id: prepId,
        title: preparationTitle,
        label: preparationTitle,
        deliverable: title,
        actionType: 'preparation',
        definitionOfDone: `${preparationTitle} is complete and ready for physical execution.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.35)),
        category: 'PHYSICAL_TRAINING',
        dependencies: previousCompletionId ? [previousCompletionId] : [],
      },
      {
        id: completionId,
        title: completionTitle,
        label: completionTitle,
        deliverable: title,
        actionType: classifyCompletionActionType(completionTitle),
        definitionOfDone: `${title} is completed with visible training evidence tied to the admitted goal.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.45)),
        category: 'PHYSICAL_TRAINING',
        dependencies: [prepId],
      },
      {
        id: reviewId,
        title: reviewTitle,
        label: reviewTitle,
        deliverable: title,
        actionType: 'preparation',
        definitionOfDone: `${reviewTitle} is complete and recorded for the next physical decision point.`,
        estimateMin: Math.max(30, Math.round(totalMinutes * 0.2)),
        category: 'PHYSICAL_TRAINING',
        dependencies: [completionId],
      },
    ];
  });

  return {
    version: 'jericho_action_graph_v1',
    executionType,
    actions,
    templates: [
      {
        title: 'Physical training block',
        domain: 'Body',
        durationMinutes: 45,
        frequency: 'daily',
        reason: 'Keeps training work tied to specific benchmark, progression, and recovery outputs.',
      },
      {
        title: 'Weekly recovery and benchmark review',
        domain: 'Body',
        durationMinutes: 30,
        frequency: 'weekly',
        reason: 'Checks recovery signals and benchmark progress against the admitted physical target.',
      },
    ],
    diagnostics: {
      actionCount: actions.length,
      totalEstimateMin: actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0),
      requiredWeeklyMinutes: Math.max(
        60,
        Math.round(actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0) / 6)
      ),
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 0,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for PhysicalTraining goals derived from admitted contract deliverables.'],
    },
  };
}

function buildCreativeProductionGraph(goalDraftV2: unknown, contract: unknown, executionType: string) {
  const goalContract = ((contract || {}) as Record<string, unknown>) || {};
  const terminalOutcome = (goalContract?.terminalOutcome || {}) as Record<string, unknown>;
  const startDayKey =
    coerceDayKey(goalContract?.startDayKey) ||
    coerceDayKey(goalContract?.startDateISO) ||
    coerceDayKey(goalContract?.startDate) ||
    '2026-03-21';

  const autoResult = buildAutoDeliverablesFromGoalContract(
    {
      ...(goalContract as object),
      terminalOutcome: {
        text: String(terminalOutcome?.text || draftText(goalDraftV2)),
        verificationCriteria: String(terminalOutcome?.verificationCriteria || ''),
        isConcrete: terminalOutcome?.isConcrete !== false,
        hash: String(terminalOutcome?.hash || ''),
      },
      deadline: {
        ...(goalContract?.deadline as Record<string, unknown>),
        dayKey: String((goalContract?.deadline as Record<string, unknown>)?.dayKey || ''),
        isHardDeadline: true,
      },
    } as any,
    startDayKey,
    'UTC'
  );

  const deliverables = autoResult.deliverables;

  const deriveCreativeActionTitles = (deliverableTitle: string) => {
    const title = String(deliverableTitle || '').trim();
    const lower = title.toLowerCase();
    const objectTitle = title.replace(
      /^(define|audit|build|produce|complete|prepare|run|finalize|draft|revise)\s+/i,
      ''
    );
    let preparationTitle = /^define|^audit/.test(lower)
      ? `Capture concept brief and success criteria for ${objectTitle}`
      : /^run /.test(lower)
        ? `Prepare ${objectTitle}`
        : `Scope ${objectTitle}`;
    let completionTitle = /^define|^audit|^build|^produce|^complete|^prepare|^run|^finalize|^draft|^revise/.test(lower)
      ? title
      : `Complete ${objectTitle}`;

    if (lower.includes('concept, outline, and audience brief')) {
      preparationTitle = `Capture audience, narrative direction, and success criteria for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('shot plan, production checklist, and asset list')) {
      preparationTitle = `Map scenes, required assets, and production checklist for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('first cut and rough edit')) {
      preparationTitle = `Assemble footage, story beats, and rough sequence for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('final edit, sound polish, and graphics')) {
      preparationTitle = `Review edit notes, sound fixes, and graphics requirements for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('release package and publication checklist')) {
      preparationTitle = `Prepare metadata, release assets, and publication steps for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('outline, chapter map, and reader promise')) {
      preparationTitle = `Capture chapter arc, reader promise, and section order for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('core sections and writing cadence')) {
      preparationTitle = `Map writing cadence, section targets, and draft checkpoints for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('structure, clarity, and continuity')) {
      preparationTitle = `Review structure notes and continuity gaps across ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('proofread pass and submission package')) {
      preparationTitle = `Prepare proofread checklist, submission assets, and final formatting for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('publication review and final checklist')) {
      preparationTitle = `Prepare publication steps, metadata, and final quality checklist for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('music release concept, tracklist, and audience direction')) {
      preparationTitle = 'Capture tracklist, audience direction, and release concept for music release';
      completionTitle = title;
    } else if (lower.includes('tracked recordings for all songs')) {
      preparationTitle = 'Organize recording targets, session structure, and revision priorities for music release';
      completionTitle = title;
    } else if (lower.includes('mix, master, and sequencing pass')) {
      preparationTitle = 'Review mix notes, mastering targets, and sequence order for music release';
      completionTitle = title;
    } else if (lower.includes('artwork, metadata, and distribution package')) {
      preparationTitle = 'Prepare artwork specs, metadata, and distributor checklist for music release';
      completionTitle = title;
    } else if (lower.includes('music release readiness review and launch checklist')) {
      preparationTitle = 'Prepare launch checklist, release-day checks, and final review prompts for music release';
      completionTitle = title;
    } else if (lower.includes('concept, audience, and success criteria')) {
      preparationTitle = `Capture audience, concept, and proof standard for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('outline, workflow, and production checklist')) {
      preparationTitle = `Map workflow, dependencies, and production checklist for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('first draft or working cut')) {
      preparationTitle = `Prepare draft plan and session targets for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('revision and technical polish')) {
      preparationTitle = `Review revision notes and polish criteria for ${objectTitle}`;
      completionTitle = title;
    } else if (lower.includes('release package and review checklist')) {
      preparationTitle = `Prepare release assets and final checklist for ${objectTitle}`;
      completionTitle = title;
    }

    return { title, lower, preparationTitle, completionTitle };
  };

  const actions = deliverables.flatMap((deliverable, index) => {
    const { title, lower, preparationTitle, completionTitle } = deriveCreativeActionTitles(
      String(deliverable.title || '')
    );
    const totalMinutes = Math.max(
      90,
      Number(deliverable.requiredBlocks || 1) * 60 +
        (lower.includes('release package') || lower.includes('review') ? 30 : 0)
    );
    const prepId = `creative:${String(index * 2 + 1).padStart(3, '0')}:${compactSlugifyTitle(preparationTitle)}`;
    const completionId = `creative:${String(index * 2 + 2).padStart(3, '0')}:${compactSlugifyTitle(completionTitle)}`;
    const previousCompletionId = (() => {
      if (index <= 0) return null;
      const previousTitles = deriveCreativeActionTitles(String(deliverables[index - 1]?.title || ''));
      return `creative:${String(index * 2).padStart(3, '0')}:${compactSlugifyTitle(previousTitles.completionTitle)}`;
    })();
    return [
      {
        id: prepId,
        title: preparationTitle,
        label: preparationTitle,
        deliverable: title,
        actionType: 'preparation',
        definitionOfDone: `${preparationTitle} is complete and ready for creative execution.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.35)),
        category: 'CREATIVE_PRODUCTION',
        dependencies: previousCompletionId ? [previousCompletionId] : [],
      },
      {
        id: completionId,
        title: completionTitle,
        label: completionTitle,
        deliverable: title,
        actionType: classifyCompletionActionType(completionTitle),
        definitionOfDone: `${title} is completed with visible creative output tied to the admitted goal.`,
        estimateMin: Math.max(45, Math.round(totalMinutes * 0.65)),
        category: 'CREATIVE_PRODUCTION',
        dependencies: [prepId],
      },
    ];
  });

  return {
    version: 'jericho_action_graph_v1',
    executionType,
    actions,
    templates: [
      {
        title: 'Creative production block',
        domain: 'Creation',
        durationMinutes: 60,
        frequency: 'daily',
        reason: 'Keeps creative sessions attached to a concrete asset, draft, or release output.',
      },
      {
        title: 'Creative review checkpoint',
        domain: 'Focus',
        durationMinutes: 30,
        frequency: 'weekly',
        reason: 'Verifies that draft, polish, and release work stay tied to visible output quality.',
      },
    ],
    diagnostics: {
      actionCount: actions.length,
      totalEstimateMin: actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0),
      requiredWeeklyMinutes: Math.max(
        60,
        Math.round(actions.reduce((sum, action) => sum + Number(action.estimateMin || 0), 0) / 6)
      ),
      weeklyCapMinutes: 300,
      weeklyGapMinutes: 0,
      reasonCodes: ['ON_TRACK'],
      notes: ['Mock graph for CreativeProduction. Derived from admitted contract deliverables.'],
    },
  };
}

function draftText(goalDraftV2: unknown) {
  const draft = (goalDraftV2 || {}) as Record<string, unknown>;
  return String(draft?.goalText || draft?.goalLabel || '');
}

function slugifyTitle(value: string) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function compactSlugifyTitle(value: string, maxLength = 72) {
  return slugifyTitle(value).slice(0, maxLength).replace(/-+$/g, '');
}

function classifyCompletionActionType(title: string) {
  const lower = String(title || '')
    .trim()
    .toLowerCase();
  if (!lower) {
    return 'execution' as const;
  }

  if (
    /^(verify|audit|define|prepare|review|capture|map|scope|clarify|set)\b/.test(lower) ||
    /\b(readiness|checklist|logistics|eligibility|boundary|criteria|protocol|baseline|fit scoring|scoring policy)\b/.test(
      lower
    )
  ) {
    return 'preparation' as const;
  }

  return 'execution' as const;
}

// ---------------------------------------------------------------------------
// Drop-in replacement for callClaudeForActionGraph
// ---------------------------------------------------------------------------

export async function callClaudeForActionGraph(
  goalDraftV2: unknown,
  contract: unknown,
  executionType: string,
  _apiKey: string
): Promise<ActionGraphResult> {
  // Simulate network latency so loading states render correctly
  await new Promise((resolve) => setTimeout(resolve, 25));

  const shouldUseTvWritingGraph =
    isTvWritingGoal(goalDraftV2, contract) &&
    (executionType === 'GenericStructured' || executionType === 'CreativeProduction');
  const shouldUsePodcastEpisodeGraph =
    executionType === 'CreativeProduction' && isEpisodicPodcastGoal(goalDraftV2, contract);
  const shouldUseCreativeProductionGraph =
    executionType === 'CreativeProduction' && !shouldUseTvWritingGraph && !shouldUsePodcastEpisodeGraph;
  const shouldUseSkillAcquisitionGraph = executionType === 'SkillAcquisition';
  const shouldUseProfessionalQualificationGraph = executionType === 'ProfessionalQualification';
  const shouldUsePhysicalTrainingGraph = executionType === 'PhysicalTraining';
  const shouldUseVentureLaunchGraph = executionType === 'VentureLaunch';
  const shouldUseBrandLaunchGraph = executionType === 'BrandLaunch';
  const shouldUseJobSearchPipelineGraph = executionType === 'JobSearchPipeline';
  const shouldUseSalesPipelineGraph = executionType === 'SalesPipeline';
  const shouldUseFundraisingGraph = executionType === 'Fundraising';
  const mockGraph = shouldUseTvWritingGraph
    ? {
        ...TV_GENERIC_STRUCTURED_GRAPH,
        executionType,
      }
    : shouldUsePodcastEpisodeGraph
      ? buildPodcastEpisodeGraph(goalDraftV2, contract, executionType)
      : shouldUseCreativeProductionGraph
        ? buildCreativeProductionGraph(goalDraftV2, contract, executionType)
        : shouldUseSkillAcquisitionGraph
          ? buildSkillAcquisitionGraph(goalDraftV2, contract, executionType)
          : shouldUseProfessionalQualificationGraph
            ? buildProfessionalQualificationGraph(goalDraftV2, contract, executionType)
            : shouldUsePhysicalTrainingGraph
              ? buildPhysicalTrainingGraph(goalDraftV2, contract, executionType)
              : shouldUseVentureLaunchGraph
                ? buildVentureLaunchGraph(goalDraftV2, contract, executionType)
                : shouldUseBrandLaunchGraph
                  ? buildBrandLaunchGraph(goalDraftV2, contract, executionType)
                  : shouldUseJobSearchPipelineGraph
                    ? buildJobSearchPipelineGraph(goalDraftV2, contract, executionType)
                    : shouldUseSalesPipelineGraph
                      ? buildSalesPipelineGraph(goalDraftV2, contract, executionType)
                      : shouldUseFundraisingGraph
                        ? buildFundraisingGraph(goalDraftV2, contract, executionType)
                        : MOCK_GRAPHS[executionType];

  if (!mockGraph) {
    return {
      ok: false,
      error: {
        code: 'MOCK_NO_GRAPH',
        reason: `No mock graph defined for executionType "${executionType}". Add one to MOCK_GRAPHS.`,
        reasonCodes: ['MOCK_NO_GRAPH'],
      },
    };
  }

  // Run through the real parser and validator — this exercises the full pipeline
  return parseLLMActionGraph(JSON.stringify(mockGraph), executionType);
}

export async function callClaudeForSessionPlan(
  payload: {
    goalDraftV2: unknown;
    contract: unknown;
    executionType: string;
    actions: Array<{
      id?: string;
      estimateMin?: number;
      title?: string;
      deliverableId?: string | null;
      dependencies?: string[];
      phaseHint?: 'early' | 'mid' | 'late';
      commercialCycleIndex?: number;
      commercialCycleCount?: number;
      sessionTitles?: string[];
      minimumDurationBusinessDays?: number;
      requiredWorkFamily?: string;
    }>;
    cycleId?: string | null;
    nowISO?: string;
    planningIntake?: Partial<StructuredPlanningIntake> | null;
  },
  _apiKey: string
) {
  await new Promise((resolve) => setTimeout(resolve, 25));
  const contract = (payload?.contract || {}) as Record<string, unknown>;
  const temporalBinding = (contract?.temporalBinding || {}) as Record<string, unknown>;
  const goalExecutionContract = (contract?.goalExecutionContract || {}) as Record<string, unknown>;
  const goalExecutionTemporalBinding = (goalExecutionContract?.temporalBinding || {}) as Record<string, unknown>;
  const startDayKey =
    coerceDayKey(contract?.startDayKey) ||
    coerceDayKey(contract?.startDateISO) ||
    coerceDayKey(contract?.startDate) ||
    coerceDayKey(temporalBinding?.startDayKey) ||
    coerceDayKey(goalExecutionContract?.startDayKey) ||
    coerceDayKey(goalExecutionTemporalBinding?.startDayKey) ||
    coerceDayKey(payload?.nowISO) ||
    '';
  const endDayKey =
    coerceDayKey((contract?.deadline as Record<string, unknown>)?.dayKey) ||
    coerceDayKey(contract?.endDayKey) ||
    coerceDayKey(contract?.deadlineISO) ||
    coerceDayKey(contract?.deadline) ||
    '';
  const actions = Array.isArray(payload?.actions) ? payload.actions : [];

  // Derive scheduling density from planningIntake.weeklyHoursAvailable and executionContext.
  // Conservative defaults apply when intake is missing (pre-intake-reform plans).
  const planningIntake = payload?.planningIntake || null;
  const weeklyHoursAvailable = Number.isFinite(Number(planningIntake?.weeklyHoursAvailable))
    ? Number(planningIntake?.weeklyHoursAvailable)
    : 7;
  const executionContext = String(planningIntake?.executionContext || 'part_time');
  const avgSessionDurationHours = 1.0;
  const rawSessionsPerWeek = Math.floor(weeklyHoursAvailable / avgSessionDurationHours);
  const contextMultiplier = executionContext === 'full_time' ? 1.0 : 0.8;
  const maxDailySessionCap = 3;
  const computedSessionsPerWeek = Math.max(1, Math.floor(rawSessionsPerWeek * contextMultiplier));
  const maxSessionsPerWeek =
    weeklyHoursAvailable >= 15
      ? Math.min(computedSessionsPerWeek, maxDailySessionCap * 5)
      : computedSessionsPerWeek;

  // Build a set of blackout day keys to exclude from scheduling.
  const blackoutDays = new Set<string>();
  const blackoutPeriods = Array.isArray(planningIntake?.blackoutPeriods) ? planningIntake.blackoutPeriods : [];
  blackoutPeriods.forEach((period) => {
    const periodStart = String(period?.start || '').trim().slice(0, 10);
    const periodEnd = String(period?.end || '').trim().slice(0, 10);
    if (!periodStart || !periodEnd) return;
    const cursor = new Date(`${periodStart}T12:00:00.000Z`);
    const endDate = new Date(`${periodEnd}T12:00:00.000Z`);
    while (cursor <= endDate) {
      blackoutDays.add(cursor.toISOString().slice(0, 10));
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }
  });

  const baseSessionMinutes = 60;
  const sessionSpecs = actions.flatMap((action, actionIndex) => {
    const actionId = String(action?.id || `act-${actionIndex + 1}`);
    const deliverableId = String(action?.deliverableId || `deliv-${actionIndex + 1}`);
    const estimateMin = Number(action?.estimateMin);
    const totalMinutes = Number.isFinite(estimateMin) && estimateMin > 0 ? estimateMin : baseSessionMinutes;
    const sessionCount = Math.max(1, Math.ceil(totalMinutes / baseSessionMinutes));
    let remaining = totalMinutes;
    return Array.from({ length: sessionCount }).map((_, sessionIdx) => {
      const isLast = sessionIdx === sessionCount - 1;
      const durationMinutes = isLast ? Math.max(15, remaining) : Math.max(15, baseSessionMinutes);
      const sessionTitles = Array.isArray(action?.sessionTitles) ? action.sessionTitles : [];
      remaining = Math.max(0, remaining - durationMinutes);
      return {
        actionId,
        deliverableId,
        title: String(sessionTitles[sessionIdx] || action?.title || 'Execution session'),
        durationMinutes,
        sessionIdx,
        sessionCount,
        ...(action?.phaseHint ? { phaseHint: action.phaseHint } : {}),
        ...(action?.commercialCycleIndex !== undefined ? { commercialCycleIndex: action.commercialCycleIndex } : {}),
        ...(action?.commercialCycleCount !== undefined ? { commercialCycleCount: action.commercialCycleCount } : {}),
      };
    });
  });

  // For commercial launches, schedule sessions by action clusters (temporal coherence).
  // For other types, flatten and distribute evenly (existing behavior).
  const isCommercialLaunch =
    (payload.executionType === 'BrandLaunch' ||
      /commercial|product.*launch|brand.*launch/i.test(String(payload?.contract?.goalText || ''))) &&
    actions.some((action) =>
      /brand:\d+:\d+:|brand-cycle|gum|offer|checkout|first[-\s]?sales|first[-\s]?buyer|purchase path|sourcing|packaging/i.test(
        `${String(action?.id || '')} ${String(action?.title || '')}`
      )
    );

  const packedSessionDates = isCommercialLaunch
    ? buildActionAwareSessionDates(startDayKey, endDayKey, actions, sessionSpecs, { maxSessionsPerWeek, blackoutDays })
    : buildPackedSessionDates(startDayKey, endDayKey, sessionSpecs.length, { maxSessionsPerWeek, blackoutDays });

  const sessions = sessionSpecs.map((spec, index) => {
    const date = packedSessionDates[index] || startDayKey;
    const sessionTitle = String(spec.title || 'Execution session').trim();
    const isFirstSession = spec.sessionIdx === 0;
    const isFinalSession = spec.sessionIdx === Math.max(0, Number(spec.sessionCount || 1) - 1);
    return {
      date,
      title: sessionTitle,
      startTime: '09:00',
      durationMinutes: spec.durationMinutes,
      actionSteps: [
        isFirstSession
          ? `Gather required inputs, references, and dependencies for ${sessionTitle}`
          : `Re-open prior artifacts and verify current baseline for ${sessionTitle}`,
        `Execute the core work for ${sessionTitle} and produce a concrete artifact`,
        `Run quality checks against acceptance criteria for ${sessionTitle}`,
        isFinalSession
          ? `Finalize output package and mark deliverable evidence complete for ${sessionTitle}`
          : `Document progress, blockers, and next dependency for ${sessionTitle}`,
      ],
      completionCondition: `${sessionTitle} session ${spec.sessionIdx + 1}/${Math.max(
        1,
        Number(spec.sessionCount || 1)
      )} produced evidence and updated deliverable ${spec.deliverableId}.`,
      deliverableId: spec.deliverableId,
      actionId: spec.actionId,
    };
  });

  const validation = validateSessionPlan(sessions, {
    actionIds: actions.map((action, idx) => String(action?.id || `act-${idx + 1}`)),
    startDayKey: startDayKey || null,
    endDayKey: endDayKey || null,
  });
  if (!validation.ok) {
    return {
      ok: false,
      error: {
        code: validation.error.code || 'SESSION_PLAN_INVALID',
        reason: validation.error.reason || 'Mock session plan failed validation.',
      },
    };
  }
  return { ok: true, sessions: validation.sessions };
}

function computeDaySpan(startDayKey: string, endDayKey: string) {
  if (!startDayKey || !endDayKey) return 0;
  const start = new Date(`${startDayKey}T12:00:00.000Z`);
  const end = new Date(`${endDayKey}T12:00:00.000Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;
  return Math.floor((end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000));
}

function buildActionAwareSessionDates(
  startDayKey: string,
  endDayKey: string,
  actions: Array<{
    id?: string;
    title?: string;
    dependencies?: string[];
    phaseHint?: 'early' | 'mid' | 'late';
    minimumDurationBusinessDays?: number;
  }>,
  sessionSpecs: Array<{
    actionId: string;
    deliverableId: string;
    title: string;
    durationMinutes: number;
    sessionIdx: number;
    sessionCount: number;
    phaseHint?: 'early' | 'mid' | 'late';
    commercialCycleIndex?: number;
    commercialCycleCount?: number;
  }>,
  options: { maxSessionsPerWeek?: number; blackoutDays?: Set<string> } = {}
): string[] {
  // For commercial launches: distribute action clusters across horizon phases
  // while preserving intra-cycle adjacency for sales+review loops.
  //
  // Phase structure for credible commercial pacing:
  // - Early (0-35%): Product/Commerce/Communications prep cycles
  // - Mid (35-70%): Live market iteration cycles (sales + review)
  // - Late (70-100%): Consolidation and terminal decision cycles

  if (!startDayKey || !endDayKey || sessionSpecs.length === 0) return [];

  const blackoutDays = options.blackoutDays || new Set<string>();
  const maxSessionsPerWeek = options.maxSessionsPerWeek || 0;

  const allDays = collectDayKeysUTC(startDayKey, endDayKey);
  const preferredDays = allDays.filter((dayKey) => !isWeekendUTC(dayKey) && !blackoutDays.has(dayKey));
  const usableDays = preferredDays.length > 0 ? preferredDays : allDays.filter((d) => !blackoutDays.has(d));

  if (usableDays.length === 0) {
    return Array.from({ length: sessionSpecs.length }).map(() => startDayKey);
  }

  // Group sessions by action to preserve action boundaries
  const sessionsByAction: Map<string, typeof sessionSpecs> = new Map();
  const actionOrderList: string[] = [];
  sessionSpecs.forEach((spec) => {
    if (!sessionsByAction.has(spec.actionId)) {
      sessionsByAction.set(spec.actionId, []);
      actionOrderList.push(spec.actionId);
    }
    sessionsByAction.get(spec.actionId)!.push(spec);
  });

  // For commercial launches: distribute action clusters across horizon phases
  const actionCount = actionOrderList.length;
  const horizonDaySpan = computeDaySpan(startDayKey, endDayKey);

  // Define phase boundaries for credible commercial pacing
  const earlyPhaseEnd = Math.floor(usableDays.length * 0.35); // 0-35%: Build/prep
  const midPhaseEnd = Math.floor(usableDays.length * 0.7); // 35-70%: Live iteration

  // Categorize actions by commercial phase - CHUNK-AWARE for causal validity
  const earlyActions: string[] = [];
  const midActions: string[] = [];
  const lateActions: string[] = [];

  const resolveFamilyKey = (title: string) => commercialFamilyKey(String(title), 0);
  const dependenciesByActionId = new Map<string, string[]>();
  const minimumDurationBusinessDaysByActionId = new Map<string, number>();
  actions.forEach((action) => {
    const id = String(action?.id || '');
    if (!id) return;
    const dependencies = Array.isArray(action?.dependencies) ? action.dependencies.filter(Boolean).map(String) : [];
    dependenciesByActionId.set(id, dependencies);
    const minimumDurationBusinessDays = Number(action?.minimumDurationBusinessDays);
    if (Number.isFinite(minimumDurationBusinessDays) && minimumDurationBusinessDays > 0) {
      minimumDurationBusinessDaysByActionId.set(id, Math.round(minimumDurationBusinessDays));
    }
  });

  actionOrderList.forEach((actionId) => {
    const action = actions.find((a) => a.id === actionId) as
      | { id?: string; title?: string; phaseHint?: 'early' | 'mid' | 'late' }
      | undefined;
    const title = String(action?.title || '').toLowerCase();
    const familyKey = resolveFamilyKey(title);

    if (action?.phaseHint === 'early') {
      earlyActions.push(actionId);
      return;
    }
    if (action?.phaseHint === 'mid') {
      midActions.push(actionId);
      return;
    }
    if (action?.phaseHint === 'late') {
      lateActions.push(actionId);
      return;
    }

    // Extract chunk index from action ID (brand:XX:YY:...)
    const chunkMatch = actionId.match(/brand:\d+:(\d+):/);
    const chunkIndex = chunkMatch ? parseInt(chunkMatch[1], 10) - 1 : 0;

    // CAUSAL VALIDITY RULE:
    // - Product/Commerce/Communications first cycles are early prep.
    // - Sales and Review first cycles are live market iteration and should start in mid phase.
    if (chunkIndex === 0) {
      if (familyKey === 'product' || familyKey === 'commerce' || familyKey === 'communications') {
        earlyActions.push(actionId);
      } else {
        midActions.push(actionId);
      }
    } else if (chunkIndex === 1) {
      midActions.push(actionId);
    } else {
      lateActions.push(actionId);
    }
  });

  // Calculate phase start indices
  const earlyStartIndex = 0;
  const midStartIndex = Math.floor(usableDays.length * 0.35);
  const lateStartIndex = Math.floor(usableDays.length * 0.7);

  // Calculate days available per phase
  const earlyDays = midStartIndex - earlyStartIndex;
  const midDays = lateStartIndex - midStartIndex;
  const lateDays = usableDays.length - lateStartIndex;

  // Map each action to its phase start index - RESPECT DEPENDENCIES WITHIN PHASES
  const actionStartDayIndex: Map<string, number> = new Map();
  const actionEndDayIndex: Map<string, number> = new Map();

  const computeActionDepth = (actionId: string, seen = new Set<string>()): number => {
    if (seen.has(actionId)) return 0;
    seen.add(actionId);
    const dependencies = dependenciesByActionId.get(actionId) || [];
    if (dependencies.length === 0) return 0;
    return Math.max(0, ...dependencies.map((depId) => computeActionDepth(depId, new Set(seen)))) + 1;
  };

  const orderedForDependencies = [...actionOrderList].sort((a, b) => {
    const depthA = computeActionDepth(a);
    const depthB = computeActionDepth(b);
    if (depthA !== depthB) return depthA - depthB;
    return actionOrderList.indexOf(a) - actionOrderList.indexOf(b);
  });

  const assignPhaseDay = (actionId: string, actionIds: string[], phaseStart: number, phaseDays: number) => {
    const index = actionIds.indexOf(actionId);
    if (index === -1) return 0;
    const ratio = actionIds.length > 1 ? index / (actionIds.length - 1) : 0;
    return phaseStart + Math.floor(ratio * Math.max(0, phaseDays - 1));
  };

  const earlyPhaseDays = Math.floor(usableDays.length * 0.34);
  const midPhaseStart = Math.floor(usableDays.length * 0.34);
  const midPhaseDays = Math.floor(usableDays.length * 0.38);
  const latePhaseStart = Math.floor(usableDays.length * 0.72);
  const latePhaseDays = usableDays.length - latePhaseStart;
  // Cycle-aware cadence: pre-compute per-cycle anchor days so intra-cycle actions are packed
  // tightly while inter-cycle evidence buffers adapt to the remaining horizon. That lets the
  // final cycle naturally own the late corridor instead of requiring continuity repair to move
  // unrelated foundation work.
  // Derive cycle index from actionId (brand:04:NN: or brand:05:NN:) — commercialCycleIndex is
  // stripped by parseLLMActionGraph, so the ID pattern is the only reliable source.
  const extractCycleIndex = (id: string): number => {
    const m = id.match(/^brand:0[45]:(\d+):/);
    return m ? parseInt(m[1], 10) : 0;
  };
  const sessionsPerDayForAction = (actionId: string, specs: typeof sessionSpecs) => {
    if (/^brand:0[0123]:/.test(actionId)) return 1;
    if (/^brand:0[45]:/.test(actionId)) return specs.length >= 3 ? 2 : 1;
    return specs.length >= 4 ? 2 : 1;
  };
  const actionSpanFor = (actionId: string) => {
    const specs = sessionsByAction.get(actionId) || [];
    const sessionsPerDay = sessionsPerDayForAction(actionId, specs);
    const densitySpanDays = Math.max(1, Math.ceil(specs.length / sessionsPerDay));
    const minimumDurationBusinessDays = minimumDurationBusinessDaysByActionId.get(actionId) || 0;
    return Math.max(densitySpanDays, minimumDurationBusinessDays);
  };
  const inCycleGapAfterAction = (actionId: string) => {
    if (/^brand:04:\d+:cycle-\d+-purchase-friction/.test(actionId)) return 0;
    if (/^brand:05:\d+:cycle-\d+-adjustment/.test(actionId)) return 0;
    return 1;
  };
  const cycleSpanFor = (cycleActions: string[]) =>
    cycleActions.reduce((sum, actionId, index) => {
      const gapAfter = index + 1 < cycleActions.length ? inCycleGapAfterAction(actionId) : 0;
      return sum + actionSpanFor(actionId) + gapAfter;
    }, 0);
  const cycleActionsByIndex = new Map<number, string[]>();
  [...midActions, ...lateActions].forEach((actionId) => {
    const cycleIndex = extractCycleIndex(actionId);
    if (cycleIndex > 0) {
      if (!cycleActionsByIndex.has(cycleIndex)) cycleActionsByIndex.set(cycleIndex, []);
      cycleActionsByIndex.get(cycleIndex)!.push(actionId);
    }
  });
  const sortedCycleIndices = Array.from(cycleActionsByIndex.keys()).sort((a, b) => a - b);
  const cycleStartDayByIndex = new Map<number, number>();
  const useExtendedCommercialCadence = sortedCycleIndices.length > 5;
  const foundationActionIds = actionOrderList.filter((actionId) => {
    if (!/^brand:0[0123]:/.test(actionId)) return false;
    if (useExtendedCommercialCadence) return true;
    const action = actions.find((candidate) => candidate.id === actionId) as
      | { id?: string; phaseHint?: 'early' | 'mid' | 'late' }
      | undefined;
    return action?.phaseHint !== 'mid' && action?.phaseHint !== 'late';
  });
  const cycleEngineStart = useExtendedCommercialCadence
    ? Math.max(midPhaseStart, Math.floor(usableDays.length * 0.38))
    : horizonDaySpan >= 240
      ? Math.max(midPhaseStart, Math.floor(usableDays.length * 0.48))
      : midPhaseStart;
  const compactFoundationDays = useExtendedCommercialCadence
    ? Math.max(1, Math.min(cycleEngineStart, foundationActionIds.length + 12))
    : Math.max(1, Math.min(earlyPhaseDays, foundationActionIds.length + 4));
  // Adaptive buffer: spread remaining horizon evenly across cycles so the last cycle
  // lands near year-end (Dec) and enforceLateCommercialContinuity exits early naturally.
  const totalCycleWorkDays = sortedCycleIndices.reduce((sum, ci) => {
    const cycleActions = cycleActionsByIndex.get(ci) || [];
    return sum + cycleSpanFor(cycleActions);
  }, 0);
  const availableBufferDays = Math.max(0, usableDays.length - cycleEngineStart - totalCycleWorkDays);
  const rawInterCycleEvidenceBuffer =
    sortedCycleIndices.length > 1
      ? useExtendedCommercialCadence
        ? Math.floor(availableBufferDays / sortedCycleIndices.length)
        : Math.floor(availableBufferDays / (sortedCycleIndices.length - 1))
      : 10;
  const maxInterCycleEvidenceBuffer = useExtendedCommercialCadence ? 4 : 6;
  const interCycleEvidenceBuffer =
    sortedCycleIndices.length > 1
      ? Math.max(1, Math.min(maxInterCycleEvidenceBuffer, rawInterCycleEvidenceBuffer))
      : Math.min(maxInterCycleEvidenceBuffer, rawInterCycleEvidenceBuffer);
  let rollingCycleStart = cycleEngineStart;
  sortedCycleIndices.forEach((cycleIndex) => {
    cycleStartDayByIndex.set(cycleIndex, rollingCycleStart);
    const cycleActions = cycleActionsByIndex.get(cycleIndex) || [];
    const cycleSpan = cycleSpanFor(cycleActions);
    rollingCycleStart = Math.min(usableDays.length - 1, rollingCycleStart + cycleSpan + interCycleEvidenceBuffer);
  });
  actionOrderList.forEach((actionId) => {
    const specs = sessionsByAction.get(actionId) || [];
    const actionSpanDays = actionSpanFor(actionId);
    let dayIndex = 0;
    if (foundationActionIds.includes(actionId)) {
      const foundationIndex = foundationActionIds.indexOf(actionId);
      dayIndex = earlyStartIndex + Math.min(compactFoundationDays - 1, foundationIndex);
    } else if (earlyActions.includes(actionId)) {
      dayIndex = assignPhaseDay(actionId, earlyActions, earlyStartIndex, earlyPhaseDays);
    } else if (midActions.includes(actionId) || lateActions.includes(actionId)) {
      const cycleIndex = extractCycleIndex(actionId);
      if (cycleIndex > 0 && cycleStartDayByIndex.has(cycleIndex)) {
        const cycleStart = cycleStartDayByIndex.get(cycleIndex)!;
        const cycleActions = cycleActionsByIndex.get(cycleIndex) || [];
        const actionPos = cycleActions.indexOf(actionId);
        let inCycleOffset = 0;
        for (let i = 0; i < actionPos; i++) {
          const aid = cycleActions[i] ?? '';
          inCycleOffset += actionSpanFor(aid) + inCycleGapAfterAction(aid);
        }
        dayIndex = cycleStart + inCycleOffset;
      } else if (midActions.includes(actionId)) {
        dayIndex = assignPhaseDay(actionId, midActions, midPhaseStart, midPhaseDays);
      } else {
        dayIndex = assignPhaseDay(actionId, lateActions, latePhaseStart, latePhaseDays);
      }
    }

    const dependencyIds = dependenciesByActionId.get(actionId) || [];
    if (dependencyIds.length > 0) {
      const dependencyEndDay = Math.max(...dependencyIds.map((depId) => actionEndDayIndex.get(depId) ?? 0));
      dayIndex = Math.max(dayIndex, dependencyEndDay + 1);
    }

    const latestStartDayIndex = Math.max(0, usableDays.length - actionSpanDays);
    dayIndex = Math.min(latestStartDayIndex, dayIndex);
    actionStartDayIndex.set(actionId, dayIndex);
    actionEndDayIndex.set(actionId, Math.min(usableDays.length - 1, dayIndex + actionSpanDays - 1));
  });

  // Placement can push upstream actions later than their initial phase slot, especially when
  // early regulated-readiness corridors feed stronger downstream commerce prep. Re-run a bounded
  // dependency precedence pass so any action that depends on a later-placed prerequisite is
  // pulled forward behind that dependency's final scheduled end rather than keeping its earlier
  // provisional slot.
  let dependencyPlacementChanged = true;
  let dependencyPlacementPasses = 0;
  while (dependencyPlacementChanged && dependencyPlacementPasses < actionOrderList.length) {
    dependencyPlacementChanged = false;
    dependencyPlacementPasses += 1;

    actionOrderList.forEach((actionId) => {
      const dependencyIds = dependenciesByActionId.get(actionId) || [];
      if (dependencyIds.length === 0) return;

      const currentStart = actionStartDayIndex.get(actionId) || 0;
      const specs = sessionsByAction.get(actionId) || [];
      const actionSpanDays = actionSpanFor(actionId);
      const latestStartDayIndex = Math.max(0, usableDays.length - actionSpanDays);
      const dependencyEndDay = Math.max(...dependencyIds.map((depId) => actionEndDayIndex.get(depId) ?? 0));
      const minStartFromDependencies = Math.min(latestStartDayIndex, dependencyEndDay + 1);

      if (minStartFromDependencies > currentStart) {
        actionStartDayIndex.set(actionId, minStartFromDependencies);
        actionEndDayIndex.set(actionId, Math.min(usableDays.length - 1, minStartFromDependencies + actionSpanDays - 1));
        dependencyPlacementChanged = true;
      }
    });
  }

  // Assign session dates: preserve action boundaries with high density within each action
  const packedDates: string[] = [];
  actionOrderList.forEach((actionId) => {
    const specs = sessionsByAction.get(actionId) || [];
    const baseActionDayIndex = actionStartDayIndex.get(actionId) || 0;
    const actionSpanDays = actionSpanFor(actionId);
    const sessionsPerDay = sessionsPerDayForAction(actionId, specs);
    const densitySpanDays = Math.max(1, Math.ceil(specs.length / sessionsPerDay));
    const shouldSpreadAcrossSpan = actionSpanDays > densitySpanDays;

    // Within each action, keep commercially earned work dense enough to show real launch pressure.
    // Depth comes from concrete session titles; this only packs that earned burden without adding filler.
    specs.forEach((spec, specIdx) => {
      const daySlotWithinAction = shouldSpreadAcrossSpan
        ? specs.length <= 1
          ? 0
          : Math.floor((specIdx * Math.max(0, actionSpanDays - 1)) / Math.max(1, specs.length - 1))
        : Math.floor(specIdx / sessionsPerDay);
      const dayIndex = Math.min(usableDays.length - 1, baseActionDayIndex + daySlotWithinAction);
      packedDates.push(usableDays[dayIndex] || startDayKey);
    });
  });

  if (horizonDaySpan >= 240) {
    enforceLateCommercialContinuity({
      packedDates,
      sessionSpecs,
      usableDays,
      lateStartIndex: latePhaseStart,
    });
  }

  capDailyCommercialSessionLoad({
    packedDates,
    usableDays,
    maxSessionsPerDay: 5,
  });

  if (maxSessionsPerWeek > 0) {
    const sessionActionIds = sessionSpecs.map((s) => s.actionId);
    capWeeklySessionLoad({
      packedDates,
      usableDays,
      maxSessionsPerWeek,
      sessionActionIds,
      cycleStartDayByIndex,
      dependenciesByActionId,
      orderedActionIds: actionOrderList,
    });
  }



  return packedDates;
}

function repairActionDependencyOrder({
  packedDates,
  sessionSpecs,
  dependenciesByActionId,
  usableDays,
  orderedActionIds,
}: {
  packedDates: string[];
  sessionSpecs: Array<{ actionId: string }>;
  dependenciesByActionId: Map<string, string[]>;
  usableDays: string[];
  orderedActionIds: string[];
}): void {
  if (packedDates.length === 0 || usableDays.length === 0) return;

  const dayIndexMap = new Map<string, number>();
  usableDays.forEach((d, i) => dayIndexMap.set(d, i));

  const sessionIndicesByAction = new Map<string, number[]>();
  sessionSpecs.forEach((spec, idx) => {
    if (!sessionIndicesByAction.has(spec.actionId)) sessionIndicesByAction.set(spec.actionId, []);
    sessionIndicesByAction.get(spec.actionId)!.push(idx);
  });

  // Track last assigned day index for commercial cycle actions only.
  // Scoped to brand:04/05 → brand:04/05 intra-cycle pairs so the repair
  // does not cascade into cross-phase foundation ordering.
  const actionLastDayIdx = new Map<string, number>();

  for (const actionId of orderedActionIds.filter((actionId) => sessionIndicesByAction.has(actionId))) {
    if (!/^brand:0[45]:/.test(actionId)) continue;

    const indices = sessionIndicesByAction.get(actionId)!;
    if (indices.length === 0) continue;

    // Only consider same-tier (brand:04/05) dependencies for the floor so
    // cross-phase constraints (regulated layer, foundation) are left intact.
    const depIds = (dependenciesByActionId.get(actionId) || []).filter((d) => /^brand:0[45]:/.test(d));
    let floorIdx = 0;
    for (const depId of depIds) {
      const depLast = actionLastDayIdx.get(depId);
      if (depLast !== undefined) floorIdx = Math.max(floorIdx, depLast + 1);
    }

    const firstIdx0 = indices[0] ?? 0;
    const firstDate = packedDates[firstIdx0] ?? '';
    const firstDayIdx = dayIndexMap.get(firstDate) ?? 0;

    if (firstDayIdx >= floorIdx) {
      const lastIdxN = indices[indices.length - 1] ?? firstIdx0;
      const lastDate = packedDates[lastIdxN] ?? '';
      const lastDayIdx = dayIndexMap.get(lastDate) ?? firstDayIdx;
      actionLastDayIdx.set(actionId, Math.max(firstDayIdx, lastDayIdx));
      continue;
    }

    const delta = floorIdx - firstDayIdx;
    let newLastDayIdx = 0;
    indices.forEach((idx) => {
      const d = packedDates[idx] ?? '';
      const cur = dayIndexMap.get(d) ?? 0;
      const next = Math.min(usableDays.length - 1, cur + delta);
      packedDates[idx] = usableDays[next] ?? d;
      if (next > newLastDayIdx) newLastDayIdx = next;
    });
    actionLastDayIdx.set(actionId, newLastDayIdx);
  }
}

function capWeeklySessionLoad({
  packedDates,
  usableDays,
  maxSessionsPerWeek,
  sessionActionIds = [],
  cycleStartDayByIndex = new Map(),
  dependenciesByActionId = new Map(),
  orderedActionIds = [],
}: {
  packedDates: string[];
  usableDays: string[];
  maxSessionsPerWeek: number;
  sessionActionIds?: string[];
  cycleStartDayByIndex?: Map<number, number>;
  dependenciesByActionId?: Map<string, string[]>;
  orderedActionIds?: string[];
}) {
  if (packedDates.length === 0 || usableDays.length === 0 || maxSessionsPerWeek <= 0) return;
  const weekKeyFor = (dayKey: string) => {
    const date = new Date(`${dayKey}T12:00:00.000Z`);
    const dayOfWeek = date.getUTCDay();
    const monday = new Date(date);
    monday.setUTCDate(date.getUTCDate() - ((dayOfWeek + 6) % 7));
    return monday.toISOString().slice(0, 10);
  };
  const usableDayIndexMap = new Map<string, number>();
  usableDays.forEach((dayKey, index) => usableDayIndexMap.set(dayKey, index));
  const maxSessionsPerDay = 5;
  const commercialActionPattern = /^brand:0[45]:/;
  const useCommercialBundleMode = cycleStartDayByIndex.size > 5;
  const commercialActionOrder = (actionId: string) => {
    if (/buyer-offer$/.test(actionId)) return 0;
    if (/outreach-response$/.test(actionId)) return 1;
    if (/purchase-friction$/.test(actionId)) return 2;
    if (/adjustment$/.test(actionId)) return 3;
    if (/evidence-interpretation$/.test(actionId)) return 4;
    if (/next-move-decision$/.test(actionId)) return 5;
    return 6;
  };
  const sessionIndicesByAction = new Map<string, number[]>();
  sessionActionIds.forEach((actionId, index) => {
    if (!actionId) return;
    if (!sessionIndicesByAction.has(actionId)) sessionIndicesByAction.set(actionId, []);
    sessionIndicesByAction.get(actionId)!.push(index);
  });

  // Process in ascending date order so sessions at earlier dates claim their natural weeks
  // first. When processed in action-list order, one family (brand:02) can fill a month's
  // worth of weeks before brand:04 even starts, cascading all later sessions to plan end.
  // Primary sort: date ascending so early sessions claim their natural weeks first.
  // Secondary sort (within same date): brand:04/05 sessions sorted by cycle index
  // DESCENDING so higher-numbered cycles claim the most-recent corridor weeks first.
  // This keeps each cycle's sessions compact (cycle-5 at Nov-Dec, cycle-1 at Aug-Sep)
  // rather than scattering them across the full corridor and blowing the intra-cycle span.
  const sortedIndices = Array.from({ length: packedDates.length }, (_, i) => i).sort((a, b) => {
    const da = packedDates[a] ?? '';
    const db = packedDates[b] ?? '';
    if (da !== db) return da < db ? -1 : 1;
    // Same date: sort brand:04/05 sessions by cycle index descending (higher cycle first)
    const aidA = sessionActionIds[a] ?? '';
    const aidB = sessionActionIds[b] ?? '';
    const cmA = /^brand:0[45]:(\d+):/.exec(aidA);
    const cmB = /^brand:0[45]:(\d+):/.exec(aidB);
    if (cmA && cmB) {
      const ca = parseInt(cmA[1] ?? '0', 10);
      const cb = parseInt(cmB[1] ?? '0', 10);
      if (ca !== cb) return useCommercialBundleMode ? ca - cb : cb - ca;
    }
    return a - b;
  });

  // Pre-populate dayCounts from the current placement so forward-scan sessions see the
  // true occupancy of days they haven't reached yet. This prevents piling many overflow
  // sessions onto a day that is already full in the initial placement (e.g. end-of-plan
  // cascade) — the check (dayCounts.get(candidate) < maxSessionsPerDay) correctly skips
  // fully-loaded days from the start, without waiting for them to be processed in sequence.
  // When a session moves: decrement old day, increment new day.
  // When a session stays (normal branch or stuck cap branch): dayCounts unchanged —
  // the session was already counted at init.
  const dayCounts = new Map<string, number>();
  for (const d of packedDates) {
    if (d) dayCounts.set(d, (dayCounts.get(d) || 0) + 1);
  }

  const weekCounts = new Map<string, number>();
  const corridorFloor = cycleStartDayByIndex.size > 0 ? Math.min(...cycleStartDayByIndex.values()) : 0;
  const overflowDiagnostics: Array<{ actionId: string; reason: string }> = [];

  const buildActionOffsets = (actionId: string) => {
    const indices = sessionIndicesByAction.get(actionId) || [];
    const dayIndices = indices.map((index) => usableDayIndexMap.get(packedDates[index] ?? '') ?? 0);
    const anchor = dayIndices.length > 0 ? Math.min(...dayIndices) : 0;
    const offsets = dayIndices.map((dayIdx) => Math.max(0, dayIdx - anchor));
    return { indices, anchor, offsets };
  };

  const buildCompressedOffsets = (count: number) =>
    Array.from({ length: count }, (_, index) => Math.floor(index / maxSessionsPerDay));

  const removeBundleFromDayCounts = (indices: number[]) => {
    indices.forEach((index) => {
      const date = packedDates[index] ?? '';
      if (!date) return;
      dayCounts.set(date, Math.max(0, (dayCounts.get(date) || 0) - 1));
    });
  };

  const addBundleToDayCounts = (dates: string[]) => {
    dates.forEach((date) => {
      if (!date) return;
      dayCounts.set(date, (dayCounts.get(date) || 0) + 1);
    });
  };

  const commercialActionIds = Array.from(sessionIndicesByAction.keys()).filter((actionId) =>
    commercialActionPattern.test(actionId)
  );

  const incrementWeekCountsForDates = (dates: string[]) => {
    const localWeekCounts = new Map<string, number>();
    dates.forEach((date) => {
      if (!date) return;
      const weekKey = weekKeyFor(date);
      localWeekCounts.set(weekKey, (localWeekCounts.get(weekKey) || 0) + 1);
    });
    localWeekCounts.forEach((count, weekKey) => {
      weekCounts.set(weekKey, (weekCounts.get(weekKey) || 0) + count);
    });
  };

  const decrementWeekCountsForDates = (dates: string[]) => {
    const localWeekCounts = new Map<string, number>();
    dates.forEach((date) => {
      if (!date) return;
      const weekKey = weekKeyFor(date);
      localWeekCounts.set(weekKey, (localWeekCounts.get(weekKey) || 0) + 1);
    });
    localWeekCounts.forEach((count, weekKey) => {
      weekCounts.set(weekKey, Math.max(0, (weekCounts.get(weekKey) || 0) - count));
    });
  };

  const canPlaceBundleAt = ({
    offsets,
    startDayIndex,
    ignoreWeeklyCap = false,
  }: {
    offsets: number[];
    startDayIndex: number;
    ignoreWeeklyCap?: boolean;
  }) => {
    const dates: string[] = [];
    const localDayCounts = new Map<string, number>();
    const localWeekCounts = new Map<string, number>();
    for (const offset of offsets) {
      const candidateDayIndex = startDayIndex + offset;
      const candidate = usableDays[candidateDayIndex] || '';
      if (!candidate) return null;
      dates.push(candidate);
      localDayCounts.set(candidate, (localDayCounts.get(candidate) || 0) + 1);
      if ((dayCounts.get(candidate) || 0) + (localDayCounts.get(candidate) || 0) > maxSessionsPerDay) {
        return null;
      }
      const candidateWeek = weekKeyFor(candidate);
      localWeekCounts.set(candidateWeek, (localWeekCounts.get(candidateWeek) || 0) + 1);
      if (!ignoreWeeklyCap && (weekCounts.get(candidateWeek) || 0) + (localWeekCounts.get(candidateWeek) || 0) > maxSessionsPerWeek) {
        return null;
      }
    }
    return dates;
  };

  const moveCommercialBundle = ({
    actionId,
    minStartDayIndex,
    ignoreWeeklyCapIfNeeded = false,
    diagnosticReason,
    countsAlreadyRecorded = false,
  }: {
    actionId: string;
    minStartDayIndex: number;
    ignoreWeeklyCapIfNeeded?: boolean;
    diagnosticReason: string;
    countsAlreadyRecorded?: boolean;
  }) => {
    const { indices, anchor, offsets } = buildActionOffsets(actionId);
    if (indices.length === 0) return true;
    const originalDates = indices.map((index) => packedDates[index] ?? '');
    removeBundleFromDayCounts(indices);
    if (countsAlreadyRecorded) {
      decrementWeekCountsForDates(originalDates);
    }

    let selectedDates: string[] | null = null;
    let usedWeeklyOverflow = false;
    const startFloor = Math.max(0, minStartDayIndex);
    const candidateOffsetSets = [offsets];
    const compressedOffsets = buildCompressedOffsets(indices.length);
    if (JSON.stringify(compressedOffsets) !== JSON.stringify(offsets)) {
      candidateOffsetSets.push(compressedOffsets);
    }

    for (const offsetSet of candidateOffsetSets) {
      const latestOffset = offsetSet.length > 0 ? Math.max(...offsetSet) : 0;
      const latestStartDayIndex = Math.max(0, usableDays.length - 1 - latestOffset);
      for (let startDayIndex = Math.max(anchor, startFloor); startDayIndex <= latestStartDayIndex; startDayIndex += 1) {
        selectedDates = canPlaceBundleAt({ offsets: offsetSet, startDayIndex });
        if (selectedDates) break;
      }
      if (selectedDates) break;
      if (!ignoreWeeklyCapIfNeeded) continue;
      for (let startDayIndex = Math.max(anchor, startFloor); startDayIndex <= latestStartDayIndex; startDayIndex += 1) {
        selectedDates = canPlaceBundleAt({ offsets: offsetSet, startDayIndex, ignoreWeeklyCap: true });
        if (selectedDates) {
          usedWeeklyOverflow = true;
          break;
        }
      }
      if (selectedDates) break;
    }

    if (!selectedDates) {
      addBundleToDayCounts(originalDates);
      if (countsAlreadyRecorded) {
        incrementWeekCountsForDates(originalDates);
      }
      if (ignoreWeeklyCapIfNeeded) {
        overflowDiagnostics.push({ actionId, reason: `${diagnosticReason}: no legal bundle slot` });
      }
      return false;
    }

    indices.forEach((index, offsetIndex) => {
      packedDates[index] = selectedDates?.[offsetIndex] || packedDates[index];
    });
    addBundleToDayCounts(selectedDates);
    incrementWeekCountsForDates(selectedDates);
    if (usedWeeklyOverflow) {
      overflowDiagnostics.push({ actionId, reason: `${diagnosticReason}: dependency order overrode weekly cap` });
    }
    return true;
  };

  if (useCommercialBundleMode) {
    commercialActionIds.forEach((actionId) => {
      removeBundleFromDayCounts(sessionIndicesByAction.get(actionId) || []);
    });
  }

  for (const sessionIndex of sortedIndices) {
    const actionId = sessionActionIds[sessionIndex] ?? '';
    if (useCommercialBundleMode && commercialActionPattern.test(actionId)) {
      continue;
    }

    const date = packedDates[sessionIndex] ?? '';
    const week = weekKeyFor(date);
    const currentCount = weekCounts.get(week) || 0;
    if (currentCount >= maxSessionsPerWeek) {
      const currentDayIndex = usableDayIndexMap.get(date) ?? 0;

      // Forward scan — preserves phase ordering for non-terminal sessions.
      for (let i = currentDayIndex + 1; i < usableDays.length; i += 1) {
        const candidate = usableDays[i] || '';
        if (!candidate) continue;
        const candidateWeek = weekKeyFor(candidate);
        if (
          (weekCounts.get(candidateWeek) || 0) < maxSessionsPerWeek &&
          (dayCounts.get(candidate) || 0) < maxSessionsPerDay
        ) {
          dayCounts.set(date, (dayCounts.get(date) || 0) - 1);
          packedDates[sessionIndex] = candidate;
          dayCounts.set(candidate, (dayCounts.get(candidate) || 0) + 1);
          weekCounts.set(candidateWeek, (weekCounts.get(candidateWeek) || 0) + 1);
          break;
        }
      }

      // Backward scan when forward exhausts all remaining weeks (end-of-plan overflow).
      // Cycle sessions (brand:04/05) skip this entirely: they pile at plan-end due to
      // dependency cascade and a corridor backward scan would scatter them before their
      // cycle window, making intra-cycle spans > 100 days. They go straight to last-resort
      // which keeps them near their natural late-plan position.
      if ((packedDates[sessionIndex] ?? '') === date) {
        const actionId = sessionActionIds[sessionIndex] ?? '';
        if (!/^brand:0[45]:/.test(actionId)) {
          for (let i = currentDayIndex - 1; i >= 0; i -= 1) {
            const candidate = usableDays[i] || '';
            if (!candidate) continue;
            const candidateWeek = weekKeyFor(candidate);
            if (
              (weekCounts.get(candidateWeek) || 0) < maxSessionsPerWeek &&
              (dayCounts.get(candidate) || 0) < maxSessionsPerDay
            ) {
              dayCounts.set(date, (dayCounts.get(date) || 0) - 1);
              packedDates[sessionIndex] = candidate;
              dayCounts.set(candidate, (dayCounts.get(candidate) || 0) + 1);
              weekCounts.set(candidateWeek, (weekCounts.get(candidateWeek) || 0) + 1);
              break;
            }
          }
        }
      }

      // Last-resort pass: all corridor weeks are full but some days have room under
      // the daily cap. Scan backward from plan end ignoring the weekly cap so the
      // session lands near its natural late-plan position instead of scattering
      // into the pre-commercial period.
      if ((packedDates[sessionIndex] ?? '') === date) {
        for (let i = usableDays.length - 1; i >= 0; i -= 1) {
          const candidate = usableDays[i] || '';
          if (!candidate || candidate === date) continue;
          if ((dayCounts.get(candidate) || 0) < maxSessionsPerDay) {
            dayCounts.set(date, (dayCounts.get(date) || 0) - 1);
            packedDates[sessionIndex] = candidate;
            dayCounts.set(candidate, (dayCounts.get(candidate) || 0) + 1);
            break;
          }
        }
      }

      // If neither scan found a slot the session stays; record week usage.
      // dayCounts is unchanged because the session was already counted at init.
      if ((packedDates[sessionIndex] ?? '') === date) {
        weekCounts.set(week, currentCount + 1);
      }
      continue;
    }
    // Under weekly cap: session stays at its original date.
    // dayCounts is unchanged — this session was already counted at init.
    weekCounts.set(week, currentCount + 1);
  }

  // Commercial chain placement for the 8-cycle path happens after non-commercial weekly-cap
  // smoothing so bundle floors inherit the final prep occupancy instead of trying to repair
  // invalid predecessor/successor order in an already-full late corridor.
  const brand0123PostFirstByFamily = new Map<string, number>();
  for (let i = 0; i < sessionActionIds.length; i += 1) {
    const aid = sessionActionIds[i] ?? '';
    const fm = /^brand:0([123]):/.exec(aid);
    if (!fm) continue;
    const family = fm[1] ?? '';
    const d = packedDates[i] ?? '';
    if (!d) continue;
    const idx = usableDayIndexMap.get(d);
    if (idx === undefined) continue;
    const cur = brand0123PostFirstByFamily.get(family);
    if (cur === undefined || idx < cur) brand0123PostFirstByFamily.set(family, idx);
  }
  const postLoopFloor = brand0123PostFirstByFamily.size > 0
    ? Math.max(corridorFloor, Math.max(...brand0123PostFirstByFamily.values()))
    : corridorFloor;
  if (useCommercialBundleMode) {
    const dependencyOrderedActionIds =
      orderedActionIds.length > 0
        ? orderedActionIds.filter((actionId) => commercialActionPattern.test(actionId) && sessionIndicesByAction.has(actionId))
        : Array.from(sessionIndicesByAction.keys()).filter((actionId) => commercialActionPattern.test(actionId));
    const completionDayIndexForExistingAction = (actionId: string) => {
      const indices = sessionIndicesByAction.get(actionId) || [];
      const dayIndices = indices
        .map((index) => usableDayIndexMap.get(packedDates[index] ?? ''))
        .filter((value): value is number => value !== undefined);
      return dayIndices.length > 0 ? Math.max(...dayIndices) : undefined;
    };
    const placeCommercialBundleFresh = ({
      actionId,
      minStartDayIndex,
    }: {
      actionId: string;
      minStartDayIndex: number;
    }) => {
      const { indices, offsets } = buildActionOffsets(actionId);
      if (indices.length === 0) return false;
      const candidateOffsetSets = [offsets];
      const compressedOffsets = buildCompressedOffsets(indices.length);
      let latestPossibleStartDayIndex = usableDays.length - 1;
      if (JSON.stringify(compressedOffsets) !== JSON.stringify(offsets)) {
        candidateOffsetSets.push(compressedOffsets);
      }

      let selectedDates: string[] | null = null;
      let usedWeeklyOverflow = false;
      for (const offsetSet of candidateOffsetSets) {
        const latestOffset = offsetSet.length > 0 ? Math.max(...offsetSet) : 0;
        const latestStartDayIndex = Math.max(0, usableDays.length - 1 - latestOffset);
        latestPossibleStartDayIndex = Math.min(latestPossibleStartDayIndex, latestStartDayIndex);
        const startFloor = Math.max(0, minStartDayIndex);
        for (let startDayIndex = startFloor; startDayIndex <= latestStartDayIndex; startDayIndex += 1) {
          selectedDates = canPlaceBundleAt({ offsets: offsetSet, startDayIndex });
          if (selectedDates) break;
        }
        if (selectedDates) break;
        for (let startDayIndex = startFloor; startDayIndex <= latestStartDayIndex; startDayIndex += 1) {
          selectedDates = canPlaceBundleAt({ offsets: offsetSet, startDayIndex, ignoreWeeklyCap: true });
          if (selectedDates) {
            usedWeeklyOverflow = true;
            break;
          }
        }
        if (selectedDates) break;
      }

      if (!selectedDates) {
        overflowDiagnostics.push({
          actionId,
          reason: `SCHEDULER_CAPACITY_PLACEMENT_INSUFFICIENT floor=${minStartDayIndex} latest=${latestPossibleStartDayIndex}`,
        });
        return false;
      }

      indices.forEach((index, offsetIndex) => {
        packedDates[index] = selectedDates?.[offsetIndex] || packedDates[index];
      });
      addBundleToDayCounts(selectedDates);
      incrementWeekCountsForDates(selectedDates);
      if (usedWeeklyOverflow) {
        overflowDiagnostics.push({ actionId, reason: 'COMMERCIAL_WEEKLY_CAP_OVERFLOW' });
      }
      return true;
    };

    const placedCommercialCompletionByActionId = new Map<string, number>();
    dependencyOrderedActionIds.forEach((actionId) => {
      const cycleMatch = /^brand:0[45]:(\d+):/.exec(actionId);
      const cycleIndex = parseInt(cycleMatch?.[1] ?? '0', 10);
      const cycleFloor = cycleIndex > 0 ? cycleStartDayByIndex.get(cycleIndex) || corridorFloor : corridorFloor;
      const dependencyFloor = (dependenciesByActionId.get(actionId) || []).reduce((maxIdx, dependencyId) => {
        const placedCommercialCompletion = placedCommercialCompletionByActionId.get(dependencyId);
        if (placedCommercialCompletion !== undefined) {
          return Math.max(maxIdx, placedCommercialCompletion + 1);
        }
        const existingCompletion = completionDayIndexForExistingAction(dependencyId);
        return existingCompletion === undefined ? maxIdx : Math.max(maxIdx, existingCompletion + 1);
      }, 0);
      const minStartDayIndex = Math.max(postLoopFloor, cycleFloor, dependencyFloor);
      const placed = placeCommercialBundleFresh({
        actionId,
        minStartDayIndex,
      });
      if (!placed) return;
      const completionDayIndex = completionDayIndexForExistingAction(actionId);
      if (completionDayIndex !== undefined) {
        placedCommercialCompletionByActionId.set(actionId, completionDayIndex);
      }
    });
  }

  if (overflowDiagnostics.length > 0) {
    // eslint-disable-next-line no-console
    console.warn('Commercial weekly-cap overflow diagnostics:', overflowDiagnostics);
  }
}

function capDailyCommercialSessionLoad({
  packedDates,
  usableDays,
  maxSessionsPerDay,
}: {
  packedDates: string[];
  usableDays: string[];
  maxSessionsPerDay: number;
}) {
  if (packedDates.length === 0 || usableDays.length === 0 || maxSessionsPerDay <= 0) return;

  const usableDayIndex = new Map<string, number>();
  usableDays.forEach((dayKey, index) => usableDayIndex.set(dayKey, index));
  const assignedCounts = new Map<string, number>();

  packedDates.forEach((date, sessionIndex) => {
    const currentDayIndex = usableDayIndex.get(date) ?? 0;
    let targetDayKey = date;

    if ((assignedCounts.get(targetDayKey) || 0) >= maxSessionsPerDay) {
      for (let index = currentDayIndex + 1; index < usableDays.length; index += 1) {
        const candidateDayKey = usableDays[index] || '';
        if (candidateDayKey && (assignedCounts.get(candidateDayKey) || 0) < maxSessionsPerDay) {
          targetDayKey = candidateDayKey;
          break;
        }
      }
    }

    packedDates[sessionIndex] = targetDayKey;
    assignedCounts.set(targetDayKey, (assignedCounts.get(targetDayKey) || 0) + 1);
  });
}

function enforceLateCommercialContinuity({
  packedDates,
  sessionSpecs,
  usableDays,
  lateStartIndex,
}: {
  packedDates: string[];
  sessionSpecs: Array<{ title: string; actionId?: string }>;
  usableDays: string[];
  lateStartIndex: number;
}) {
  if (packedDates.length === 0 || usableDays.length === 0) return;
  const lateStartDay = usableDays[Math.min(Math.max(0, lateStartIndex), usableDays.length - 1)] || '';
  if (!lateStartDay) return;
  const existingLateCount = packedDates.filter((date) => date >= lateStartDay).length;
  if (existingLateCount >= 3) return;

  const candidateIndices = sessionSpecs
    .map((spec, index) => ({
      index,
      actionId: String(spec?.actionId || ''),
      title: String(spec?.title || '').toLowerCase(),
    }))
    .filter(
      ({ actionId, title }) =>
        /^brand:0[45]:/.test(actionId) &&
        /\b(evidence|review|decision|next commercial|next launch milestone|late-horizon|follow-up|blocked conversion|outreach improvement)\b/i.test(
          title
        )
    )
    .map(({ index }) => index);
  const cycleFallbackIndices = sessionSpecs
    .map((spec, index) => ({ index, actionId: String(spec?.actionId || '') }))
    .filter(({ actionId }) => /^brand:0[45]:/.test(actionId))
    .map(({ index }) => index)
    .slice(-3);
  const fallbackIndices =
    cycleFallbackIndices.length > 0
      ? cycleFallbackIndices
      : Array.from({ length: Math.min(3, sessionSpecs.length) }).map((_, offset) => sessionSpecs.length - 1 - offset);
  const indices = Array.from(new Set([...candidateIndices.slice(-3), ...fallbackIndices]))
    .filter((index) => index >= 0 && index < packedDates.length)
    .slice(-3)
    .sort((left, right) => left - right);
  if (indices.length === 0) return;

  const lastLateIndex = usableDays.length - 1;
  const lateWindowStart = Math.min(lastLateIndex, Math.max(lateStartIndex, lastLateIndex - 25));
  const lateWindowDays = usableDays.slice(lateWindowStart);
  indices.forEach((sessionIndex, slotIndex) => {
    const dayIndex = Math.round((slotIndex * Math.max(0, lateWindowDays.length - 1)) / Math.max(1, indices.length - 1));
    packedDates[sessionIndex] = lateWindowDays[dayIndex] || usableDays[lastLateIndex] || packedDates[sessionIndex];
  });
}

function buildPackedSessionDates(
  startDayKey: string,
  endDayKey: string,
  totalSessions: number,
  options: { maxSessionsPerWeek?: number; blackoutDays?: Set<string> } = {}
) {
  if (!startDayKey || !endDayKey || !Number.isFinite(totalSessions) || totalSessions <= 0) {
    return [];
  }
  const blackoutDays = options.blackoutDays || new Set<string>();
  const maxSessionsPerWeek = options.maxSessionsPerWeek || 0;
  const allDays = collectDayKeysUTC(startDayKey, endDayKey);
  const preferredDays = allDays.filter((dayKey) => !isWeekendUTC(dayKey) && !blackoutDays.has(dayKey));
  const usableDays = preferredDays.length > 0 ? preferredDays : allDays.filter((d) => !blackoutDays.has(d));
  if (usableDays.length === 0) {
    return Array.from({ length: totalSessions }).map(() => startDayKey);
  }
  if (computeDaySpan(startDayKey, endDayKey) >= 120 && totalSessions > 1 && maxSessionsPerWeek === 0) {
    return Array.from({ length: totalSessions }).map((_, index) => {
      const usableIndex = Math.round((index * (usableDays.length - 1)) / Math.max(1, totalSessions - 1));
      return usableDays[Math.min(usableDays.length - 1, usableIndex)] || startDayKey;
    });
  }
  const weeks = chunkIntoCalendarWeeks(usableDays);
  const weekCount = Math.max(1, weeks.length);
  // When maxSessionsPerWeek is set, compute how many weeks are needed and extend if necessary.
  const effectiveSessionsPerWeek =
    maxSessionsPerWeek > 0
      ? maxSessionsPerWeek
      : Math.max(1, Math.ceil(totalSessions / weekCount));
  const weeksNeeded = Math.ceil(totalSessions / effectiveSessionsPerWeek);
  const effectiveWeeks = weeksNeeded > weekCount ? weeks.concat(Array.from({ length: weeksNeeded - weekCount }).map(() => weeks[weeks.length - 1] || [])) : weeks;
  const packedDates: string[] = [];
  for (let index = 0; index < totalSessions; index += 1) {
    const weekIndex = Math.min(effectiveWeeks.length - 1, Math.floor(index / effectiveSessionsPerWeek));
    const slotIndex = index % effectiveSessionsPerWeek;
    const weekDays = effectiveWeeks[weekIndex] || [];
    const fallbackWeekDays = effectiveWeeks[effectiveWeeks.length - 1] || usableDays;
    packedDates.push(
      weekDays[Math.min(slotIndex, Math.max(0, weekDays.length - 1))] ||
        fallbackWeekDays[Math.min(slotIndex, Math.max(0, fallbackWeekDays.length - 1))] ||
        usableDays[usableDays.length - 1] ||
        startDayKey
    );
  }
  return packedDates;
}

function collectDayKeysUTC(startDayKey: string, endDayKey: string) {
  const span = computeDaySpan(startDayKey, endDayKey);
  return Array.from({ length: Math.max(0, span) + 1 }, (_, index) => addDaysUTC(startDayKey, index));
}

function chunkIntoCalendarWeeks(dayKeys: string[]) {
  const weeks: string[][] = [];
  let currentWeekKey = '';
  dayKeys.forEach((dayKey) => {
    const weekKey = weekKeyUTC(dayKey);
    if (weekKey !== currentWeekKey) {
      weeks.push([]);
      currentWeekKey = weekKey;
    }
    weeks[weeks.length - 1].push(dayKey);
  });
  return weeks;
}

function isWeekendUTC(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  const weekday = date.getUTCDay();
  return weekday === 0 || weekday === 6;
}

function weekKeyUTC(dayKey: string) {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - mondayOffset);
  return date.toISOString().slice(0, 10);
}

function addDaysUTC(dayKey: string, days: number) {
  const date = new Date(`${dayKey}T12:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return dayKey;
  date.setUTCDate(date.getUTCDate() + Math.max(0, Number(days) || 0));
  return date.toISOString().slice(0, 10);
}

function coerceDayKey(value: unknown) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const parsed = new Date(raw);
  if (!Number.isFinite(parsed.getTime())) return '';
  return parsed.toISOString().slice(0, 10);
}
