import { describe, it, expect } from 'vitest';
import { summarizeBlockDetailQuality } from './fullHorizonPlanQuality.js';

// Molecular block-detail advisories are UI/display clarity signals.
// They should remain visible in block detail rendering, but they should NOT
// count as full-horizon trust failures unless the underlying schedule
// substrate is missing.

const OE_SHAPED_BLOCK = {
  id: 'fh-test-product-p1-001',
  title: 'Sequence release asset completion for Operation Endgame in P1 product lane',
  source: 'derived',
  laneId: 'product',
  laneLabel: 'Product',
  phaseLabel: 'P1',
  blockType: 'gate',
  // OE schedule generator populates expectedOutput at the block level:
  expectedOutput: 'Release asset list with dated ownership. Deliver release-proof packet.',
  // OE schedule generator does NOT populate the following at the block level
  // — they are computed by resolveBlockPlainLanguage from the breakdown:
  // acceptanceEvidence: undefined,
  // plainAction: undefined,
  // steps: undefined,
  // doneWhen: undefined,
};

describe('summarizeBlockDetailQuality', () => {
  it('does not downgrade full-horizon trust for display-only molecular advisory codes', () => {
    // Resolver will emit BLOCK_DETAIL_TOO_ABSTRACT / BLOCK_DETAIL_DO_THIS_EMPTY /
    // BLOCK_DETAIL_DONE_WHEN_EMPTY because acceptanceEvidence / plainAction /
    // steps / doneWhen are not generator-level block fields. The gate must
    // ignore these advisory codes.
    const summary = summarizeBlockDetailQuality([OE_SHAPED_BLOCK]);
    expect(summary.failureCount).toBe(0);
    expect(summary.failureCodes).toHaveLength(0);
  });

  it('does not downgrade trust when many OE-shaped blocks emit only advisory codes', () => {
    const blocks = Array.from({ length: 50 }, (_, i) => ({
      ...OE_SHAPED_BLOCK,
      id: `fh-test-product-p1-${String(i).padStart(3, '0')}`,
    }));
    const summary = summarizeBlockDetailQuality(blocks);
    expect(summary.failureCount).toBe(0);
  });

  it('returns empty findings array when only advisory codes are present', () => {
    const summary = summarizeBlockDetailQuality([OE_SHAPED_BLOCK]);
    expect(summary.findings).toHaveLength(0);
    expect(summary.codeCounts).toEqual({});
  });

  it('does not downgrade trust for forecast-only placeholder language emitted by derived horizon blocks', () => {
    const summary = summarizeBlockDetailQuality([
      {
        ...OE_SHAPED_BLOCK,
        id: 'fh-test-forecast-placeholder-001',
        source: 'derived',
        title:
          'Produce next release asset increment for Operation Endgame album release engine in P1 creative project lane using distribution readiness for the May 2026 review window',
      },
    ]);
    expect(summary.failureCount).toBe(0);
    expect(summary.failureCodes).toHaveLength(0);
  });
});
