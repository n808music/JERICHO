export const RESOURCE_REPROBES = {
  // ── Initiative selection ───────────────────────────────────────────────────
  RESOURCE_INITIATIVE_MISSING: {
    spine: 'Which initiative are we profiling resources for? Pick from the initiatives that still need a resource profile.',
    pickSet: 'unprofiledInitiativeOptions',
    examples: {
      musician: 'e.g. the album release, the patent filing, the Jericho MVP',
      founder: 'e.g. the product launch, the funding initiative, the infrastructure build',
      writer: 'e.g. the manuscript, the query campaign, the newsletter initiative',
      generic: 'e.g. the initiative that still needs a gap analysis',
    },
  },
  RESOURCE_INITIATIVE_UNRESOLVED: {
    spine: "That initiative isn't declared — pick from the list of declared initiatives.",
    pickSet: 'unprofiledInitiativeOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },

  // ── Money dimension ────────────────────────────────────────────────────────
  RESOURCE_MONEY_NEED_MISSING: {
    spine: 'What money does this initiative need to execute? Name the amount and what it pays for.',
    examples: {
      musician: 'e.g. approximately $100 for mastering fees and DSP distribution',
      founder: 'e.g. approximately $500 for design work and hosting setup',
      writer: 'e.g. approximately $0 — no monetary costs at this phase',
      generic: 'e.g. $X for Y — or "none at this phase" if truly $0',
    },
  },
  RESOURCE_MONEY_NEED_NOT_SUBSTANTIVE: {
    spine: 'Name the specific amount and what it buys — not a general category.',
    examples: {
      musician: "e.g. 'approximately $100 for distribution via DistroKid', not 'some money for music stuff'",
      founder: "e.g. 'approximately $500 for Figma subscription and logo design', not 'design budget'",
      writer: "e.g. 'approximately $30/mo for email platform', not 'marketing expenses'",
      generic: "e.g. '$X for specific purpose', not 'some money' or 'funding'",
    },
  },
  RESOURCE_MONEY_GAP_MISSING: {
    spine: "What's the money gap — the difference between what you have and what this needs? Say \"none\" if fully funded.",
    examples: {
      musician: "e.g. 'have $65, need $100, gap of $35' or \"none\" if already covered",
      founder: "e.g. 'have $0 allocated, need $500, gap of $500' or \"none\" if budgeted",
      writer: "e.g. 'have $30/mo available, need $30/mo, no gap' — or just \"none\"",
      generic: "e.g. 'need $X more than currently available' or \"none\" if covered",
    },
  },
  RESOURCE_MONEY_GAP_NOT_SUBSTANTIVE: {
    spine: 'Describe the actual gap — how much more is needed, or confirm "none" if fully covered.',
    examples: {
      musician: "e.g. 'need $35 more than current $65 cash' or \"none\"",
      founder: "e.g. 'gap of $500 — no money allocated yet' or \"none\"",
      writer: "e.g. 'gap of $30/mo until subscription is funded' or \"none\"",
      generic: "e.g. 'need $X more than available' or \"none\" — not 'some gap' or 'needs work'",
    },
  },

  // ── Time dimension ─────────────────────────────────────────────────────────
  RESOURCE_TIME_NEED_MISSING: {
    spine: 'How much time per week does this initiative require? Give hours and duration.',
    examples: {
      musician: 'e.g. 10 hours per week for six weeks through the October launch',
      founder: 'e.g. 20 hours per week sustained through the beta period',
      writer: 'e.g. 5 hours per week of focused writing over 12 weeks',
      generic: 'e.g. X hours per week for Y duration',
    },
  },
  RESOURCE_TIME_NEED_NOT_SUBSTANTIVE: {
    spine: 'Give a specific hours-per-week estimate and the time horizon — not a vague category.',
    examples: {
      musician: "e.g. '10 hrs/wk for 6 weeks', not 'a lot of time' or 'significant effort'",
      founder: "e.g. '20 hrs/wk through beta', not 'full-time focus'",
      writer: "e.g. '5 hrs/wk over 12 weeks', not 'regular writing time'",
      generic: "e.g. 'X hours per week for Y weeks', not 'some time' or 'as needed'",
    },
  },
  RESOURCE_TIME_GAP_MISSING: {
    spine: 'Is there a time gap — hours needed vs hours available? Say "none" if capacity is sufficient.',
    examples: {
      musician: "e.g. 'need 10 hrs/wk, have 40 available, no gap' or 'need 20, currently have 5 allocated, gap of 15 hrs/wk'",
      founder: "e.g. 'need 20 hrs/wk, gap of 10 when day job resumes' or \"none\"",
      writer: "e.g. 'need 5 hrs/wk, currently blocking 5, no gap' or \"none\"",
      generic: "e.g. 'gap of X hrs/wk vs available capacity' or \"none\"",
    },
  },
  RESOURCE_TIME_GAP_NOT_SUBSTANTIVE: {
    spine: 'Describe the specific time gap in hours — or say "none" if capacity is sufficient.',
    examples: {
      musician: "e.g. '10 hrs/wk needed, 5 currently available, gap of 5 hrs/wk' or \"none\"",
      founder: "e.g. 'gap of 10 hrs/wk when employment resumes' or \"none\"",
      writer: "e.g. 'no gap at current pace' or \"none\"",
      generic: "e.g. 'gap of X hours per week' or \"none\" — not 'time is tight' or 'challenging'",
    },
  },

  // ── Skills dimension ───────────────────────────────────────────────────────
  RESOURCE_SKILLS_NEED_MISSING: {
    spine: 'What specific skill does this initiative need to execute? Name the capability.',
    examples: {
      musician: 'e.g. audio mastering, video directing, patent claim drafting',
      founder: 'e.g. backend development, fundraising pitch, legal entity formation',
      writer: 'e.g. query letter writing, manuscript editing, self-publishing operations',
      generic: 'e.g. the specific skill or knowledge required to execute this initiative',
    },
  },
  RESOURCE_SKILLS_NEED_NOT_SUBSTANTIVE: {
    spine: 'Name the specific skill or capability needed — not a general category.',
    examples: {
      musician: "e.g. 'audio mastering for final mix', not 'technical skills'",
      founder: "e.g. 'React TypeScript development', not 'coding'",
      writer: "e.g. 'query letter writing for literary agents', not 'writing skills'",
      generic: "e.g. the named capability, not 'skills' or 'expertise'",
    },
  },
  RESOURCE_SKILLS_GAP_MISSING: {
    spine: 'Do you have this skill, or is there a gap? Say "none" if you have the skill already.',
    examples: {
      musician: "e.g. 'need to hire or learn audio mastering' or \"none\" if you can do it",
      founder: "e.g. 'need to hire a backend dev' or \"none\" if skill is in-house",
      writer: "e.g. 'need to learn query conventions' or \"none\" if practiced",
      generic: "e.g. 'gap: need to acquire or hire this skill' or \"none\"",
    },
  },
  RESOURCE_SKILLS_GAP_NOT_SUBSTANTIVE: {
    spine: 'Describe the specific skill gap — what you need to learn, hire, or acquire — or say "none".',
    examples: {
      musician: "e.g. 'need to hire a mastering engineer for the final mix' or \"none\"",
      founder: "e.g. 'need to hire a designer for the visual package' or \"none\"",
      writer: "e.g. 'need to research and practice cold query letters' or \"none\"",
      generic: "e.g. 'gap: must acquire X by hiring or learning' or \"none\"",
    },
  },

  // ── Tech dimension ─────────────────────────────────────────────────────────
  RESOURCE_TECH_NEED_MISSING: {
    spine: 'What technology or tools does this initiative require? Name the specific tool or license.',
    examples: {
      musician: 'e.g. mastering DAW license, distribution platform account, video camera',
      founder: 'e.g. MacBook, Node.js stack, cloud hosting subscription',
      writer: 'e.g. manuscript software, email platform subscription',
      generic: 'e.g. the specific tool, software, or infrastructure needed',
    },
  },
  RESOURCE_TECH_NEED_NOT_SUBSTANTIVE: {
    spine: 'Name the specific tool or license needed — not a general category.',
    examples: {
      musician: "e.g. 'DistroKid account and DAW license', not 'music software'",
      founder: "e.g. 'Vercel hosting and Stripe account', not 'web infrastructure'",
      writer: "e.g. 'Scrivener license and Mailchimp subscription', not 'writing tools'",
      generic: "e.g. 'specific tool name and what it does', not 'tech stack' or 'tooling'",
    },
  },
  RESOURCE_TECH_GAP_MISSING: {
    spine: 'Do you have the required tech, or is there a gap? Say "none" if all tools are in place.',
    examples: {
      musician: "e.g. 'no DAW license purchased yet' or \"none\" if fully equipped",
      founder: "e.g. 'need to set up Stripe and Vercel accounts' or \"none\"",
      writer: "e.g. 'need Scrivener license' or \"none\" if already licensed",
      generic: "e.g. 'missing X tool — not yet acquired' or \"none\"",
    },
  },
  RESOURCE_TECH_GAP_NOT_SUBSTANTIVE: {
    spine: 'Describe the specific tech gap — what is missing or not yet set up — or say "none".',
    examples: {
      musician: "e.g. 'DAW mastering license not purchased; estimated $200' or \"none\"",
      founder: "e.g. 'Stripe account not created; zero setup cost' or \"none\"",
      writer: "e.g. 'email platform subscription not started; $30/mo once activated' or \"none\"",
      generic: "e.g. 'tool X not yet acquired or configured' or \"none\"",
    },
  },

  // ── Binding constraint ─────────────────────────────────────────────────────
  BINDING_COVERAGE_INCOMPLETE: {
    spine: 'Complete the resource profile for every initiative before naming the binding constraint — the grid must be full to read it correctly.',
    pickSet: 'unprofiledInitiativeOptions',
    examples: {
      musician: 'Profile the remaining lanes first — music release, patent, Jericho, etc.',
      founder: 'Profile each initiative before synthesizing which dimension binds.',
      writer: 'All initiatives need a profile before the binding constraint can be named.',
      generic: 'Remaining initiatives need resource profiles before naming the binding constraint.',
    },
  },
  BINDING_DIMENSION_MISSING: {
    spine: 'Which dimension is the binding constraint — the one that limits the plan most severely across all lanes? Pick from: money, time, skills, tech.',
    pickSet: 'resourceDimensionOptions',
    examples: {
      musician: 'e.g. time — 40 hrs/wk cannot cover all P1 lanes simultaneously',
      founder: 'e.g. money — capital gates the product launch before revenue',
      writer: 'e.g. skills — query-writing skill is the bottleneck before submission',
      generic: 'e.g. time, money, skills, or tech — whichever shows up as a gap most consistently',
    },
  },
  BINDING_DIMENSION_INVALID: {
    spine: 'That dimension is not in the resource framework — pick one of: money, time, skills, tech.',
    pickSet: 'resourceDimensionOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  BINDING_RATIONALE_MISSING: {
    spine: 'Why is that the binding constraint? Ground it in the profiles you just authored.',
    examples: {
      musician: 'e.g. TIME: every P1 lane needs 10+ hrs/wk and only 40 are available, so all lanes cannot run in parallel',
      founder: 'e.g. MONEY: product launch requires $10k in runway and current cash is $65',
      writer: 'e.g. SKILLS: query-letter acceptance rate determines everything and the skill is undeveloped',
      generic: 'e.g. explain why this dimension shows up as a gap across the most lanes in the profiles above',
    },
  },
  BINDING_RATIONALE_NOT_SUBSTANTIVE: {
    spine: 'Be specific — ground the rationale in the actual profiles. Name hours, amounts, or specific gaps you just authored.',
    examples: {
      musician: "e.g. 'TIME binds: 10 hrs needed for music + 20 for Jericho + 5 for patent = 35 hrs vs 40 available; stacking all would force errors'",
      founder: "e.g. 'MONEY binds: launch needs $10k; current cash is $65; no revenue yet; runway is 2 weeks'",
      writer: "e.g. 'SKILLS bind: query letters to 50 agents with <5% success rate means skill is the rate limiter'",
      generic: "e.g. cite the specific gap numbers or skill deficits from the profiles — not 'things are hard' or 'it's complex'",
    },
  },
};
