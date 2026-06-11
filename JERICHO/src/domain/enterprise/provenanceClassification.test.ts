import { describe, it, expect } from 'vitest';
import { classifyProvenance } from './provenanceClassification';

describe('classifyProvenance', () => {
  it('returns intake_declared when an exact lane name appears in intake text', () => {
    const result = classifyProvenance({
      laneId: 'product',
      laneLabel: 'Product',
      intakeSignals: {
        goalText: 'Build product, creative, media, operations lanes.',
        declaredLaneIds: ['product', 'creative', 'media', 'operations'],
      },
    });
    expect(result.status).toBe('intake_declared');
    expect(result.sourceEvidence).toContain('declaredLaneIds');
  });

  it('returns intake_normalized when civic was declared but display normalizes to Real Estate', () => {
    const result = classifyProvenance({
      laneId: 'civic',
      laneLabel: 'Civic',
      normalizedDisplayName: 'Global State Holdings',
      intakeSignals: {
        goalText: 'Civic pathways across the 5-year horizon.',
        declaredLaneIds: ['civic'],
      },
    });
    expect(result.status).toBe('intake_normalized');
  });

  it('returns system_placeholder when lane has no intake signal at all', () => {
    const result = classifyProvenance({
      laneId: 'energy_gym',
      laneLabel: 'Energy Gym',
      intakeSignals: {
        goalText: 'Build product, creative, media lanes.',
        declaredLaneIds: ['product', 'creative', 'media'],
      },
    });
    expect(result.status).toBe('system_placeholder');
  });

  it('returns system_inferred when goal text mentions the concept without declaring a lane', () => {
    const result = classifyProvenance({
      laneId: 'capital',
      laneLabel: 'Capital',
      intakeSignals: {
        goalText:
          'Build product, creative, and media. Funded capital pathway by 2031.',
        declaredLaneIds: ['product', 'creative', 'media'],
      },
    });
    expect(result.status).toBe('system_inferred');
  });

  it('returns deprecated when the lane is on the deprecated list', () => {
    const result = classifyProvenance({
      laneId: 'civic',
      laneLabel: 'Civic',
      isDeprecatedLabel: true,
      intakeSignals: { goalText: '', declaredLaneIds: [] },
    });
    expect(result.status).toBe('deprecated');
  });

  it('returns unsupported when the entity has no map entry and no intake support', () => {
    const result = classifyProvenance({
      laneId: 'unknown_lane',
      laneLabel: 'Unknown',
      hasMapEntry: false,
      intakeSignals: { goalText: '', declaredLaneIds: [] },
    });
    expect(result.status).toBe('unsupported');
  });
});
