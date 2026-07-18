export const ARTIFACT_REPROBES = {
  ARTIFACT_NAME_MISSING: {
    spine: "What's this artifact called — the deliverable that proves the work happened?",
    examples: {
      musician: 'e.g. Romance Riot tape, OFL Release Package 3',
      founder: 'e.g. deployed MVP, signed term sheet',
      writer: 'e.g. finished manuscript, query letter batch',
      generic: 'e.g. the final report, the shipped product',
    },
  },
  ARTIFACT_NAME_NOT_HOLDABLE: {
    spine: "Name the thing itself, not the act of making it — a noun you can point to.",
    examples: {
      musician: "e.g. 'Romance Riot tape', not 'completing the tape'",
      founder: "e.g. 'deployed MVP', not 'deploying the MVP'",
      writer: "e.g. 'finished manuscript', not 'finishing the manuscript'",
      generic: "e.g. 'the final report', not 'completing the report'",
    },
  },
  ARTIFACT_PRODUCING_PROJECT_UNRESOLVED: {
    spine: 'Which project produces this artifact? Pick the project it comes out of.',
    pickSet: 'producingProjectOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  ARTIFACT_COMPLETION_EVIDENCE_MISSING: {
    spine: 'What does this artifact look like when it exists — what would you show someone as proof?',
    examples: {
      musician: 'e.g. mastered audio file delivered to DistroKid, listed in catalog',
      founder: 'e.g. a live URL that returns 200, a Stripe customer record',
      writer: 'e.g. a manuscript file submitted through the agent portal with confirmation',
      generic: 'e.g. a signed contract saved in the folder, a certificate in the system',
    },
  },
  ARTIFACT_COMPLETION_EVIDENCE_NOT_VERIFIABLE: {
    spine: "That's not an externally-checkable state — name what exists that a third party could confirm without asking you.",
    examples: {
      musician: "e.g. 'mastered WAV listed on DistroKid and live in Spotify catalog', not 'done'",
      founder: "e.g. 'deployed URL returning 200 with a paying customer in Stripe', not 'shipped'",
      writer: "e.g. 'submission filed in the portal with Received status', not 'submitted'",
      generic: "e.g. 'signed contract filed with date and filed at the recorder', not 'completed'",
    },
  },
  ARTIFACT_VERIFICATION_SOURCE_UNRESOLVED: {
    spine: 'Which verification source confirms this artifact exists? Pick the tool or record you open to check.',
    pickSet: 'declaredSources',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  ARTIFACT_ATTESTATION_METHOD_MISSING: {
    spine: "What's the exact check — the step you perform to confirm this artifact is real and in place?",
    examples: {
      musician: 'e.g. open Spotify for Artists and confirm the release is live in the catalog',
      founder: 'e.g. open Stripe, filter by customer email, confirm the subscription is active',
      writer: 'e.g. log into the agent portal and confirm the submission shows Received',
      generic: 'e.g. open the records system and confirm the entry exists with a timestamp',
    },
  },
  ARTIFACT_ATTESTATION_METHOD_NOT_SUBSTANTIVE: {
    spine: "Name the exact step — what tool you open and what you look for, not a general description.",
    examples: {
      musician: "e.g. 'open Spotify for Artists, confirm it's live', not 'check that it's up'",
      founder: "e.g. 'open Stripe and find the customer record', not 'verify it works'",
      writer: "e.g. 'log into the portal and see Received status', not 'confirm it went through'",
      generic: "e.g. 'open the system and find the entry with the ID', not 'check it exists'",
    },
  },
};
