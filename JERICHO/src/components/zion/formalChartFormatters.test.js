import { describe, it, expect } from 'vitest';
import {
  isInternalId,
  shortenInternalId,
  formatBlockRef,
  formatArtifactLabel,
  formatConsumedArtifacts,
  formatGateSummary,
} from './formalChartFormatters.js';

describe('isInternalId', () => {
  it('returns true for fh- prefixed IDs', () => {
    expect(isInternalId('fh-masterplan-2b657ad0-988e-4cc6-bb1e-5ffd359bbf3c-P1-lane-x-2026-05-19-0')).toBe(true);
  });
  it('returns true for artifact: prefixed IDs', () => {
    expect(isInternalId('artifact:fh-masterplan-2b657ad0-988e')).toBe(true);
  });
  it('returns true for UUID-shape strings', () => {
    expect(isInternalId('aab862ed-8f27-4d7d-bd4e-81dc7d08c1cf')).toBe(true);
  });
  it('returns false for normal short labels', () => {
    expect(isInternalId('launch-proof packet')).toBe(false);
    expect(isInternalId('Block 001')).toBe(false);
    expect(isInternalId(null)).toBe(false);
    expect(isInternalId('')).toBe(false);
  });
});

describe('shortenInternalId', () => {
  it('takes the trailing date-suffix segment when present', () => {
    expect(shortenInternalId('fh-masterplan-2b657ad0-2026-05-19-0')).toMatch(/2026-05-19-0$/);
  });
  it('returns the input if already short', () => {
    expect(shortenInternalId('abc123')).toBe('abc123');
  });
  it('handles null/undefined', () => {
    expect(shortenInternalId(null)).toBe('');
    expect(shortenInternalId(undefined)).toBe('');
  });
});

describe('formatBlockRef', () => {
  it('produces phase + family + index when available', () => {
    const block = { phaseLabel: 'P1', laneLabel: 'Operation Endgame product engine', laneTitle: 'Operation Endgame product engine' };
    const ref = formatBlockRef(block, 0);
    expect(ref).toMatch(/^P1/);
    expect(ref).toMatch(/001$/);
  });
  it('falls back to Block NNN when phase/lane missing', () => {
    expect(formatBlockRef({}, 4)).toBe('Block 005');
  });
  it('pads the index to 3 digits', () => {
    expect(formatBlockRef({}, 0)).toBe('Block 001');
    expect(formatBlockRef({}, 99)).toBe('Block 100');
  });
});

describe('formatArtifactLabel', () => {
  it('looks up the registry to convert artifact id to artifactName', () => {
    const registry = { 'artifact:fh-x-1': { artifactName: 'launch-proof packet' } };
    expect(formatArtifactLabel('artifact:fh-x-1', registry)).toBe('launch-proof packet');
  });
  it('returns the input unchanged when it does not look like an internal id', () => {
    expect(formatArtifactLabel('release notes', {})).toBe('release notes');
  });
  it('falls back to shortened id when registry has no entry', () => {
    const result = formatArtifactLabel('artifact:fh-x-unknown-12345', {});
    expect(result).not.toBe('');
    expect(result.length).toBeLessThan(20);
  });
});

describe('formatConsumedArtifacts', () => {
  it('returns dash when empty', () => {
    expect(formatConsumedArtifacts([], {}, new Map())).toBe('—');
  });
  it('returns single semantic label when registry hits', () => {
    const registry = { 'artifact:fh-x-1': { artifactName: 'launch-proof packet' } };
    expect(formatConsumedArtifacts(['artifact:fh-x-1'], registry, new Map())).toBe('launch-proof packet');
  });
  it('summarizes count when multiple semantic labels', () => {
    const registry = {
      'artifact:fh-x-1': { artifactName: 'release notes' },
      'artifact:fh-x-2': { artifactName: 'qa checklist' },
      'artifact:fh-x-3': { artifactName: 'telemetry review' },
    };
    const result = formatConsumedArtifacts(['artifact:fh-x-1','artifact:fh-x-2','artifact:fh-x-3'], registry, new Map());
    expect(result).toMatch(/release notes|qa checklist|telemetry review|3 upstream/);
    expect(result).not.toContain('artifact:');
  });
  it('uses block lookup when artifact id resolves to a block id', () => {
    const idToBlock = new Map([['fh-x-1', { outputArtifact: { artifactName: 'product proof' } }]]);
    expect(formatConsumedArtifacts(['fh-x-1'], {}, idToBlock)).toBe('product proof');
  });
});

describe('formatGateSummary', () => {
  it('returns dash for non-gate blocks', () => {
    expect(formatGateSummary({ blockType: 'action' })).toBe('—');
    expect(formatGateSummary({ blockType: 'review' })).toBe('—');
    expect(formatGateSummary({})).toBe('—');
  });
  it('produces compact summary for gate blocks', () => {
    const gate = {
      blockType: 'gate',
      gateCriteria: {
        metricName: 'launch readiness',
        threshold: 'validated_proof_artifacts >= 1',
        acceptanceCriteria: 'Upstream proof threshold met.',
      },
    };
    const result = formatGateSummary(gate);
    expect(result).toMatch(/launch readiness/);
    expect(result.length).toBeLessThan(200);
    expect(result).not.toContain('{');
  });
  it('falls back to dash when gateCriteria object missing on gate-type block', () => {
    expect(formatGateSummary({ blockType: 'gate' })).toBe('—');
  });
});
