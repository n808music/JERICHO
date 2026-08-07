// Entity slot reprobes — one spine per gate CODE, examples per goalType.
//
// Authoring contract (same as project reprobes):
//  - The spine is a CONSTANT string, invariant across goalTypes. A test
//    asserts byte-identity across runs. Never interpolate goalType into a spine.
//  - Adaptivity lives ONLY in the examples row.
//  - pickSet-bearing gates (roleTags, formationState) keep empty example rows;
//    the operator picks from the set, examples would be noise.
//
// These merge into the REPROBES map alongside the project entries. probeFor(code)
// looks them up directly by gate code.

export const ENTITY_REPROBES = {
  // ── name ──────────────────────────────────────────────────────────────
  ENTITY_NAME_MISSING: {
    spine:
      "What do you call this part of your operation — the name you'd put on its door?",
    examples: {
      musician: "e.g. your label, your production company, your touring outfit",
      founder: 'e.g. the company, the product studio, the holding entity',
      writer: 'e.g. your press, your imprint, your studio',
      generic: 'e.g. the company, the team, the division',
    },
  },
  ENTITY_NAME_NOT_HOLDABLE: {
    spine:
      "That reads like an activity, not a thing — name the entity itself, not what it does.",
    examples: {
      musician: "e.g. 'Global State Corp.', not 'Putting out music'",
      founder: "e.g. 'Acme Labs', not 'Building the product'",
      writer: "e.g. 'Riverstone Press', not 'Publishing books'",
      generic: "e.g. 'Northwind Group', not 'Managing operations'",
    },
  },
  // ── roleTags (pickSet) ────────────────────────────────────────────────
  ENTITY_ROLETAGS_MISSING: {
    spine:
      'What does this entity do in the operation? Pick every role it plays — most carry more than one.',
    pickSet: 'roleTagOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  ENTITY_ROLETAGS_INVALID: {
    spine:
      "One of those isn't a role the system recognizes — choose only from the roles shown.",
    pickSet: 'roleTagOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  // ── purpose ───────────────────────────────────────────────────────────
  ENTITY_PURPOSE_MISSING: {
    spine: 'What is this entity for? Say what it exists to do in one or two sentences.',
    examples: {
      musician:
        'e.g. the label that consolidates the catalog and signs new artists',
      founder: 'e.g. the studio that builds and ships the core product',
      writer: 'e.g. the imprint that publishes the series and licenses rights',
      generic: 'e.g. the arm that owns and runs one core line of the operation',
    },
  },
  ENTITY_PURPOSE_NOT_SUBSTANTIVE: {
    spine:
      "That's too vague to act on — name the concrete thing it does, not a general mission.",
    examples: {
      musician: "e.g. 'releases the OFL tapes and grows the listener base', not 'drives music'",
      founder: "e.g. 'builds the scheduling app', not 'delivers value'",
      writer: "e.g. 'publishes the trilogy and runs the newsletter', not 'creates content'",
      generic: "e.g. 'manufactures and sells the gum', not 'manages the business'",
    },
  },
  // ── current status: formationState (pick) ─────────────────────────────
  ENTITY_FORMATION_STATE_MISSING: {
    spine: 'Where is this entity right now? Pick the one that matches its real state today.',
    pickSet: 'formationStateOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  ENTITY_FORMATION_STATE_INVALID: {
    spine: "That isn't one of the formation states — pick the closest match from the list.",
    pickSet: 'formationStateOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  // ── current status: statusEvidence (substance) ────────────────────────
  ENTITY_STATUS_EVIDENCE_MISSING: {
    spine:
      "What actually exists today that proves that state? Name the concrete things you can point to.",
    examples: {
      musician: 'e.g. 7 albums released, 30k monthly listeners, recording gear',
      founder: 'e.g. a working prototype, 3 pilot users, the incorporated LLC',
      writer: 'e.g. a finished draft, a signed agent, two published stories',
      generic: 'e.g. a registered name, one signed contract, a built workspace',
    },
  },
  ENTITY_STATUS_EVIDENCE_NOT_SUBSTANTIVE: {
    spine:
      "That's a feeling, not evidence — name the real, countable things that exist right now.",
    examples: {
      musician: "e.g. '1 album mixed, studio built', not 'making good progress'",
      founder: "e.g. 'prototype live, 5 users', not 'things are moving along'",
      writer: "e.g. 'draft done, 2 stories out', not 'coming together nicely'",
      generic: "e.g. 'LLC filed, 1 client signed', not 'going well so far'",
    },
  },
  // ── formationState-specific: named-only confirmation (replaces evidence question) ──
  // When an entity is in named-only state (a name exists, nothing built), the state
  // itself is self-proving. We replace the open-ended evidence question with a simple
  // yes/no confirmation of this fact, using the entity's already-known name.
  ENTITY_NAMEDONLY_CONFIRMATION_MISSING: {
    spine:
      "Confirming: only the name 'this entity' currently exists right now, with nothing built yet — correct?",
    pickSet: 'yesNoOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  ENTITY_NAMEDONLY_CONFIRMATION_REJECTED: {
    spine:
      "If 'this entity' is more than a name, pick the formation state that matches its real status: conceptual (designed), in-development (actively being built), or functioning (operating).",
    pickSet: 'formationStateOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  // ── legal status: independent boolean ──────────────────────────────────
  ENTITY_LEGAL_STATUS_MISSING: {
    spine: 'Is this entity formally registered? (LLC, corporation, other legal entity)',
    pickSet: 'yesNoOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  // ── doneWhen (OPTIONAL — validity only) ───────────────────────────────
  ENTITY_DONEWHEN_NOT_VERIFIABLE: {
    spine:
      "You can leave this blank — but if you set it, it has to be checkable in the real world, not just 'done'. Name the external proof.",
    examples: {
      musician: "e.g. 'the album is live on Spotify for Artists', not 'the album is finished'",
      founder: "e.g. '100 paying users in Stripe', not 'the product is done'",
      writer: "e.g. 'the book is for sale on its retail page', not 'the book is complete'",
      generic: "e.g. 'the gum is on shelves generating revenue', not 'it's up and running'",
    },
  },
};
