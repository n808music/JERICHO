// Initiative slot reprobes. Merge into REPROBES alongside entity/project/VS.
//
// Two pickSet-bearing gates keep example rows empty (the operator picks):
//   - INITIATIVE_OWNER_UNRESOLVED  → 'initiativeOwnerOptions'
//   - INITIATIVE_CLASSIFICATION_*  → 'classificationOptions'
//
// The classification probe IS the goal-relative ask-don't-infer question — it
// asks whether this undertaking is something the plan works TOWARD or works
// AROUND, relative to the declared goal.

export const INITIATIVE_REPROBES = {
  INITIATIVE_NAME_MISSING: {
    spine:
      "What's this undertaking called — the mission you'd say you're 'working on'?",
    examples: {
      musician: 'e.g. ship the OFL release spine, the marketing slate',
      founder: 'e.g. the beta launch, securing the seed round',
      writer: 'e.g. finishing the trilogy, the agent search',
      generic: 'e.g. the campaign, the rollout, the funding push',
    },
  },
  INITIATIVE_NAME_NOT_HOLDABLE: {
    spine:
      "Name the undertaking itself, not the act of doing it — a thing you can point at.",
    examples: {
      musician: "e.g. 'the OFL release spine', not 'releasing music'",
      founder: "e.g. 'the seed round', not 'raising money'",
      writer: "e.g. 'the agent search', not 'finding an agent'",
      generic: "e.g. 'the Q3 rollout', not 'rolling things out'",
    },
  },
  INITIATIVE_OWNER_UNRESOLVED: {
    spine:
      'Which entities own this undertaking? Pick every entity involved — or mark it cross-cutting if it belongs to the whole operation.',
    pickSet: 'initiativeOwnerOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  INITIATIVE_PURPOSE_MISSING: {
    spine: 'What is this undertaking for? Say what completing it accomplishes.',
    examples: {
      musician: 'e.g. consolidate the catalog into one release arc that grows the audience',
      founder: 'e.g. prove the product with paying users before the runway ends',
      writer: 'e.g. get the finished trilogy in front of agents',
      generic: 'e.g. secure the funding that lets the capital-heavy lanes start',
    },
  },
  INITIATIVE_PURPOSE_NOT_SUBSTANTIVE: {
    spine:
      "Too vague — name the concrete thing completing this gets you, not a general aim.",
    examples: {
      musician: "e.g. '7 tapes released building to the terminal album', not 'grow the brand'",
      founder: "e.g. '100 paying users proving demand', not 'achieve traction'",
      writer: "e.g. 'a finished manuscript out to 20 agents', not 'advance my career'",
      generic: "e.g. 'funding secured to open the first site', not 'enable growth'",
    },
  },
  INITIATIVE_CLASSIFICATION_MISSING: {
    spine:
      'Is this undertaking something the plan should work TOWARD, or a reality it should work AROUND? Pick one — it sets how the plan treats this.',
    pickSet: 'classificationOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  INITIATIVE_CLASSIFICATION_INVALID: {
    spine: 'Pick either objective (the plan works toward it) or constraint (the plan works around it).',
    pickSet: 'classificationOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  INITIATIVE_DONEWHEN_MISSING: {
    spine:
      "When is this undertaking done? Name the condition that ends it — and it has to be checkable in the real world.",
    examples: {
      musician: 'e.g. the terminal album is live on Spotify for Artists',
      founder: 'e.g. 100 paying users showing in Stripe',
      writer: 'e.g. the manuscript is signed by an agent',
      generic: 'e.g. the funding is closed and in the bank account',
    },
  },
  INITIATIVE_DONEWHEN_NOT_VERIFIABLE: {
    spine:
      "That's not checkable from outside — name the external proof it's done, not a 'done' status.",
    examples: {
      musician: "e.g. 'live on Spotify for Artists', not 'the release is finished'",
      founder: "e.g. '100 users in Stripe', not 'we hit our goal'",
      writer: "e.g. 'signed by an agent', not 'the search is complete'",
      generic: "e.g. 'funds in the bank', not 'the round is done'",
    },
  },
};
