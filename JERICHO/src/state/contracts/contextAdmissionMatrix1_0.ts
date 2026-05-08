import { ARCHETYPE_MATRIX_1_0 } from './archetypeMatrix1_0';

export type ContextImpactType =
  | 'output_scope'
  | 'output_type'
  | 'action_complexity'
  | 'schedule_intensity'
  | 'dependency_ordering'
  | 'success_definition'
  | 'risk_correction_logic';

export type ContextQuestion = {
  id: string;
  text: string;
  required: boolean;
  impacts: ContextImpactType[];
};

export type LaneContextSpec = {
  archetype: string;
  subtype: string;
  requiredQuestions: ContextQuestion[];
  optionalQuestions: ContextQuestion[];
  defaultAssumptions: string[];
  planImpactFields: ContextImpactType[];
};

export type LaneContextSelection = {
  archetype: string;
  subtype: string;
  requiredQuestionsToAsk: ContextQuestion[];
  optionalQuestionsToAsk: ContextQuestion[];
  assumptionsApplied: string[];
  confirmationRequired: boolean;
};

type LaneAuthoredQuestions = {
  required: [string, string, string];
  optional: [string, string];
};

function laneKey(archetype: string, subtype: string): string {
  return `${archetype}::${subtype}`;
}

const ARCHETYPE_DEFAULTS: Record<string, { defaults: string[]; impacts: ContextImpactType[] }> = {
  VentureLaunch: {
    defaults: [
      'Launch defaults to first viable market release',
      'Starting state defaults to partial readiness',
      'Weekly capacity defaults to moderate',
    ],
    impacts: [
      'output_scope',
      'action_complexity',
      'schedule_intensity',
      'dependency_ordering',
      'success_definition',
      'risk_correction_logic',
    ],
  },
  SkillAcquisition: {
    defaults: [
      'Success defaults to practical output demonstration',
      'Current level defaults to beginner-intermediate',
      'Practice capacity defaults to moderate',
    ],
    impacts: ['output_type', 'action_complexity', 'schedule_intensity', 'success_definition', 'risk_correction_logic'],
  },
  ProfessionalQualification: {
    defaults: [
      'Qualification timeline defaults to contract deadline',
      'Readiness defaults to beginner-intermediate',
      'Prep capacity defaults to moderate',
    ],
    impacts: [
      'output_scope',
      'dependency_ordering',
      'schedule_intensity',
      'success_definition',
      'risk_correction_logic',
    ],
  },
  PhysicalTraining: {
    defaults: [
      'Outcome defaults to measurable benchmark improvement',
      'Baseline defaults to low-to-moderate readiness',
      'Session capacity defaults to 3 sessions/week',
    ],
    impacts: ['output_type', 'action_complexity', 'schedule_intensity', 'success_definition', 'risk_correction_logic'],
  },
  JobSearchPipeline: {
    defaults: [
      'Role target defaults to one role family',
      'Materials default to partially ready',
      'Success defaults to interview traction',
    ],
    impacts: ['output_scope', 'action_complexity', 'schedule_intensity', 'success_definition', 'risk_correction_logic'],
  },
  CreativeProduction: {
    defaults: [
      'Done state defaults to release-ready core package',
      'Starting assets default to partial readiness',
      'Production capacity defaults to moderate',
    ],
    impacts: ['output_scope', 'output_type', 'action_complexity', 'schedule_intensity', 'risk_correction_logic'],
  },
  BrandLaunch: {
    defaults: [
      'Success defaults to essential identity plus first rollout',
      'Positioning defaults to partially defined',
      'Scope defaults to 1-2 primary channels',
    ],
    impacts: ['output_scope', 'output_type', 'schedule_intensity', 'dependency_ordering', 'risk_correction_logic'],
  },
  SalesPipeline: {
    defaults: [
      'Offer defaults to partially sharpened',
      'Target list defaults to incomplete',
      'Success defaults to qualified pipeline traction',
    ],
    impacts: ['output_scope', 'action_complexity', 'schedule_intensity', 'success_definition', 'risk_correction_logic'],
  },
  Fundraising: {
    defaults: [
      'Raise scope defaults to stage-appropriate target',
      'Materials default to partial readiness',
      'Conversation capacity defaults to moderate',
    ],
    impacts: [
      'output_scope',
      'output_type',
      'dependency_ordering',
      'schedule_intensity',
      'success_definition',
      'risk_correction_logic',
    ],
  },
};

