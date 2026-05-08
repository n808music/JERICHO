export type ArchetypeFixture = {
  archetype: 'ProfessionalQualification' | 'VentureLaunch' | 'GenericStructured';
  cycleId: string;
  contract: Record<string, unknown>;
  actions: Array<Record<string, unknown>>;
};

export const migratedArchetypeFixtures: ArchetypeFixture[] = [
  {
    archetype: 'ProfessionalQualification',
    cycleId: 'cycle-pq',
    contract: {},
    actions: [
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
        id: 'review:002:question-bank',
        title: 'Complete 200-question targeted question bank',
        deliverable: '200 practice questions answered with review of all incorrect answers',
        definitionOfDone: '200 questions complete, all wrong answers reviewed and understood.',
        estimateMin: 180,
        dependencies: ['practice:001:first-test'],
      },
      {
        id: 'finalprep:002:exam',
        title: 'Sit and complete the certification exam',
        deliverable: 'Exam completed and result received',
        definitionOfDone: 'Exam taken, result documented, pass/fail recorded.',
        estimateMin: 180,
        dependencies: ['review:002:question-bank'],
      },
    ],
  },
  {
    archetype: 'VentureLaunch',
    cycleId: 'cycle-vl',
    contract: {},
    actions: [
      {
        id: 'validate:001:customer-interviews',
        title: 'Conduct 5 customer discovery interviews',
        deliverable: 'Interview notes with top 3 recurring pain points identified',
        definitionOfDone: 'Five interviews completed, notes synthesized, primary pain point confirmed.',
        estimateMin: 120,
        dependencies: [],
      },
      {
        id: 'define:002:copy',
        title: 'Write landing page headline and body copy',
        deliverable: 'Headline, subheadline, 3 benefit bullets, and CTA copy',
        definitionOfDone: 'Copy reviewed, headline passes 5-second clarity test.',
        estimateMin: 90,
        dependencies: ['validate:001:customer-interviews'],
      },
      {
        id: 'build:002:page',
        title: 'Build landing page in chosen platform',
        deliverable: 'Live landing page with email capture form deployed to domain',
        definitionOfDone: 'Page live, form submits correctly, mobile responsive confirmed.',
        estimateMin: 180,
        dependencies: ['define:002:copy'],
      },
      {
        id: 'launch:002:distribution',
        title: 'Post in 3 relevant online communities',
        deliverable: 'Posts live in 3 communities with engagement monitored for 48 hours',
        definitionOfDone: 'Three posts published, links tracked, at least one response received.',
        estimateMin: 90,
        dependencies: ['build:002:page'],
      },
    ],
  },
  {
    archetype: 'GenericStructured',
    cycleId: 'cycle-tv',
    contract: { goalText: 'Write the first season of my TV show' },
    actions: [
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
  },
];
