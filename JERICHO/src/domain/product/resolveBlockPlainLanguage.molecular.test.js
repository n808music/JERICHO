import { describe, it, expect } from 'vitest';
import { resolveBlockPlainLanguage } from './resolveBlockPlainLanguage.js';

const HIERARCHY = {
  block: 'Operator review',
  lane: 'Operations',
  phase: 'P1',
};

describe('resolveBlockPlainLanguage molecular sections', () => {
  it('flags under_specified when expectedOutput is empty', () => {
    const block = {
      id: 'a',
      label: 'Review thing',
      laneId: 'operations',
      expectedOutput: '',
      acceptanceEvidence: 'a saved review',
      plainAction: 'Do the review',
      steps: ['Open the file', 'Mark each row', 'Sign off'],
      doneWhen: 'All rows signed',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality?.status).toBe('under_specified');
    expect(result.quality?.failureCodes).toContain('BLOCK_DETAIL_TOO_ABSTRACT');
  });

  it('flags under_specified when acceptanceEvidence is generic', () => {
    const block = {
      id: 'b',
      label: 'Review thing',
      laneId: 'operations',
      expectedOutput: 'A control sheet',
      acceptanceEvidence: 'TBD',
      plainAction: 'Do the review',
      steps: ['Open the file', 'Mark each row', 'Sign off'],
      doneWhen: 'All rows signed',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality?.status).toBe('under_specified');
    expect(result.quality?.failureCodes).toContain('BLOCK_DETAIL_TOO_ABSTRACT');
  });

  it('flags under_specified when steps array is empty', () => {
    const block = {
      id: 'c',
      label: 'Review thing',
      laneId: 'operations',
      expectedOutput: 'A control sheet',
      acceptanceEvidence: 'A saved sheet reviewed in May',
      plainAction: '',
      steps: [],
      doneWhen: 'All rows signed',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality?.status).toBe('under_specified');
    expect(result.quality?.failureCodes).toContain('BLOCK_DETAIL_DO_THIS_EMPTY');
  });

  it('passes when all five molecular sections have concrete content', () => {
    const block = {
      id: 'd',
      label: 'Operations control sheet review',
      laneId: 'operations',
      expectedOutput:
        'Operations checklist with each control, owner, review cadence, dependency, and next gate date.',
      acceptanceEvidence:
        'A saved checklist that can be opened and reviewed during the May 2026 operating review.',
      plainAction: 'Open the operations checklist and review each control.',
      steps: [
        'Open the operations checklist file in the shared workspace.',
        'For every row, confirm owner, cadence, dependency, and next gate date.',
        'Save and notify the operating review chair.',
      ],
      doneWhen: 'All rows reviewed and the checklist is saved.',
    };
    const result = resolveBlockPlainLanguage(block, { hierarchy: HIERARCHY });
    expect(result.quality?.status).not.toBe('under_specified');
    expect(result.quality?.failureCodes || []).toHaveLength(0);
  });
});
