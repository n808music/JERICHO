export const CONVERGENCE_REPROBES = {
  CONVERGENCE_FROM_MISSING: {
    spine: 'Which node gives something — what is the source of the value flow?',
    pickSet: 'allDeclaredNodeOptions',
    examples: {
      musician: 'e.g. Romance Riot (the album that creates awareness for the podcast)',
      founder: 'e.g. the Case Study (the content that markets the SaaS product)',
      writer: 'e.g. the Newsletter (the thing that drives readers toward the book)',
      generic: 'e.g. the content piece, the system, the initiative that produces the value',
    },
  },
  CONVERGENCE_FROM_UNRESOLVED: {
    spine: "That node isn't declared yet — pick from the declared nodes or declare it first.",
    pickSet: 'allDeclaredNodeOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  CONVERGENCE_TO_MISSING: {
    spine: 'Which node receives it — what is the destination of the value flow?',
    pickSet: 'allDeclaredNodeOptions',
    examples: {
      musician: 'e.g. the Podcast (receives the audience awareness the album creates)',
      founder: 'e.g. the SaaS product page (receives the leads the case study sends)',
      writer: 'e.g. the Book (receives the readers the newsletter drives)',
      generic: 'e.g. the initiative, system, or artifact that benefits from the flow',
    },
  },
  CONVERGENCE_SELF_EDGE: {
    spine: 'A node cannot converge into itself — pick a different destination.',
    pickSet: 'allDeclaredNodeOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  CONVERGENCE_TO_UNRESOLVED: {
    spine: "That destination node isn't declared yet — pick from the declared nodes or declare it first.",
    pickSet: 'allDeclaredNodeOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  CONVERGENCE_GIVES_MISSING: {
    spine: 'What does the source give to the destination — what is the value that flows?',
    pickSet: null,
    examples: {
      musician: "e.g. 'creates awareness', 'deepens trust', 'funds the next release'",
      founder: "e.g. 'markets the product', 'generates leads', 'validates the concept'",
      writer: "e.g. 'drives readers', 'builds credibility', 'deepens trust with the audience'",
      generic: "e.g. 'funds', 'markets', 'creates awareness' — not 'adds value' or 'creates synergy'",
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
