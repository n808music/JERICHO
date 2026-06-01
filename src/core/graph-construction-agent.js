/**
 * Graph Construction Agent
 *
 * Agent 2 in the integration order.
 * Builds a deterministic action graph from a confirmed canonical goal payload.
 * Validates dependency structure and supports confirmation gating.
 */

import { ERROR_CODES } from './diagnostics.js';

// Canonical action sets for all 45 subtypes.
const CANONICAL_ACTION_SETS = {
  // VentureLaunch
  'SaaS Product Launch': [
    'Define core problem and target customer',
    'Validate problem with potential users',
    'Define MVP feature set',
    'Build MVP',
    'Set up infrastructure and deployment',
    'Create pricing model',
    'Build landing page',
    'Recruit beta users',
    'Run beta program and collect feedback',
    'Iterate on MVP based on feedback',
    'Set up payment processing',
    'Launch publicly',
    'Establish customer support process',
    'Track key metrics and iterate'
  ],
  'Consumer Product Launch': [
    'Define product concept and target market',
    'Validate demand',
    'Source or manufacture product',
    'Create brand identity',
    'Build e-commerce or distribution channel',
    'Create product photography and content',
    'Set up logistics and fulfillment',
    'Run pre-launch marketing',
    'Launch',
    'Manage post-launch operations and reorder'
  ],
  'Service Business Launch': [
    'Define service offering and target client',
    'Validate with potential clients',
    'Create service delivery process',
    'Set pricing and packaging',
    'Build credibility assets (portfolio, case studies, testimonials)',
    'Create outreach and sales process',
    'Sign first client',
    'Deliver and document first engagement',
    'Refine process and scale outreach'
  ],
  'Marketplace Launch': [
    'Define marketplace model and value proposition',
    'Identify supply side and demand side',
    'Validate with both sides',
    'Build supply side first (recruit providers)',
    'Build platform MVP',
    'Onboard initial supply',
    'Activate demand side',
    'Facilitate first transactions',
    'Monitor and balance supply and demand',
    'Scale both sides'
  ],
  'Local Business Launch': [
    'Define business concept and local market',
    'Validate local demand',
    'Secure location or operating setup',
    'Obtain licenses and permits',
    'Set up operations',
    'Create local marketing presence',
    'Soft launch and gather feedback',
    'Refine operations',
    'Full launch and ongoing marketing'
  ],

  // SkillAcquisition
  'Software Skill Acquisition': [
    'Assess current skill level',
    'Define target proficiency and use case',
    'Select learning resources and curriculum',
    'Complete foundational learning modules',
    'Build first practice project',
    'Review and identify gaps',
    'Complete intermediate learning modules',
    'Build second project with increased complexity',
    'Seek feedback or code review',
    'Complete advanced modules or specialization',
    'Build portfolio project',
    'Document and publish learning'
  ],
  'Design Skill Acquisition': [
    'Assess current skill level',
    'Define target proficiency and design context',
    'Select tools and learning resources',
    'Complete foundational design principles modules',
    'Complete first design exercise',
    'Seek critique and apply feedback',
    'Complete intermediate modules',
    'Build practice project',
    'Seek critique and apply feedback',
    'Complete advanced modules',
    'Build portfolio piece',
    'Publish and document'
  ],
  'Communication Skill Acquisition': [
    'Assess current communication baseline',
    'Define target context (speaking, writing, negotiating)',
    'Select learning resources and practice format',
    'Complete foundational modules',
    'First practice session or exercise',
    'Record and self-review or seek feedback',
    'Complete intermediate modules',
    'Second practice session with increased difficulty',
    'Seek external feedback',
    'Complete advanced modules',
    'Real-world application session',
    'Document progress and reflection'
  ],
  'Technical Trade Skill Acquisition': [
    'Assess current skill level',
    'Define target trade proficiency',
    'Identify training program or apprenticeship path',
    'Complete safety and foundational training',
    'First supervised practical exercise',
    'Review performance and identify gaps',
    'Complete intermediate practical training',
    'Complete unsupervised practice project',
    'Seek evaluation',
    'Complete advanced training',
    'Certification or qualification step if applicable',
    'Document competency'
  ],
  'Creative Skill Acquisition': [
    'Assess current skill level',
    'Define creative medium and target proficiency',
    'Select learning resources and practice format',
    'Complete foundational modules',
    'First creative exercise',
    'Seek critique and apply feedback',
    'Complete intermediate modules',
    'Complete practice project',
    'Seek critique and apply feedback',
    'Complete advanced modules',
    'Complete portfolio piece',
    'Publish and document'
  ],

  // ProfessionalQualification
  'Certification Exam': [
    'Confirm exam eligibility requirements',
    'Register for exam',
    'Obtain study materials',
    'Create study plan against exam date',
    'Complete foundational study blocks',
    'Complete practice questions — foundational',
    'Complete intermediate study blocks',
    'Complete practice questions — intermediate',
    'Identify weak areas and targeted review',
    'Complete full practice exam',
    'Final review and weak area remediation',
    'Exam day'
  ],
  'Licensure Exam': [
    'Confirm licensure eligibility and prerequisites',
    'Complete any required prerequisite hours or courses',
    'Submit application for exam eligibility',
    'Obtain official study materials',
    'Create study plan against exam date',
    'Complete foundational study blocks',
    'Complete practice questions — foundational',
    'Complete intermediate study blocks',
    'Complete practice questions — intermediate',
    'Identify weak areas and targeted review',
    'Complete full practice exam',
    'Final review and remediation',
    'Exam day',
    'Submit licensure application post-exam'
  ],
  'Compliance Training Completion': [
    'Identify all required training modules',
    'Confirm completion deadline',
    'Schedule training blocks across available time',
    'Complete module 1',
    'Complete module 2',
    'Complete module 3 (repeat as needed per module count)',
    'Complete final assessment if required',
    'Obtain and store completion certificate'
  ],
  'Portfolio-Based Qualification': [
    'Review qualification criteria and portfolio requirements',
    'Audit existing work against requirements',
    'Identify gaps in portfolio',
    'Create missing portfolio pieces',
    'Refine existing pieces to qualification standard',
    'Compile portfolio',
    'Write supporting statements or case studies',
    'Submit portfolio',
    'Respond to review feedback if applicable'
  ],
  'Interview-Based Qualification': [
    'Review qualification criteria',
    'Research the panel or interview format',
    'Prepare core competency responses',
    'Prepare technical or domain-specific responses',
    'Complete mock interview',
    'Review and refine responses',
    'Complete second mock interview',
    'Final preparation',
    'Interview day',
    'Follow-up communication post-interview'
  ],

  // PhysicalTraining
  'Strength Program': [
    'Establish baseline (assessment or 1RM testing)',
    'Define program structure (days per week, split)',
    'Week 1 — Foundational load',
    'Week 2 — Volume progression',
    'Week 3 — Intensity progression',
    'Week 4 — Deload',
    'Repeat progression cycle with increased baseline',
    'Mid-program assessment',
    'Final program block',
    'Final assessment and result documentation'
  ],
  'Endurance Performance': [
    'Establish aerobic baseline (time trial or benchmark)',
    'Define event or performance target',
    'Build base mileage or volume phase',
    'Introduce tempo and threshold work',
    'Race simulation or time trial',
    'Recovery week',
    'Build phase 2 with increased load',
    'Peak phase',
    'Taper phase',
    'Event or performance day',
    'Post-event recovery and reflection'
  ],
  'Weight Loss / Body Composition': [
    'Establish current baseline (weight, measurements, photos)',
    'Define target and timeline',
    'Set nutrition approach',
    'Set training approach',
    'Week 1 execution',
    'Week 2 check-in and adjustment',
    'Week 4 check-in and adjustment',
    'Week 8 check-in and adjustment',
    'Final assessment and documentation'
  ],
  'Rehab Return to Training': [
    'Medical clearance and baseline assessment',
    'Define return-to-training milestones with practitioner',
    'Phase 1 — Mobility and stability work',
    'Phase 1 assessment',
    'Phase 2 — Strength rebuilding',
    'Phase 2 assessment',
    'Phase 3 — Sport-specific or activity-specific reintroduction',
    'Phase 3 assessment',
    'Full training reintegration',
    'Ongoing monitoring'
  ],
  'General Conditioning': [
    'Establish baseline fitness assessment',
    'Define conditioning target',
    'Set weekly training structure',
    'Week 1 execution',
    'Week 2 execution',
    'Month 1 check-in',
    'Adjust program based on progress',
    'Month 2 execution',
    'Final assessment and documentation'
  ],

  // JobSearchPipeline
  'Corporate Role Search': [
    'Define target role, level, and industry',
    'Update resume to target role',
    'Update LinkedIn profile',
    'Identify target companies',
    'Activate network — inform contacts of search',
    'Apply to first batch of roles',
    'Follow up on applications',
    'Prepare for screening interviews',
    'Complete screening interviews',
    'Prepare for technical or panel interviews',
    'Complete interviews',
    'Evaluate offers and negotiate',
    'Accept and transition'
  ],
  'Remote Knowledge Work Search': [
    'Define target role and remote-specific criteria',
    'Update resume for remote roles',
    'Update LinkedIn and remote job profiles',
    'Identify remote-specific job boards and communities',
    'Apply to first batch',
    'Follow up on applications',
    'Prepare for async and video interview formats',
    'Complete interviews',
    'Evaluate offers and negotiate',
    'Accept and transition'
  ],
  'Creative Role Search': [
    'Define target creative role and context',
    'Update portfolio to target role',
    'Update resume and online presence',
    'Identify target studios, agencies, or clients',
    'Activate creative network',
    'Apply and submit portfolio to first batch',
    'Follow up',
    'Prepare for portfolio review interviews',
    'Complete portfolio review interviews',
    'Evaluate offers and negotiate',
    'Accept and transition'
  ],
  'Skilled Trade Role Search': [
    'Confirm credentials and certifications are current',
    'Update trade resume',
    'Identify local employers, unions, or contractors',
    'Activate trade network and referrals',
    'Apply to first batch',
    'Follow up',
    'Complete trade interviews or skills assessments',
    'Evaluate offers',
    'Accept and transition'
  ],
  'Career Transition Search': [
    'Define target new field and role',
    'Assess skill gaps against target role',
    'Close priority skill gaps',
    'Update resume to bridge from current to target',
    'Identify transferable experience framing',
    'Activate network in target field',
    'Apply to transition-friendly roles',
    'Prepare for "why are you switching" narrative',
    'Complete interviews',
    'Evaluate offers',
    'Accept and transition'
  ],

  // CreativeProduction
  'TV / Series Writing': [
    'Define series concept and logline',
    'Build series bible',
    'Map season arc and episode structure',
    'Write pilot outline',
    'Write pilot first draft',
    'Revise pilot — first pass',
    'Seek coverage or feedback',
    'Revise pilot — second pass',
    'Write episode 2 outline',
    'Write episode 2 first draft',
    'Complete remaining episode outlines',
    'Complete remaining episode drafts',
    'Final revision pass on all episodes',
    'Format and package for submission'
  ],
  'Podcast Production': [
    'Define concept, format, and target audience',
    'Name and brand the show',
    'Set up recording equipment and software',
    'Record trailer or pilot episode',
    'Edit and produce trailer',
    'Set up podcast hosting and RSS feed',
    'Submit to directories (Spotify, Apple, etc.)',
    'Record episode 1',
    'Edit and produce episode 1',
    'Publish episode 1',
    'Repeat record-edit-publish cycle per episode',
    'Build promotional rhythm alongside release'
  ],
  'Music Project Production': [
    'Define project scope (album, EP, single)',
    'Complete songwriting or composition',
    'Pre-production and arrangement',
    'Book or set up recording',
    'Tracking sessions',
    'Editing and comping',
    'Mixing',
    'Mastering',
    'Artwork and metadata',
    'Distribution setup',
    'Release',
    'Promotional campaign'
  ],
  'Video Production': [
    'Define concept and target audience',
    'Write script or shot list',
    'Pre-production planning (locations, talent, equipment)',
    'Production (shoot)',
    'Ingest and organize footage',
    'Rough cut edit',
    'Feedback and revision',
    'Fine cut edit',
    'Color grading',
    'Audio mix and sound design',
    'Final export and delivery',
    'Distribution and promotion'
  ],
  'Book / Longform Writing': [
    'Define concept, audience, and structure',
    'Create detailed outline',
    'Write chapter 1 draft',
    'Write chapter 2 draft',
    'Continue chapter drafts through completion',
    'Complete full first draft',
    'First revision pass — structure and flow',
    'Second revision pass — line editing',
    'Seek beta reader or editor feedback',
    'Revise based on feedback',
    'Final proofread',
    'Format and publish or submit to agents'
  ],

  // BrandLaunch
  'Personal Brand Launch': [
    'Define brand positioning and audience',
    'Define content pillars',
    'Create brand identity (name, visual, voice)',
    'Set up primary platform presence',
    'Create foundational content (bio, about, key posts)',
    'Publish first content piece',
    'Establish publishing cadence',
    'Engage with audience and community',
    'Expand to second platform',
    'Review and refine brand positioning'
  ],
  'Business Brand Launch': [
    'Define brand strategy and positioning',
    'Define target audience and competitive differentiation',
    'Develop brand identity (name, logo, colors, voice)',
    'Create brand guidelines',
    'Apply brand to all customer touchpoints',
    'Build website with brand applied',
    'Create launch content',
    'Announce and launch publicly',
    'Monitor brand reception and refine'
  ],
  'Product Brand Launch': [
    'Define product brand positioning',
    'Name the product',
    'Develop product visual identity',
    'Create packaging or digital presentation',
    'Build product landing page',
    'Create product content and photography',
    'Set up distribution channels with brand applied',
    'Launch campaign',
    'Monitor and refine'
  ],
  'Artist / Creator Brand Launch': [
    'Define artistic identity and audience',
    'Define content or work type and cadence',
    'Create artist brand identity',
    'Set up primary platform',
    'Publish foundational work',
    'Establish release or publishing cadence',
    'Engage community',
    'Expand reach through collaboration or promotion',
    'Review and refine brand positioning'
  ],
  'Campaign Brand Launch': [
    'Define campaign objective and audience',
    'Define campaign concept and messaging',
    'Create campaign creative assets',
    'Build campaign landing page or hub',
    'Set up campaign tracking',
    'Launch campaign',
    'Monitor performance',
    'Optimize based on data',
    'Close campaign and document results'
  ],

  // SalesPipeline
  'B2B Service Sales': [
    'Define ideal client profile',
    'Build prospect list',
    'Create outreach messaging',
    'Send first outreach batch',
    'Follow up on first batch',
    'Book first discovery calls',
    'Complete discovery calls',
    'Send proposals',
    'Follow up on proposals',
    'Close first deals',
    'Onboard clients',
    'Request referrals and case studies'
  ],
  'B2C Product Sales': [
    'Define target customer and channel',
    'Set up sales channel (online store, marketplace, etc.)',
    'Create product listings and content',
    'Drive first traffic',
    'Convert first sales',
    'Collect reviews and social proof',
    'Optimize conversion based on data',
    'Scale traffic and repeat'
  ],
  'High-Ticket Consultative Sales': [
    'Define ideal client and deal size',
    'Build target account list',
    'Research and personalize outreach',
    'Send first outreach batch',
    'Follow up and book calls',
    'Complete discovery and qualification calls',
    'Deliver value-first follow-up',
    'Present proposal or solution',
    'Handle objections',
    'Close deal',
    'Onboard client',
    'Expand and request referrals'
  ],
  'Retail / Local Offer Sales': [
    'Define local target customer',
    'Set up physical or local digital presence',
    'Create local offer and pricing',
    'Run local awareness campaign',
    'Convert first local customers',
    'Collect reviews and word of mouth',
    'Repeat and build loyalty'
  ],
  'Subscription / Recurring Revenue Sales': [
    'Define subscription offer and pricing',
    'Set up subscription infrastructure',
    'Create onboarding experience',
    'Drive first subscriber acquisition',
    'Onboard first subscribers',
    'Monitor churn and retention signals',
    'Optimize onboarding based on data',
    'Scale acquisition',
    'Build retention and expansion program'
  ],

  // Fundraising
  'Friends and Family Raise': [
    'Define raise amount and use of funds',
    'Prepare simple pitch or explanation',
    'Identify potential contributors in personal network',
    'Have initial conversations',
    'Send formal ask with documentation',
    'Follow up',
    'Close commitments',
    'Complete legal documentation',
    'Receive funds',
    'Send update to contributors'
  ],
  'Angel Raise': [
    'Define raise amount, valuation, and terms',
    'Prepare pitch deck',
    'Prepare financial model',
    'Identify target angel investors',
    'Secure warm introductions',
    'Send first outreach batch',
    'Follow up and book meetings',
    'Complete investor meetings',
    'Send follow-up materials',
    'Handle due diligence requests',
    'Close commitments',
    'Complete legal documentation',
    'Receive funds',
    'Send investor update'
  ],
  'Seed Round Raise': [
    'Define raise amount, valuation, and terms',
    'Prepare pitch deck',
    'Prepare financial model and data room',
    'Identify target seed funds and lead investors',
    'Secure warm introductions to leads',
    'Send first outreach to leads',
    'Follow up and book partner meetings',
    'Complete partner meetings',
    'Handle follow-on requests and due diligence',
    'Secure lead commitment',
    'Fill round with additional investors',
    'Complete legal documentation',
    'Close and receive funds',
    'Send investor update and begin reporting cadence'
  ],
  'Grant / Non-Dilutive Funding': [
    'Research eligible grant programs',
    'Confirm eligibility for target grants',
    'Prioritize grant applications by fit and timeline',
    'Gather required documentation',
    'Write grant application — narrative',
    'Write grant application — budget',
    'Internal review and revision',
    'Submit application',
    'Respond to follow-up requests if applicable',
    'Receive decision',
    'If awarded — complete grant acceptance documentation',
    'Begin reporting obligations'
  ],
  'Sponsorship / Partnership Raise': [
    'Define sponsorship value proposition',
    'Identify target sponsors or partners',
    'Build sponsorship deck or proposal',
    'Research and personalize outreach',
    'Send first outreach batch',
    'Follow up and book conversations',
    'Present sponsorship proposal',
    'Negotiate terms',
    'Close agreement',
    'Complete contract documentation',
    'Deliver sponsorship obligations',
    'Report results and renew conversation'
  ]
};