const LANE_AUTHORED_QUESTIONS_1_0: Record<string, LaneAuthoredQuestions> = {
  [laneKey('VentureLaunch', 'SaaS Product Launch')]: {
    required: [
      'What counts as launch by the deadline: MVP built, beta live, or public launch?',
      'Do you already have a working prototype or are you starting from scratch?',
      'How many hours per week can you realistically commit?',
    ],
    optional: [
      'Is this a solo build or team-supported build?',
      'Do you already know the core feature set and target user?',
    ],
  },
  [laneKey('VentureLaunch', 'Consumer Product Launch')]: {
    required: [
      'Is the product already prototyped, or does product development still need to happen?',
      'What counts as launch: sample approved, first inventory ready, or sales page live with launch campaign prepared?',
      'Are sourcing and production partners already identified?',
    ],
    optional: ['Do branding and packaging already exist?', 'How much weekly time can you commit?'],
  },
  [laneKey('VentureLaunch', 'Service Business Launch')]: {
    required: [
      'Is the service offer already clearly defined or still being designed?',
      'What counts as launch by deadline: offer packaged, first outreach sent, or first client booked?',
      'Are you launching solo or with any support/resources already in place?',
    ],
    optional: ['Do you already have onboarding/client materials?', 'How many hours per week can you devote?'],
  },
  [laneKey('VentureLaunch', 'Marketplace Launch')]: {
    required: [
      'Which side is the bigger current gap: supply side, demand side, or both equally?',
      'What counts as launch: platform setup, first suppliers onboarded, or first real match/transaction?',
      'Is the marketplace logic already defined, or still exploratory?',
    ],
    optional: [
      'Are you building tech from scratch or using lightweight tools/manual operations?',
      'How much weekly capacity do you have?',
    ],
  },
  [laneKey('VentureLaunch', 'Local Business Launch')]: {
    required: [
      'Is the offer already defined and operationally ready, or still being built?',
      'What counts as launch: local presence ready, first promotion live, or first customers served?',
      'Is location/service-area setup already handled?',
    ],
    optional: ['Do you already have brand/marketing assets?', 'How many hours per week can you commit?'],
  },

  [laneKey('SkillAcquisition', 'Software Skill Acquisition')]: {
    required: [
      'What proof of skill counts as success: one working project, multiple portfolio projects, or job-readiness?',
      'What is your current level: beginner, intermediate, or returning/rusty?',
      'How many hours per week can you realistically practice/build?',
    ],
    optional: [
      'Do you already have the tools/environment set up?',
      'Is there a specific sub-skill or project type you want to focus on?',
    ],
  },
  [laneKey('SkillAcquisition', 'Design Skill Acquisition')]: {
    required: [
      'What proof of skill counts as success: mockups, case studies, or a small portfolio set?',
      'What is your current level with the design tools/process?',
      'How many hours per week can you commit to practice and output creation?',
    ],
    optional: [
      'Is there a specific design domain: product, branding, UI, social, etc.?',
      'Do you already have work to revise, or are you starting new?',
    ],
  },
  [laneKey('SkillAcquisition', 'Communication Skill Acquisition')]: {
    required: [
      'What communication outcome matters most: speaking, writing, persuasion, or presentation?',
      'What counts as success by deadline: improved reps, recorded samples, or a real presentation/performance?',
      'How often can you practice each week?',
    ],
    optional: [
      'Do you already have a real-world event/use case tied to this skill?',
      'Are you more blocked by confidence, structure, or delivery quality?',
    ],
  },
  [laneKey('SkillAcquisition', 'Technical Trade Skill Acquisition')]: {
    required: [
      'What specific tasks or procedures do you need to be able to perform by deadline?',
      'Are you training with supervision/guidance available, or mostly independently?',
      'What counts as success: knowledge familiarity, supervised reps, or independent competency?',
    ],
    optional: [
      'Are safety/compliance requirements part of this skill target?',
      'How many weekly hours of hands-on practice are realistic?',
    ],
  },
  [laneKey('SkillAcquisition', 'Creative Skill Acquisition')]: {
    required: [
      'What counts as success: improved technique, finished pieces, or a mini portfolio/showcase?',
      'What is your current level in the creative skill?',
      'How many hours per week can you commit to practice and finishing work?',
    ],
    optional: [
      'Is there a style or medium you want to focus on?',
      'Are you optimizing more for quantity of reps or quality of finished pieces?',
    ],
  },

  [laneKey('ProfessionalQualification', 'Certification Exam')]: {
    required: [
      'What is the exact certification and target test date or deadline?',
      'What is your current familiarity level with the material?',
      'How many hours per week can you realistically study?',
    ],
    optional: [
      'Are you already registered for the exam?',
      'Do you have preferred prep materials or practice exam access already?',
    ],
  },
  [laneKey('ProfessionalQualification', 'Licensure Exam')]: {
    required: [
      'What licensure exam and jurisdiction are you targeting?',
      'Are the application/eligibility requirements already completed?',
      'What is your current readiness level and available study time?',
    ],
    optional: ['Is the exam date fixed or flexible?', 'Are there mandatory prerequisites still pending?'],
  },
  [laneKey('ProfessionalQualification', 'Compliance Training Completion')]: {
    required: [
      'What exact training/compliance requirement must be completed?',
      'Are all modules/materials already accessible?',
      'What is the hard deadline or consequence date?',
    ],
    optional: [
      'Are assessments involved, or just completion confirmation?',
      'How many hours can you allocate before the deadline?',
    ],
  },
  [laneKey('ProfessionalQualification', 'Portfolio-Based Qualification')]: {
    required: [
      'What exact qualification are you seeking, and what work samples are required?',
      'Do you already have usable material, or are you creating pieces from scratch?',
      'What counts as done: submission package ready or final submission sent?',
    ],
    optional: [
      'How many pieces/case studies are required?',
      'How much weekly time is realistic for creation and refinement?',
    ],
  },
  [laneKey('ProfessionalQualification', 'Interview-Based Qualification')]: {
    required: [
      'What is the interview for, and what type of evaluation is expected?',
      'Is the interview date fixed?',
      'What is your current readiness/confidence level?',
    ],
    optional: ['Do you already know likely questions or themes?', 'Will you have time for mock interviews/rehearsal?'],
  },

  [laneKey('PhysicalTraining', 'Strength Program')]: {
    required: [
      'What specific lifts or strength outcomes matter by deadline?',
      'What is your current training level and baseline?',
      'How many training sessions per week are realistic?',
    ],
    optional: [
      'Do you have any pain, injury, or recovery limitations?',
      'Do you already have equipment/access needed?',
    ],
  },
  [laneKey('PhysicalTraining', 'Endurance Performance')]: {
    required: [
      'What exact event or benchmark are you targeting?',
      'What is your current endurance baseline?',
      'How many sessions per week and what time horizon are realistic?',
    ],
    optional: ['Is the deadline/event date fixed?', 'Are you limited by injury, environment, or equipment?'],
  },
  [laneKey('PhysicalTraining', 'Weight Loss / Body Composition')]: {
    required: [
      'What exact body-state target and deadline are you aiming for?',
      'Are you already training and tracking, or starting a new structure?',
      'How much weekly time and daily adherence effort are realistic?',
    ],
    optional: [
      'Is the priority scale weight, appearance, body-fat estimate, or habit consistency?',
      'Are there dietary or recovery constraints that materially affect the plan?',
    ],
  },
  [laneKey('PhysicalTraining', 'Rehab Return to Training')]: {
    required: [
      'What injury/limitation are you recovering from?',
      'What counts as success by deadline: pain-free movement, modified return, or full return to training?',
      'Do you have medical or rehab guidance to follow?',
    ],
    optional: [
      'What current movements are pain-free vs restricted?',
      'How many short rehab sessions per week are realistic?',
    ],
  },
  [laneKey('PhysicalTraining', 'General Conditioning')]: {
    required: [
      'What does better general fitness mean for you: energy, consistency, conditioning, or broad baseline improvement?',
      'What is your current baseline and activity level?',
      'How many sessions per week are realistic?',
    ],
    optional: [
      'Do you prefer home, gym, or mixed training?',
      'Are there any injury/time constraints that limit exercise choice?',
    ],
  },

  [laneKey('JobSearchPipeline', 'Corporate Role Search')]: {
    required: [
      'What target role/title family are you pursuing?',
      'Do you already have a current resume and recent relevant experience?',
      'What counts as success by deadline: applications submitted, interviews booked, or offer received?',
    ],
    optional: [
      'Are geography and work mode flexible?',
      'How many applications/outreach actions per week are realistic?',
    ],
  },
  [laneKey('JobSearchPipeline', 'Remote Knowledge Work Search')]: {
    required: [
      'What type of remote role are you targeting?',
      'Do you already have remote-friendly resume/profile assets?',
      'What counts as success by deadline: applications launched, interviews, or accepted offer?',
    ],
    optional: [
      'Do you have portfolio/proof-of-work assets?',
      'How many applications or networking actions per week are realistic?',
    ],
  },
  [laneKey('JobSearchPipeline', 'Creative Role Search')]: {
    required: [
      'What exact creative role are you targeting?',
      'Do you already have a portfolio or work samples?',
      'What counts as success: portfolio ready, interviews booked, or role landed?',
    ],
    optional: [
      'Are you targeting employment, contract work, or both?',
      'How many applications/outreach actions per week are realistic?',
    ],
  },
  [laneKey('JobSearchPipeline', 'Skilled Trade Role Search')]: {
    required: [
      'What trade role are you targeting?',
      'Do you already have qualifications, certifications, or proof-of-work needed?',
      'What counts as success by deadline: outreach launched, interviews booked, or job secured?',
    ],
    optional: ['Is geography flexible?', 'How many employer contacts per week are realistic?'],
  },
  [laneKey('JobSearchPipeline', 'Career Transition Search')]: {
    required: [
      'From what background into what target role are you transitioning?',
      'Do you already have a resume/story that explains the transition?',
      'What counts as success by deadline: materials ready, active search pipeline, interviews, or offer?',
    ],
    optional: [
      'Do you have any bridge projects, certifications, or proof assets?',
      'How many applications/networking actions per week are realistic?',
    ],
  },

  [laneKey('CreativeProduction', 'TV / Series Writing')]: {
    required: [
      'What counts as done by deadline: concept package, pilot draft, or broader season package?',
      'Do you already have the premise/world/characters defined?',
      'How many writing hours per week are realistic?',
    ],
    optional: [
      'Is this a solo writing project or collaborative?',
      'Are you prioritizing one polished pilot or a fuller season framework?',
    ],
  },
  [laneKey('CreativeProduction', 'Podcast Production')]: {
    required: [
      'What counts as launch: trailer only, first episode, or first batch of episodes?',
      'Audio only or video podcast?',
      'Do you already have the concept/format and recording setup?',
    ],
    optional: [
      'Solo-hosted or co-hosted/guest-based?',
      'How many hours per week are realistic for prep, recording, and editing?',
    ],
  },
  [laneKey('CreativeProduction', 'Music Project Production')]: {
    required: [
      'What counts as done: draft songs, finished songs, or release-ready package?',
      'How much of the music already exists: concept only, demos, or partially finished tracks?',
      'Are you producing/recording solo or with collaborators/resources already in place?',
    ],
    optional: ['How many hours per week can you commit?', 'Are artwork and release assets already started?'],
  },
  [laneKey('CreativeProduction', 'Video Production')]: {
    required: [
      'What counts as done by deadline: concept package, filmed footage, or final delivered edit?',
      'Do you already have script/treatment and production resources?',
      'Is this solo, small-team, or externally supported production?',
    ],
    optional: ['How many shoot days are realistic?', 'Is editing being done by you or someone else?'],
  },
  [laneKey('CreativeProduction', 'Book / Longform Writing')]: {
    required: [
      'What counts as success by deadline: outline, partial draft, full draft, or revised manuscript?',
      'Do you already have a concept and outline?',
      'How many writing hours per week are realistic?',
    ],
    optional: [
      'Is research a major part of the project?',
      'Are you optimizing for speed of draft completion or quality of revision?',
    ],
  },

  [laneKey('BrandLaunch', 'Personal Brand Launch')]: {
    required: [
      'What counts as launch: identity defined, profile rollout complete, or first content batch published?',
      'Do you already have a clear audience/positioning?',
      'Which channels matter most for this launch?',
    ],
    optional: [
      'Do you already have visual identity assets?',
      'How much weekly time can you spend on content and setup?',
    ],
  },
  [laneKey('BrandLaunch', 'Business Brand Launch')]: {
    required: [
      'Is the business offer already defined, or is branding happening while the offer is still evolving?',
      'What counts as launch: brand system ready, website/live touchpoints ready, or full public rollout?',
      'Which customer-facing touchpoints matter most right now?',
    ],
    optional: [
      'Do you already have any messaging or visual assets?',
      'How many weekly hours can go toward branding work?',
    ],
  },
  [laneKey('BrandLaunch', 'Product Brand Launch')]: {
    required: [
      'Is the product itself already defined and prototyped?',
      'What counts as launch: packaging/identity complete, product page live, or campaign-ready brand release?',
      'Which assets matter most: packaging, page assets, or launch collateral?',
    ],
    optional: ['Do you already have naming/positioning?', 'How much weekly time can be dedicated?'],
  },
  [laneKey('BrandLaunch', 'Artist / Creator Brand Launch')]: {
    required: [
      'What counts as launch: identity system, refreshed profiles, or first public introduction/content wave?',
      'Do you already have a clear artistic narrative and aesthetic direction?',
      'Which channels/platforms matter most to the rollout?',
    ],
    optional: [
      'Do you already have usable photos/video/media assets?',
      'How many weekly hours can go toward content and rollout execution?',
    ],
  },
  [laneKey('BrandLaunch', 'Campaign Brand Launch')]: {
    required: [
      'What is the campaign and what exact date or window matters?',
      'What counts as launch: theme/message approved, assets ready, or campaign activated publicly?',
      'Which channels or collateral types matter most?',
    ],
    optional: [
      'Do you already have campaign visuals or copy foundations?',
      'How much time is available before activation?',
    ],
  },

  [laneKey('SalesPipeline', 'B2B Service Sales')]: {
    required: [
      'What exact offer are you selling?',
      'Do you already know your ideal customer profile and have a prospect list?',
      'What counts as success by deadline: outreach sent, calls booked, proposals delivered, or sales closed?',
    ],
    optional: ['Do you already have case studies/proof assets?', 'How many outreach actions per week are realistic?'],
  },
  [laneKey('SalesPipeline', 'B2C Product Sales')]: {
    required: [
      'Is the product and sales page already ready, or still being built?',
      'What counts as success by deadline: first campaign live, first sales, or sales target hit?',
      'Which channels will be used to generate demand?',
    ],
    optional: [
      'Are visual assets and conversion copy already created?',
      'How much weekly time can go toward campaign execution and optimization?',
    ],
  },
  [laneKey('SalesPipeline', 'High-Ticket Consultative Sales')]: {
    required: [
      'What exact high-ticket offer are you selling?',
      'Do you already have proof/authority assets and a defined buyer profile?',
      'What counts as success by deadline: conversations, proposals, or closed deal?',
    ],
    optional: [
      'Are you selling warm relationships or cold pipeline?',
      'How many outreach or sales conversations per week are realistic?',
    ],
  },
  [laneKey('SalesPipeline', 'Retail / Local Offer Sales')]: {
    required: [
      'What is the local/retail offer?',
      'What counts as success: promotion launched, inquiries generated, or sales completed?',
      'What local channels or locations are most relevant?',
    ],
    optional: [
      'Do you already have promotion assets and sales handling process?',
      'How much time can go to outreach/promo and response handling each week?',
    ],
  },
  [laneKey('SalesPipeline', 'Subscription / Recurring Revenue Sales')]: {
    required: [
      'What recurring offer are you selling?',
      'What counts as success by deadline: first campaign live, first subscribers, or retention-ready system?',
      'Do you already have onboarding/conversion assets in place?',
    ],
    optional: ['What customer profile are you targeting?', 'How many acquisition actions per week are realistic?'],
  },

  [laneKey('Fundraising', 'Friends and Family Raise')]: {
    required: [
      'What amount are you trying to raise, and by when?',
      'What counts as success: outreach complete, commitments received, or funds collected?',
      'Do you already have a target list and simple ask materials?',
    ],
    optional: [
      'Is the structure informal support, loan, or equity-like ask?',
      'How many conversations can you realistically initiate each week?',
    ],
  },
  [laneKey('Fundraising', 'Angel Raise')]: {
    required: [
      'What amount are you raising and what stage are you at?',
      'Do you already have a deck and investor list?',
      'What counts as success by deadline: meetings booked, diligence started, or commitments secured?',
    ],
    optional: ['What traction/proof do you currently have?', 'How many investor conversations per week are realistic?'],
  },
  [laneKey('Fundraising', 'Seed Round Raise')]: {
    required: [
      'What exact round target and timing are you aiming for?',
      'Do you already have institutional-grade deck, traction story, and investor map?',
      'What counts as success by deadline: round opened, meetings/diligence active, or commitments closed?',
    ],
    optional: [
      'Is there a data room or diligence package already started?',
      'How many investor interactions per week are realistic?',
    ],
  },
  [laneKey('Fundraising', 'Grant / Non-Dilutive Funding')]: {
    required: [
      'What kinds of grants/non-dilutive programs are you targeting?',
      'Do you already know the eligibility criteria and deadlines?',
      'What counts as success: applications prepared, submitted, or decisions returned?',
    ],
    optional: [
      'Do reusable materials already exist?',
      'How many opportunities can you realistically pursue in the window?',
    ],
  },
  [laneKey('Fundraising', 'Sponsorship / Partnership Raise')]: {
    required: [
      'What are you offering potential sponsors/partners in return?',
      'Do you already have a sponsorship package/deck and target partner list?',
      'What counts as success: outreach launched, meetings booked, or active proposal negotiations?',
    ],
    optional: [
      'Are you seeking cash sponsorship, in-kind support, or both?',
      'How many partner conversations per week are realistic?',
    ],
  },
};

