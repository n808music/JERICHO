import { ARCHETYPE_MATRIX_1_0 } from './archetypeMatrix1_0';

export type RepresentativeGoalFixture = {
  archetype: string;
  subtype: string;
  representativeGoal: string;
  notes?: string;
};

export function normalizeLaneKey(archetype: string, subtype: string): string {
  return `${archetype}::${subtype}`;
}

export const REPRESENTATIVE_GOALS_1_0: RepresentativeGoalFixture[] = [
  {
    archetype: 'VentureLaunch',
    subtype: 'SaaS Product Launch',
    representativeGoal:
      'Launch a task-tracking SaaS MVP within 60 days with core feature set, landing page, pricing, and first 20 beta users ready.',
  },
  {
    archetype: 'VentureLaunch',
    subtype: 'Consumer Product Launch',
    representativeGoal:
      'Launch a caffeinated gum product in 75 days with product sample approved, packaging ready, product page live, and first sales campaign prepared.',
  },
  {
    archetype: 'VentureLaunch',
    subtype: 'Service Business Launch',
    representativeGoal:
      'Launch a project management consulting service in 30 days with offer, pricing, onboarding materials, and first 15 prospect outreaches completed.',
  },
  {
    archetype: 'VentureLaunch',
    subtype: 'Marketplace Launch',
    representativeGoal:
      'Launch a local freelancer marketplace in 90 days with service categories defined, first 10 providers onboarded, first customer campaign live, and matching flow working.',
  },
  {
    archetype: 'VentureLaunch',
    subtype: 'Local Business Launch',
    representativeGoal:
      'Launch a local mobile detailing business in 45 days with offer, booking process, local marketing assets, and first 10 customer leads generated.',
  },
  {
    archetype: 'SkillAcquisition',
    subtype: 'Software Skill Acquisition',
    representativeGoal: 'Learn React well enough in 45 days to build and publish two working portfolio projects.',
  },
  {
    archetype: 'SkillAcquisition',
    subtype: 'Design Skill Acquisition',
    representativeGoal:
      'Learn Figma in 30 days well enough to create three polished mobile app mockup sets for a portfolio.',
  },
  {
    archetype: 'SkillAcquisition',
    subtype: 'Communication Skill Acquisition',
    representativeGoal:
      'Improve public speaking in 21 days by completing daily speaking drills, three recorded practice talks, and one final polished presentation.',
  },
  {
    archetype: 'SkillAcquisition',
    subtype: 'Technical Trade Skill Acquisition',
    representativeGoal:
      'Learn the fundamentals of HVAC maintenance in 60 days well enough to complete five core diagnostic and maintenance procedures independently.',
  },
  {
    archetype: 'SkillAcquisition',
    subtype: 'Creative Skill Acquisition',
    representativeGoal:
      'Improve songwriting in 45 days by completing technique study, eight writing exercises, and three finished song drafts.',
  },
  {
    archetype: 'ProfessionalQualification',
    subtype: 'Certification Exam',
    representativeGoal:
      'Pass the AWS Certified Cloud Practitioner exam by May 15 with all domain review, three practice exams, and final review completed beforehand.',
  },
  {
    archetype: 'ProfessionalQualification',
    subtype: 'Licensure Exam',
    representativeGoal:
      'Prepare for and pass the real estate licensing exam within 90 days with registration, required study coverage, practice testing, and final readiness completed.',
  },
  {
    archetype: 'ProfessionalQualification',
    subtype: 'Compliance Training Completion',
    representativeGoal:
      'Complete all OSHA onboarding and compliance modules within 14 days with all assessments passed and required documentation submitted.',
  },
  {
    archetype: 'ProfessionalQualification',
    subtype: 'Portfolio-Based Qualification',
    representativeGoal:
      'Assemble a UX portfolio submission within 45 days with three polished case studies, supporting documentation, and final package review completed.',
  },
  {
    archetype: 'ProfessionalQualification',
    subtype: 'Interview-Based Qualification',
    representativeGoal:
      'Prepare for a graduate program interview in 21 days with likely questions, mock interviews, and final response refinement completed.',
  },
  {
    archetype: 'PhysicalTraining',
    subtype: 'Strength Program',
    representativeGoal:
      'Increase squat and bench strength over 12 weeks with program structure, benchmark testing, and final reassessment completed.',
  },
  {
    archetype: 'PhysicalTraining',
    subtype: 'Endurance Performance',
    representativeGoal:
      'Run a 5K in under 30 minutes within 8 weeks with base conditioning, speed benchmarks, and final race test completed.',
  },
  {
    archetype: 'PhysicalTraining',
    subtype: 'Weight Loss / Body Composition',
    representativeGoal:
      'Lose 15 pounds by July 1 with training adherence, weekly check-ins, mid-phase adjustment, and final review completed.',
  },
  {
    archetype: 'PhysicalTraining',
    subtype: 'Rehab Return to Training',
    representativeGoal:
      'Return to lifting safely after knee rehab within 10 weeks with movement restoration, readiness checkpoints, modified training block, and full reassessment completed.',
  },
  {
    archetype: 'PhysicalTraining',
    subtype: 'General Conditioning',
    representativeGoal:
      'Improve general fitness in 6 weeks with balanced routine adherence, weekly conditioning sessions, checkpoint tests, and final benchmark completed.',
  },
  {
    archetype: 'JobSearchPipeline',
    subtype: 'Corporate Role Search',
    representativeGoal:
      'Land a corporate project coordinator role within 60 days with tailored resume, target company list, first 20 applications, and interview prep completed.',
  },
  {
    archetype: 'JobSearchPipeline',
    subtype: 'Remote Knowledge Work Search',
    representativeGoal:
      'Land a remote operations role within 75 days with remote-ready positioning, first 25 applications, and remote interview readiness completed.',
  },
  {
    archetype: 'JobSearchPipeline',
    subtype: 'Creative Role Search',
    representativeGoal:
      'Land a junior designer role within 60 days with portfolio curation, targeted applications, and presentation/interview readiness completed.',
  },
  {
    archetype: 'JobSearchPipeline',
    subtype: 'Skilled Trade Role Search',
    representativeGoal:
      'Secure an entry HVAC technician role within 45 days with qualification proof, employer list, first outreach batch, and interview/job-readiness completed.',
  },
  {
    archetype: 'JobSearchPipeline',
    subtype: 'Career Transition Search',
    representativeGoal:
      'Transition from warehouse operations into project coordination within 90 days with transferable-skills narrative, targeted applications, and interview story bank completed.',
  },
  {
    archetype: 'CreativeProduction',
    subtype: 'TV / Series Writing',
    representativeGoal:
      'Develop a scripted TV pilot package in 90 days with premise, series bible, season arc, episode outlines, and pilot draft completed.',
  },
  {
    archetype: 'CreativeProduction',
    subtype: 'Podcast Production',
    representativeGoal:
      'Launch a 10-episode podcast season in 60 days with show concept, format, recording setup, first 3 episodes recorded, and publishing package completed.',
  },
  {
    archetype: 'CreativeProduction',
    subtype: 'Music Project Production',
    representativeGoal:
      'Complete a 5-song EP in 75 days with track list, draft songs, recording, cover art, and release-ready package completed.',
  },
  {
    archetype: 'CreativeProduction',
    subtype: 'Video Production',
    representativeGoal:
      'Produce a branded short video in 30 days with concept, script, shot plan, filmed footage, edit, and final delivery completed.',
  },
  {
    archetype: 'CreativeProduction',
    subtype: 'Book / Longform Writing',
    representativeGoal:
      'Write a 30,000-word nonfiction manuscript draft in 120 days with outline, chapter drafts, revision pass, and final manuscript package completed.',
  },
  {
    archetype: 'BrandLaunch',
    subtype: 'Personal Brand Launch',
    representativeGoal:
      'Launch a personal brand in 30 days with positioning, identity basics, profile assets, content pillars, and first 10 launch posts completed.',
  },
  {
    archetype: 'BrandLaunch',
    subtype: 'Business Brand Launch',
    representativeGoal:
      'Launch a consulting business brand in 45 days with strategy, messaging, visual identity, website basics, and launch collateral completed.',
  },
  {
    archetype: 'BrandLaunch',
    subtype: 'Product Brand Launch',
    representativeGoal:
      'Launch the brand for a new beverage product in 60 days with product positioning, packaging identity, product page assets, and launch campaign materials completed.',
  },
  {
    archetype: 'BrandLaunch',
    subtype: 'Artist / Creator Brand Launch',
    representativeGoal:
      'Launch an artist brand in 45 days with identity narrative, aesthetic system, profile refresh, media assets, and introduction content batch completed.',
  },
  {
    archetype: 'BrandLaunch',
    subtype: 'Campaign Brand Launch',
    representativeGoal:
      'Launch a summer campaign identity in 21 days with campaign theme, visual kit, collateral, rollout calendar, and first content batch completed.',
  },
  {
    archetype: 'SalesPipeline',
    subtype: 'B2B Service Sales',
    representativeGoal:
      'Generate the first 5 qualified consulting sales calls in 30 days with offer definition, ICP list, outreach messaging, and first 50 outreaches completed.',
  },
  {
    archetype: 'SalesPipeline',
    subtype: 'B2C Product Sales',
    representativeGoal:
      'Generate the first 50 online sales of a consumer product in 45 days with product page, conversion assets, first campaign launch, and sales tracking completed.',
  },
  {
    archetype: 'SalesPipeline',
    subtype: 'High-Ticket Consultative Sales',
    representativeGoal:
      'Close one $5,000 consulting engagement in 45 days with authority assets, target list, outreach sequence, and first three proposals completed.',
  },
  {
    archetype: 'SalesPipeline',
    subtype: 'Retail / Local Offer Sales',
    representativeGoal:
      'Generate the first 25 sales for a local weekend pop-up offer in 21 days with local promotion assets, sales setup, and first two outreach waves completed.',
  },
  {
    archetype: 'SalesPipeline',
    subtype: 'Subscription / Recurring Revenue Sales',
    representativeGoal:
      'Acquire the first 20 monthly subscribers for a paid newsletter in 30 days with offer, onboarding path, sales page, and first campaign sequence completed.',
  },
  {
    archetype: 'Fundraising',
    subtype: 'Friends and Family Raise',
    representativeGoal:
      'Raise $10,000 from friends and family in 30 days with target amount, simple deck, outreach list, and first conversations completed.',
  },
  {
    archetype: 'Fundraising',
    subtype: 'Angel Raise',
    representativeGoal:
      'Raise $100,000 from angel investors in 60 days with investor narrative, deck, target list, outreach sequence, and first meetings completed.',
  },
  {
    archetype: 'Fundraising',
    subtype: 'Seed Round Raise',
    representativeGoal:
      'Open a seed round in 75 days with fundraising thesis, institutional deck, investor map, outreach pipeline, and diligence materials completed.',
  },
  {
    archetype: 'Fundraising',
    subtype: 'Grant / Non-Dilutive Funding',
    representativeGoal:
      'Submit three high-fit grant applications within 45 days with eligibility review, materials, deadlines, and submissions completed.',
  },
  {
    archetype: 'Fundraising',
    subtype: 'Sponsorship / Partnership Raise',
    representativeGoal:
      'Secure three sponsor meetings in 30 days for a podcast launch with sponsorship package, target list, outreach sequence, and first proposals completed.',
  },
];

