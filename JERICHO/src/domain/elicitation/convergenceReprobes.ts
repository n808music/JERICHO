export const CONVERGENCE_REPROBES = {
  // Destination-first (2026-07-10): the destination is asked before the
  // sources so every later spine has a subject to bind to via the
  // 'this destination' token — "What feeds Marketing flywheel?" instead of
  // the subject-less "where does this flow start?".
  CONVERGENCE_TO_MISSING: {
    spine: 'Where do work streams meet? Pick the part of your operation that receives value from others.',
    pickSet: 'allDeclaredNodeOptions',
    examples: {
      musician: 'e.g. the Podcast (receives the audience awareness the album creates)',
      founder: 'e.g. the SaaS product page (receives the leads the case study sends)',
      writer: 'e.g. the Book (receives the readers the newsletter drives)',
      generic: 'e.g. the initiative, system, or deliverable that others feed',
    },
  },
  CONVERGENCE_TO_UNRESOLVED: {
    spine: "That one isn't on the board yet — pick from what you've declared, or add it in its own section first.",
    pickSet: 'allDeclaredNodeOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  CONVERGENCE_FROM_MISSING: {
    spine: 'What feeds this destination? Pick everything that sends value its way.',
    pickSet: 'convergenceSourceOptions',
    examples: {
      musician: 'e.g. Romance Riot (the album that creates awareness for the podcast)',
      founder: 'e.g. the Case Study (the content that markets the SaaS product)',
      writer: 'e.g. the Newsletter (the thing that drives readers toward the book)',
      generic: 'e.g. whatever produces the thing that moves — content, a system, an initiative',
    },
  },
  CONVERGENCE_FROM_UNRESOLVED: {
    spine: "One of those isn't on the board yet — pick from what you've declared, or add it in its own section first.",
    pickSet: 'convergenceSourceOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  CONVERGENCE_SELF_EDGE: {
    spine: "this destination can't feed itself — remove it from the sources.",
    pickSet: 'convergenceSourceOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  CONVERGENCE_GIVES_MISSING: {
    spine: 'In your own words: what do they actually give this destination?',
    pickSet: null,
    examples: {
      musician: "e.g. 'creates awareness', 'deepens trust', 'funds the next release'",
      founder: "e.g. 'markets the product', 'generates leads', 'validates the concept'",
      writer: "e.g. 'drives readers', 'builds credibility', 'deepens trust with the audience'",
      generic: "e.g. audience, money, content, leads — not 'adds value' or 'creates synergy'",
    },
  },
  CONVERGENCE_GIVES_NOT_SUBSTANTIVE: {
    spine: "That description is too vague — describe the specific value that flows, not a placeholder.",
    pickSet: null,
    examples: {
      musician: "e.g. 'creates awareness for the tape' not 'adds value'; 'funds the next recording' not 'creates synergy'",
      founder: "e.g. 'generates qualified leads' not 'supports growth'; 'validates the pricing model' not 'adds value'",
      writer: "e.g. 'drives readers to the book' not 'creates synergy'; 'deepens trust with subscribers' not 'adds value'",
      generic: "e.g. write what one system concretely gives another — a named resource, a named effect, a named outcome",
    },
  },
};