function makeQuestion(
  archetype: string,
  subtype: string,
  index: number,
  text: string,
  required: boolean,
  impacts: ContextImpactType[]
) {
  return {
    id: `${archetype}.${subtype}.${required ? 'required' : 'optional'}.${index + 1}`
      .toLowerCase()
      .replace(/[^a-z0-9.]+/g, '_'),
    text,
    required,
    impacts,
  } satisfies ContextQuestion;
}

function fallbackSpec(archetype: string, subtype: string): LaneContextSpec {
  const defaults = ARCHETYPE_DEFAULTS[archetype];
  const impacts = defaults?.impacts ?? [
    'output_scope',
    'output_type',
    'action_complexity',
    'schedule_intensity',
    'dependency_ordering',
    'success_definition',
    'risk_correction_logic',
  ];

  return {
    archetype,
    subtype,
    requiredQuestions: [
      makeQuestion(archetype, subtype, 0, 'What does success by deadline mean for this lane?', true, impacts),
      makeQuestion(archetype, subtype, 1, 'What is your current starting state/readiness?', true, impacts),
      makeQuestion(archetype, subtype, 2, 'What weekly execution capacity is realistic?', true, impacts),
    ],
    optionalQuestions: [
      makeQuestion(archetype, subtype, 0, 'Any additional constraints to account for?', false, impacts),
      makeQuestion(archetype, subtype, 1, 'Any preference on scope versus speed?', false, impacts),
    ],
    defaultAssumptions: defaults?.defaults ?? [
      'Success defaults to lane-complete output',
      'Starting state defaults to partial readiness',
      'Capacity defaults to moderate',
    ],
    planImpactFields: impacts,
  };
}

