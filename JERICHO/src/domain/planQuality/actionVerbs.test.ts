import { describe, it, expect } from 'vitest';
import { ACTION_VERB_SET, isActionableTitleVerb } from './actionVerbs';

/**
 * Action-verb vocabulary must stay aligned with what the schedule generator
 * emits. New verbs are added when the generator produces titles the
 * actionability check rejects, only after confirming those verbs are
 * genuinely imperative.
 *
 * These verbs were drift-discovered in the Operation Endgame fixture
 * after the 2026-06-03 canonical-verbs work; 90 OE blocks tripped
 * BLOCK_TITLE_NOT_ACTIONABLE, which cascaded into balance-dimension
 * downgrades that pushed fullHorizonPlanQuality off 'trusted'.
 *
 * 're-clarify' was removed 2026-07-17 (Gate 6): the two generator titles it
 * served were redesigned to start with 'Revise', a canonical verb.
 */
const OE_SCHEDULER_VERBS = [
  'author',
  'capture',
  'clarify',
  'enrich',
  'groom',
  'log',
  'qualify',
  'source',
  'summarize',
  'triage',
];

describe('ACTION_VERB_SET — OE schedule-generator coverage', () => {
  it.each(OE_SCHEDULER_VERBS)(
    'accepts "%s" as an actionable title verb',
    (verb) => {
      expect(ACTION_VERB_SET.has(verb)).toBe(true);
      expect(isActionableTitleVerb(verb)).toBe(true);
    },
  );

  it('keeps the existing canonical verbs unchanged', () => {
    // Spot-check a sample that was already in the set before this expansion.
    ['draft', 'review', 'collect', 'communicate', 'evaluate', 'institutionalize'].forEach(
      (verb) => {
        expect(ACTION_VERB_SET.has(verb)).toBe(true);
      },
    );
  });

  it('still rejects clearly non-actionable first words', () => {
    ['the', 'and', 'overview', 'something'].forEach((word) => {
      expect(isActionableTitleVerb(word)).toBe(false);
    });
  });
});