/**
 * Generate deterministic action graph for a canonical subtype.
 * @param {Object} goalPayload - Confirmed goal payload from Agent 1
 * @returns {Object} { actionGraph, errorCode }
 */
export function generateActionGraph(goalPayload) {
  if (!goalPayload || !goalPayload.goalId || !goalPayload.goalSubtype) {
    return { actionGraph: [], errorCode: ERROR_CODES.SUBTYPE_ACTION_SET_MISSING };
  }

  const canonicalActions = CANONICAL_ACTION_SETS[goalPayload.goalSubtype];
  if (!canonicalActions || canonicalActions.length === 0) {
    return { actionGraph: [], errorCode: ERROR_CODES.SUBTYPE_ACTION_SET_MISSING };
  }

  const goalId = goalPayload.goalId;
  const actionGraph = canonicalActions.map((title, idx) => {
    const actionId = `${goalId}-action-${idx + 1}`;
    return {
      actionId,
      title,
      dependsOn: idx === 0 ? [] : [`${goalId}-action-${idx}`],
      dependencyPosition: idx + 1,
      status: 'pending'
    };
  });

  // If the goal is already in progress, mark the first action as complete by default.
  if (goalPayload.currentStatus === 'IN_PROGRESS' && actionGraph[0]) {
    actionGraph[0].status = 'complete';
  }

  return { actionGraph, errorCode: null };
}

