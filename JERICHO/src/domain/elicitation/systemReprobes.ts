// System slot reprobes. Merge into REPROBES.
// pickSet gates (owner) keep example rows empty.
// No done-when probes — systems have no completion condition by design.
//
// Entries are ordered to mirror the SYSTEM_SLOT gate ladder:
//   name → owner → mechanism → feeds_converges_into
// SYSTEM_OWNER_UNRESOLVED is not part of that ladder — it fires from the
// reducer (identityCompute.declareSystem) when an owner was supplied but
// matches no entity and is not the 'Cross-cutting' literal.

export const SYSTEM_REPROBES = {
  SYSTEM_NAME_MISSING: {
    spine: "What's this recurring engine called — the loop that keeps running?",
    examples: {
      musician: 'e.g. the release pipeline, the audience-capture system',
      founder: 'e.g. the dev system, the fundraising system',
      writer: 'e.g. the drafting-to-submission pipeline',
      generic: 'e.g. the supply system, the production system',
    },
  },
  SYSTEM_NAME_NOT_HOLDABLE: {
    spine: "Name the engine itself, not the act of running it — a thing you can point at.",
    examples: {
      musician: "e.g. 'the release pipeline', not 'releasing things'",
      founder: "e.g. 'the dev system', not 'developing'",
      writer: "e.g. 'the submission pipeline', not 'submitting'",
      generic: "e.g. 'the supply system', not 'supplying'",
    },
  },
  SYSTEM_OWNER_MISSING: {
    spine:
      'Which entity runs this system — owns and operates it? Pick one — or mark "Cross-cutting" if this system serves the whole operation.',
    pickSet: 'systemOwnerOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  SYSTEM_OWNER_UNRESOLVED: {
    spine:
      'Which entity does this system run for? Pick one — or mark it cross-cutting if it serves the whole operation, not a single entity.',
    pickSet: 'systemOwnerOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  SYSTEM_MECHANISM_MISSING: {
    spine:
      'Describe the loop this system cycles through. What are the stages in this system, from start back to start?',
    examples: {
      musician: 'e.g. Create → Produce → Art + Metadata → Distribute → Promote → Analyze → repeat',
      founder: 'e.g. Pipeline → Pitch → Close → Report → repeat',
      writer: 'e.g. Draft → Edit → Submit → Track responses → repeat',
      generic: 'e.g. Manufacture → Fulfill → Reorder → Restock → repeat',
    },
  },
  SYSTEM_MECHANISM_NOT_SUBSTANTIVE: {
    spine:
      "That's too vague to be a loop — name the actual stages this system moves through, not a general description.",
    examples: {
      musician: "e.g. 'Record → mix → master → distribute → repeat', not 'we make music'",
      founder: "e.g. 'Build → test → ship → measure → repeat', not 'we develop'",
      writer: "e.g. 'Draft → revise → query → repeat', not 'we write'",
      generic: "e.g. 'Source → make → ship → restock → repeat', not 'we operate'",
    },
  },
  SYSTEM_FEEDS_MISSING: {
    spine:
      'What does this system feed into? Name the downstream projects, deliverables, or other systems it powers or converges with.',
    examples: {
      musician: 'e.g. album release schedule, distribution pipeline, audience funnel',
      founder: 'e.g. quarterly business review, investor update cycle, product roadmap',
      writer: 'e.g. editorial calendar, manuscript submission pipeline, author platform',
      generic: 'e.g. fulfillment pipeline, inventory system, customer service queue',
    },
  },
  SYSTEM_FEEDS_NOT_SUBSTANTIVE: {
    spine:
      "That's too vague — name the specific downstream projects, deliverables, or systems this system feeds into, not a general category.",
    examples: {
      musician: "e.g. 'OFL 7 release → YouTube premiere → social calendar', not 'the music stuff'",
      founder: "e.g. 'quarterly review → investor update → product roadmap', not 'the business'",
      writer: "e.g. 'manuscript submission → editorial calendar → author platform', not 'the writing'",
      generic: "e.g. 'order fulfillment → inventory restock → logistics', not 'the operations'",
    },
  },
};