export function getLaneContextSpec(archetype: string, subtype: string): LaneContextSpec {
  const authored = LANE_AUTHORED_QUESTIONS_1_0[laneKey(archetype, subtype)];
  const defaults = ARCHETYPE_DEFAULTS[archetype];
  if (!authored || !defaults) {
    return fallbackSpec(archetype, subtype);
  }

  const impacts = defaults.impacts;
  return {
    archetype,
    subtype,
    requiredQuestions: authored.required.map((text, index) =>
      makeQuestion(archetype, subtype, index, text, true, impacts)
    ),
    optionalQuestions: authored.optional.map((text, index) =>
      makeQuestion(archetype, subtype, index, text, false, impacts)
    ),
    defaultAssumptions: [...defaults.defaults],
    planImpactFields: [...impacts],
  };
}

export function listAllLaneContextSpecs() {
  return ARCHETYPE_MATRIX_1_0.flatMap((archetype) =>
    archetype.lanes.map((lane) => getLaneContextSpec(archetype.archetype, lane.subtype))
  );
}

export function listLaneAuthoredQuestionCoverage() {
  const canonicalLaneKeys = ARCHETYPE_MATRIX_1_0.flatMap((archetype) =>
    archetype.lanes.map((lane) => laneKey(archetype.archetype, lane.subtype))
  );
  const authoredKeys = new Set(Object.keys(LANE_AUTHORED_QUESTIONS_1_0));
  const missingAuthored = canonicalLaneKeys.filter((key) => !authoredKeys.has(key));
  return {
    canonicalLaneCount: canonicalLaneKeys.length,
    authoredLaneCount: authoredKeys.size,
    missingAuthored,
  };
}

export function selectContextQuestionsForLane({
  archetype,
  subtype,
  answeredQuestionIds = [],
  askOptional = false,
}: {
  archetype: string;
  subtype: string;
  answeredQuestionIds?: string[];
  askOptional?: boolean;
}): LaneContextSelection {
  const spec = getLaneContextSpec(archetype, subtype);
  const answered = new Set((answeredQuestionIds || []).filter(Boolean));

  const requiredQuestionsToAsk = spec.requiredQuestions.filter((question) => !answered.has(question.id)).slice(0, 3);
  const optionalQuestionsToAsk =
    askOptional && requiredQuestionsToAsk.length === 0
      ? spec.optionalQuestions.filter((question) => !answered.has(question.id)).slice(0, 2)
      : [];

  const unansweredRequired = spec.requiredQuestions.filter((question) => !answered.has(question.id)).length;

  return {
    archetype,
    subtype,
    requiredQuestionsToAsk,
    optionalQuestionsToAsk,
    assumptionsApplied: unansweredRequired > 0 ? [...spec.defaultAssumptions] : [],
    confirmationRequired: unansweredRequired > 0,
  };
}
