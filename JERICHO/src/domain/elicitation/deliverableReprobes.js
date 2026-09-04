// Deliverable Intake Reprobes
//
// Gate failure messages for Deliverable intake slot (Section 6, Intake Path).
// Follows the reprobe authoring contract from reprobes.js.

export const DELIVERABLE_REPROBES = {
  DELIVERABLE_NAME_MISSING: {
    spine:
      "What's the name of this deliverable — the concrete thing that will be finished?",
    examples: {
      musician: 'e.g. the first album, the album artwork, the music video',
      founder: 'e.g. the landing page, the beta sign-ups, the pricing model',
      writer: 'e.g. the manuscript, the short story, the book outline',
      generic: 'e.g. the report, the prototype, the campaign copy',
    },
  },
  DELIVERABLE_NAME_NOT_HOLDABLE: {
    spine:
      "That looks like an action, not a deliverable — name the thing itself, not what you're doing to it.",
    examples: {
      musician: "e.g. 'Album artwork', not 'Design the artwork'",
      founder: "e.g. 'Landing page', not 'Build the landing page'",
      writer: "e.g. 'Book outline', not 'Outline the book'",
      generic: "e.g. 'The report', not 'Complete the report'",
    },
  },
  DELIVERABLE_PROJECT_MISSING: {
    spine: 'Which project does this deliverable belong to? Pick the parent project.',
    pickSet: 'declaredProjects',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  DELIVERABLE_EXECUTING_ENTITY_MISSING: {
    spine:
      'Which part of your operation will execute this deliverable? Pick the entity that will do the work.',
    pickSet: 'declaredEntities',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  DELIVERABLE_TARGET_DATE_MISSING: {
    spine:
      "When is this deliverable due — the date by which it must be finished and ready?",
    examples: {
      musician: 'e.g. 2026-12-31, 2027-03-15',
      founder: 'e.g. 2026-06-30, 2027-01-01',
      writer: 'e.g. 2026-08-30, 2027-02-28',
      generic: 'e.g. 2026-09-30, 2027-04-30',
    },
  },
  DELIVERABLE_TARGET_DATE_INVALID: {
    spine:
      "That's not a valid date format — please provide the date in YYYY-MM-DD format (e.g., 2026-12-31).",
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  DELIVERABLE_BUFFER_PAIR_INCOMPLETE: {
    spine:
      'Buffer anchor and buffer binding must be paired — either provide both or neither. If you need a buffer for blocked work, provide both; otherwise, leave both empty.',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
};
