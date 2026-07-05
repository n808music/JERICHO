// System slot reprobes. Merge into REPROBES.
// pickSet gates (owner, activationState) keep example rows empty.
// No done-when probes — systems have no completion condition by design.

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
  SYSTEM_OWNER_UNRESOLVED: {
    spine:
      'Which entity does this system run for? Pick one — or mark it cross-cutting if it serves the whole operation, not a single entity.',
    pickSet: 'systemOwnerOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  SYSTEM_CYCLE_MISSING: {
    spine:
      'Describe the loop — the stages it cycles through and back to the start. This is what makes it a system instead of a one-time effort.',
    examples: {
      musician: 'e.g. Create → Produce → Art + Metadata → Distribute → Promote → Analyze → repeat',
      founder: 'e.g. Pipeline → Pitch → Close → Report → repeat',
      writer: 'e.g. Draft → Edit → Submit → Track responses → repeat',
      generic: 'e.g. Manufacture → Fulfill → Reorder → Restock → repeat',
    },
  },
  SYSTEM_CYCLE_NOT_SUBSTANTIVE: {
    spine:
      "That's too vague to be a loop — name the actual stages it moves through, not a general description.",
    examples: {
      musician: "e.g. 'Record → mix → master → distribute → repeat', not 'we make music'",
      founder: "e.g. 'Build → test → ship → measure → repeat', not 'we develop'",
      writer: "e.g. 'Draft → revise → query → repeat', not 'we write'",
      generic: "e.g. 'Source → make → ship → restock → repeat', not 'we operate'",
    },
  },
  SYSTEM_ACTIVATION_STATE_MISSING: {
    spine: 'Is this system running right now? Pick its current state.',
    pickSet: 'activationStateOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  SYSTEM_ACTIVATION_STATE_INVALID: {
    spine: 'Pick one: running, missing, or planned.',
    pickSet: 'activationStateOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  SYSTEM_ACTIVATION_CONDITION_NOT_SUBSTANTIVE: {
    spine:
      "You can leave this blank — but if you set it, name the concrete thing that has to be true before this system can start running.",
    examples: {
      musician: "e.g. 'a distribution account and a mastering source exist', not 'get set up'",
      founder: "e.g. 'first paying customer and a payment processor live', not 'be ready'",
      writer: "e.g. 'a finished draft and an agent list', not 'be prepared'",
      generic: "e.g. 'suppliers contracted and inventory in place', not 'get organized'",
    },
  },
};
