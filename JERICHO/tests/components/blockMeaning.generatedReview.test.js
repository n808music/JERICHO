import { describe, expect, it } from 'vitest';

import { describeBlockMeaning } from '../../src/components/zion/blockMeaning.js';

describe('block meaning for generated review blocks', () => {
  it('does not label schedule-review blocks as manual when they come from generated output', () => {
    const meaning = describeBlockMeaning({
      id: 'review-1',
      origin: 'schedule_review',
      title: 'Confirm Operation Endgame hard anchors',
      start: '2026-06-15T14:00:00.000Z',
      end: '2026-06-15T14:45:00.000Z',
      status: 'planned',
    });

    expect(meaning.summaryText).toContain('Canonical scheduled block');
    expect(meaning.summaryText).not.toContain('Manual block');
  });
});