export function getRepresentativeGoals1_0() {
  return [...REPRESENTATIVE_GOALS_1_0];
}

export function getBoundedRepresentativeGoals1_0() {
  const byArchetype = new Set<string>();
  const bounded: RepresentativeGoalFixture[] = [];
  REPRESENTATIVE_GOALS_1_0.forEach((fixture) => {
    if (byArchetype.has(fixture.archetype)) return;
    byArchetype.add(fixture.archetype);
    bounded.push(fixture);
  });
  return bounded;
}

export function validateRepresentativeGoalMatrix(fixtures = REPRESENTATIVE_GOALS_1_0) {
  const matrixKeys = new Set<string>();
  ARCHETYPE_MATRIX_1_0.forEach((archetype) => {
    archetype.lanes.forEach((lane) => {
      matrixKeys.add(normalizeLaneKey(archetype.archetype, lane.subtype));
    });
  });

  const seen = new Set<string>();
  const duplicates: string[] = [];
  const unknown: string[] = [];
  fixtures.forEach((fixture) => {
    const key = normalizeLaneKey(fixture.archetype, fixture.subtype);
    if (seen.has(key)) duplicates.push(key);
    seen.add(key);
    if (!matrixKeys.has(key)) unknown.push(key);
  });

  const missing = Array.from(matrixKeys).filter((key) => !seen.has(key));

  return {
    totalFixtures: fixtures.length,
    duplicates,
    unknown,
    missing,
  };
}
