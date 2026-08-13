/**
 * Sequencing Strategy reprobe definitions (gate-failure codes).
 *
 * Every gate in SEQUENCING_STRATEGY_SLOT.gate[] must have a corresponding
 * reprobe spine + examples for when the gate fails (field missing).
 *
 * These are authored once and never generated. Adaptivity is in the
 * per-goalType examples table, not the spine.
 */

export const SEQUENCING_REPROBES = {
  SEQUENCING_CATEGORY_MISSING: {
    spine: 'Has this category seen proven, non-commoditized winners before?',
    examples: {
      musician:
        'e.g. Has there been a successful artist/band with this sound/style before you?',
      founder:
        'e.g. Has a founder successfully built and scaled a business in this market segment before?',
      writer:
        'e.g. Has this genre or format produced commercially successful published work before?',
      generic: 'e.g. Does this market have successful precedent, or is it truly novel?',
    },
  },

  SEQUENCING_AUDIENCE_MISSING: {
    spine:
      'Do your target customers have prior successful relationships with similar offerings?',
    examples: {
      musician:
        'e.g. Have they supported similar artists, or is this their first exposure to this sound?',
      founder:
        'e.g. Have your customers bought similar products, or is this their first venture into this category?',
      writer:
        'e.g. Have your readers engaged with similar content before, or is this a new genre for them?',
      generic:
        'e.g. Do your customers have buying history in this category, or is this novel to them?',
    },
  },

  SEQUENCING_DENSITY_MISSING: {
    spine: 'Is this category highly competitive or is it underserved?',
    examples: {
      musician:
        'e.g. Is this sound saturated with artists (competitive) or are few people making it (underserved)?',
      founder:
        'e.g. Are there many competitors in this space (competitive) or few players (underserved)?',
      writer:
        'e.g. Is this genre flooded with titles (competitive) or are few books written in it (underserved)?',
      generic:
        'e.g. Many players fighting for share (competitive) or few suppliers to meet demand (underserved)?',
    },
  },
};
