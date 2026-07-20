import { ENTITY_REPROBES } from './entityReprobes';
import { INITIATIVE_REPROBES } from './initiativeReprobes';
import { SYSTEM_REPROBES } from './systemReprobes';
import { ARTIFACT_REPROBES } from './artifactReprobes';
import { DEPENDENCY_REPROBES } from './dependencyReprobes';
import { CONVERGENCE_REPROBES } from './convergenceReprobes';
import { RESOURCE_REPROBES } from './resourceReprobes';
import { BOOTSTRAP_REPROBES } from './bootstrapReprobes';

// Reprobe authoring contract (Spec §5).
//
// Every gate-failure CODE maps to one CONSTANT spine string. The spine is
// authored once, never generated. The per-goalType `examples` table is a
// LOOKUP — the spine + the row together form the operator-visible probe.
//
// A test asserts these strings are byte-identical across runs. Do not
// programmatically build a spine. Do not interpolate `goalType` into a
// spine. Adaptivity is the EXAMPLE row, not the SPINE.

export const GOAL_TYPES = ['musician', 'founder', 'writer', 'generic'];

export const REPROBES = {
  PROJECT_NAME_MISSING: {
    spine:
      "What's the name of this project — the thing you'd point to and say 'I'm working on that'?",
    examples: {
      musician: "e.g. the tape 'Romance Riot', the music video",
      founder: 'e.g. the beta launch, the pricing page',
      writer: 'e.g. the manuscript, the query letter',
      generic: 'e.g. the report, the redesign, the campaign',
    },
  },
  PROJECT_NAME_NOT_HOLDABLE: {
    spine:
      "That looks like an action, not a deliverable — name the thing itself, not what you're doing to it.",
    examples: {
      musician: "e.g. 'Romance Riot album', not 'Complete the album'",
      founder: "e.g. 'Pricing page', not 'Build the pricing page'",
      writer: "e.g. 'Query letter', not 'Write the query letter'",
      generic: "e.g. 'Q2 report', not 'Complete the Q2 report'",
    },
  },
  PROJECT_OWNER_MISSING: {
    // Contains 'this project' so referent binding names the item (2026-07-10:
    // 'owns this?' never bound — operator lost the subject mid fan-out).
    spine: 'Which part of your operation owns this project? Pick the entity it lives under.',
    pickSet: 'declaredEntities',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  PROJECT_METRIC_MISSING: {
    spine: 'How will you know this project succeeded? Name the measurable outcome.',
    examples: {
      musician: 'e.g. 10,000 streams, 500 tickets sold',
      founder: 'e.g. 100 paying users, $5k MRR',
      writer: 'e.g. 3 full-manuscript requests',
      generic: 'e.g. 50 signups, 4 reviews completed',
    },
  },
  PROJECT_METRIC_UNQUANTIFIED: {
    spine:
      'That needs a number or a clear finish line — give me the count, amount, or the event that declares it done.',
    examples: {
      musician: "e.g. '10,000 streams' or 'signed by a label'",
      founder: "e.g. '100 paying users' or 'launched in the App Store'",
      writer: "e.g. '3 full-manuscript requests' or 'accepted by an agent'",
      generic: "e.g. '50 signups' or 'approved by the client'",
    },
  },
  PROJECT_SOURCE_MISSING: {
    spine:
      "Name the place you'll read that number from — the tool, app, or screen you'll open to check it.",
    examples: {
      musician: 'e.g. Spotify for Artists, DistroKid',
      founder: 'e.g. Stripe, your bank dashboard',
      writer: 'e.g. QueryTracker, KDP reports',
      generic: 'e.g. Google Analytics, your CRM, your bank account',
    },
  },
  // §5 phase attestation (Wave 2, Gate 1). Disclosure Standard: rule cited (residual-bucket
  // consequence), gap in plain words (unattested → unplaceable), compliant example shown.
  // Carries the "this project" subject token so the attestation binds to the right node.
  PROJECT_PHASE_UNATTESTED: {
    spine:
      "Which stage toward the terminal is this project — beginning (1), middle (2), or end (3)? Phase orders the whole grid toward the finish; a project with no attested phase can't be placed and drops to the residual bucket. Answer 1, 2, or 3.",
    examples: {
      musician: 'e.g. 1 = the release you ship first · 2 = the follow-ups · 3 = the catalog/endgame',
      founder: 'e.g. 1 = MVP/beta · 2 = growth · 3 = scale or exit',
      writer: 'e.g. 1 = the draft you write first · 2 = revisions/sequels · 3 = the finished series',
      generic: 'e.g. 1 = beginning · 2 = middle · 3 = end',
    },
  },
  PROJECT_PHASE_NON_CANONICAL: {
    spine:
      "Phase is exactly one of 1, 2, or 3 — beginning, middle, or end toward the terminal. That answer isn't one of them; give me 1, 2, or 3 for this project.",
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  VERIFICATION_SOURCE_SOURCE_MISSING: {
    spine:
      "Name the place you'll actually open to check this — the tool, app, screen, or record.",
    examples: {
      musician: 'e.g. Spotify for Artists, DistroKid, your bank app',
      founder: 'e.g. Stripe, QuickBooks, your bank dashboard',
      writer: 'e.g. QueryTracker, your KDP reports, your agent portal',
      generic: 'e.g. Google Analytics, your CRM, the county records site',
    },
  },
  VERIFICATION_SOURCE_SOURCE_NOT_HOLDABLE: {
    spine:
      "That's an action, not a place — name the actual tool or record you open, not what you do with it.",
    examples: {
      musician: "e.g. 'Spotify for Artists', not 'check the streams'",
      founder: "e.g. 'Stripe', not 'look at revenue'",
      writer: "e.g. 'QueryTracker', not 'track responses'",
      generic: "e.g. 'the bank statement', not 'verify the balance'",
    },
  },
  VERIFICATION_SOURCE_DOMAIN_MISSING: {
    spine:
      'What kind of measurement does this source report? Name the domain so future projects can reuse it.',
    examples: {
      musician: 'e.g. Music streams, Music revenue',
      founder: 'e.g. Revenue, Sign-ups, Retention',
      writer: 'e.g. Query responses, Sales reports',
      generic: 'e.g. Audience metrics, Bank balance, Application status',
    },
  },
  ...ENTITY_REPROBES,
  ...INITIATIVE_REPROBES,
  ...SYSTEM_REPROBES,
  ...ARTIFACT_REPROBES,
  ...DEPENDENCY_REPROBES,
  ...CONVERGENCE_REPROBES,
  ...RESOURCE_REPROBES,
  ...BOOTSTRAP_REPROBES,
};

export const PROJECT_OPENING_PROBE = REPROBES.PROJECT_NAME_MISSING;
export const VS_OPENING_PROBE = REPROBES.VERIFICATION_SOURCE_SOURCE_MISSING;

export function probeFor(code, goalType) {
  const entry = REPROBES[code];
  if (!entry) {
    throw new Error(`No reprobe authored for code: ${code}`);
  }
  const safeGoalType = GOAL_TYPES.includes(goalType) ? goalType : 'generic';
  return {
    code,
    spine: entry.spine,
    examples: entry.examples?.[safeGoalType] || '',
    pickSet: entry.pickSet || null,
  };
}