/**
 * Validate a dependency graph for cycles and missing references.
 * @param {Array} actionGraph
 * @returns {Object} validation result
 */
export function validateDependencyGraph(actionGraph) {
  if (!Array.isArray(actionGraph) || actionGraph.length === 0) {
    return {
      goalId: null,
      graphValidationStatus: 'INVALID',
      actionCount: 0,
      dependencyEdgeCount: 0,
      cyclesDetected: false,
      orphanedActions: [],
      validationFailures: [
        {
          actionId: null,
          failureType: 'EMPTY_ACTION_GRAPH',
          detail: 'No actions generated for goal'
        }
      ],
      readyForEstimation: false,
      errorCode: ERROR_CODES.EMPTY_ACTION_GRAPH
    };
  }

  const actionById = new Map(actionGraph.map(a => [a.actionId, a]));
  const dependencyEdgeCount = actionGraph.reduce((acc, a) => acc + (a.dependsOn?.length || 0), 0);

  // Orphaned actions: dependencies that don't exist
  const orphanedActions = actionGraph
    .filter(action => (action.dependsOn || []).some(dep => !actionById.has(dep)))
    .map(action => action.actionId);

  const cyclesDetected = detectDependencyCycle(actionGraph);

  const failures = [];
  if (orphanedActions.length) {
    failures.push({
      actionId: null,
      failureType: 'ORPHANED_ACTIONS',
      detail: `Actions have missing dependencies: ${orphanedActions.join(', ')}`
    });
  }
  if (cyclesDetected) {
    failures.push({
      actionId: null,
      failureType: 'CYCLE_DETECTED',
      detail: 'Dependency graph contains a cycle'
    });
  }

  const graphValid = !orphanedActions.length && !cyclesDetected;

  return {
    goalId: actionGraph[0]?.actionId?.split('-action-')?.[0] || null,
    graphValidationStatus: graphValid ? 'VALID' : 'INVALID',
    actionCount: actionGraph.length,
    dependencyEdgeCount,
    cyclesDetected,
    orphanedActions,
    validationFailures: failures,
    readyForEstimation: graphValid,
    errorCode: graphValid ? null : ERROR_CODES.INVALID_DEPENDENCY_GRAPH
  };
}

