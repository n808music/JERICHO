// Initiative slot reprobes. Merge into REPROBES alongside entity/project/VS.
//
// One pickSet-bearing gate keeps its example row empty (the operator picks):
//   - INITIATIVE_OWNER_UNRESOLVED  → 'initiativeOwnerOptions'

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
  // ── roleTags: system | project (multi-select) ─────────────────────────
  // Determines which Purpose question variant fires. Multi-select allows
  // dual-tagged initiatives (e.g., "The Jericho System" is both).
  INITIATIVE_ROLETAGS_MISSING: {
    spine:
      'What kind of undertaking is this? Pick everything that applies — an ongoing system you maintain, a bounded project you complete, or both.',
    pickSet: 'initiativeRoleTagOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  INITIATIVE_ROLETAGS_INVALID: {
    spine:
      'Pick one or more: system (ongoing) or project (bounded). Those are the only kinds recognized here.',
    pickSet: 'initiativeRoleTagOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  // ── purpose (split into three conditional variants) ────────────────────
  // All initiatives answer: "What does it do?" (mechanism) and "What is it for?" (purpose).
  // Additional question(s) depend on roleTags:
  //   - "project" → "What does completing it accomplish?"
  //   - "system" → "What does this produce while running?" (ongoing output)
  //   - both → both questions fire (non-redundant: completion value vs ongoing value)
  INITIATIVE_PURPOSE_MISSING: {
    spine: 'What does this undertaking do? Say what it does in one sentence.',
    examples: {
      musician: 'e.g. consolidates the catalog into one release arc',
      founder: 'e.g. proves the product works with real users',
      writer: 'e.g. gets the finished trilogy in front of agents',
      generic: 'e.g. secures the funding needed to start capital-heavy work',
    },
  },
  INITIATIVE_PURPOSE_FOR_MISSING: {
    spine: 'What is this undertaking for? Say what it exists to achieve.',
    examples: {
      musician: 'e.g. grow the audience from loyal listeners to industry credibility',
      founder: 'e.g. establish product-market fit before runway exhaustion',
      writer: 'e.g. land agent representation for commercial publishing',
      generic: 'e.g. remove the bottleneck that blocks downstream lanes from running',
    },
  },
  INITIATIVE_PURPOSE_COMPLETION_MISSING: {
    spine:
      'When this project is complete, what does that accomplishment enable or unlock?',
    examples: {
      musician: 'e.g. launch the terminal album without financial risk',
      founder: 'e.g. close the Series A and scale to 10 users',
      writer: 'e.g. sign a traditional publishing deal for the series',
      generic: 'e.g. open the second product line or geographic expansion',
    },
  },
  INITIATIVE_PURPOSE_ONGOING_MISSING: {
    spine:
      'While this system is running, what does it continuously produce or maintain?',
    examples: {
      musician: 'e.g. generates monthly revenue from streaming and licensing',
      founder: 'e.g. sustains 100+ paying users and 5+ feature releases per quarter',
      writer: 'e.g. publishes the monthly newsletter and processes agent queries',
      generic: 'e.g. serves 50+ customers daily or maintains uptime above 99.5%',
    },
  },
  // ── substantiveness gates for conditional purpose fields ──────────────
  INITIATIVE_PURPOSE_FOR_NOT_SUBSTANTIVE: {
    spine:
      "Too vague — name the concrete thing it exists to achieve, not a general category.",
    examples: {
      musician: "e.g. 'grow audience from loyal listeners to industry credibility', not 'build the brand'",
      founder: "e.g. 'establish product-market fit', not 'deliver value'",
      writer: "e.g. 'land agent representation', not 'advance my career'",
      generic: "e.g. cite a specific outcome, not 'enable growth' or 'move forward'",
    },
  },
  INITIATIVE_PURPOSE_COMPLETION_NOT_SUBSTANTIVE: {
    spine:
      "Too vague — name what the project opens up or enables, not a general outcome.",
    examples: {
      musician: "e.g. 'launch the terminal album without financial risk', not 'complete the project'",
      founder: "e.g. 'close Series A and scale to 10 users', not 'achieve success'",
      writer: "e.g. 'sign a traditional publishing deal', not 'finish the project'",
      generic: "e.g. 'unlock the second product line', not 'achieve the goal'",
    },
  },
  INITIATIVE_PURPOSE_ONGOING_NOT_SUBSTANTIVE: {
    spine:
      "Too vague — name what the system actually produces, not a general category.",
    examples: {
      musician: "e.g. 'generates $500/mo in licensing revenue', not 'makes money'",
      founder: "e.g. 'sustains 100+ paying users', not 'works'",
      writer: "e.g. 'publishes 12 newsletters/year reaching 5k subscribers', not 'reaches people'",
      generic: "e.g. cite the specific output or metric, not 'keeps running' or 'operates'",
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
