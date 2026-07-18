// Bootstrap reprobes. Merge into REPROBES. Only two codes — bootstrap is a
// SELECTION, not an authored-field elicitation. The candidate set is computed
// and presented ordered by the binding constraint; the operator picks one.

export const BOOTSTRAP_REPROBES = {
  BOOTSTRAP_SELECTION_MISSING: {
    spine:
      "Here's where you can begin — the things nothing is blocking, ordered by what binds you most. Pick the one you'll start on.",
    pickSet: 'bootstrapCandidateOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
  BOOTSTRAP_SELECTION_NOT_CANDIDATE: {
    spine:
      "That one isn't startable yet — something has to exist before it. Pick from the ones nothing is blocking.",
    pickSet: 'bootstrapCandidateOptions',
    examples: { musician: '', founder: '', writer: '', generic: '' },
  },
};