function detectDependencyCycle(actionGraph) {
  const graph = new Map();
  actionGraph.forEach(action => {
    graph.set(action.actionId, action.dependsOn || []);
  });

  const visited = new Set();
  const inStack = new Set();

  function dfs(node) {
    if (inStack.has(node)) return true;
    if (visited.has(node)) return false;

    visited.add(node);
    inStack.add(node);

    const neighbors = graph.get(node) || [];
    for (const next of neighbors) {
      if (dfs(next)) return true;
    }

    inStack.delete(node);
    return false;
  }

  for (const node of graph.keys()) {
    if (dfs(node)) return true;
  }

  return false;
}

/**
 * Apply user adjustments to the action graph.
 * - Can mark actions complete (for IN_PROGRESS goals)
 * - Can append a custom action at end (no downstream dependencies)
 */
export function applyActionGraphAdjustments(actionGraph, { completedActionIds = [], customActionTitle = null } = {}) {
  const updatedGraph = actionGraph.map(action => {
    if (completedActionIds.includes(action.actionId)) {
      return { ...action, status: 'complete' };
    }
    return action;
  });

  if (customActionTitle) {
    const lastAction = updatedGraph[updatedGraph.length - 1];
    const newActionId = `${lastAction?.actionId || 'action'}-custom`;
    updatedGraph.push({
      actionId: newActionId,
      title: customActionTitle,
      dependsOn: lastAction ? [lastAction.actionId] : [],
      dependencyPosition: (lastAction?.dependencyPosition || 0) + 1,
      status: 'pending'
    });
  }

  return updatedGraph;
}

/**
 * Confirm action graph for the user.
 */
export function confirmActionGraph(actionGraph, userChoice, options = {}) {
  const confirmed = { actionGraph, confirmationStatus: 'PENDING', errorCode: null };

  if (userChoice === 'correct') {
    confirmed.confirmationStatus = 'CONFIRMED';
    return confirmed;
  }

  if (userChoice === 'mark_complete') {
    confirmed.actionGraph = applyActionGraphAdjustments(actionGraph, {
      completedActionIds: options.completedActionIds || []
    });
    confirmed.confirmationStatus = 'CONFIRMED';
    return confirmed;
  }

  if (userChoice === 'append_action') {
    confirmed.actionGraph = applyActionGraphAdjustments(actionGraph, {
      customActionTitle: options.customActionTitle || 'Custom action'
    });
    confirmed.confirmationStatus = 'CONFIRMED';
    return confirmed;
  }

  // If user rejects, mark rejected
  confirmed.confirmationStatus = 'REJECTED';
  confirmed.errorCode = 'CONFIRMATION_REJECTED';
  return confirmed;
}
