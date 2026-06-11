import { describe, it, expect } from 'vitest';
import {
  formatBlockRef,
  formatArtifactLabel,
  formatConsumedArtifacts,
  formatGateSummary,
  isInternalId,
} from '../../src/components/zion/formalChartFormatters.js';

const RAW_BLOCK_ID = 'fh-masterplan-2b657ad0-988e-4cc6-bb1e-5ffd359bbf3c-P1-lane-x-2026-05-19-0';
const RAW_ARTIFACT_ID_1 = 'artifact:fh-masterplan-2b657ad0-988e-4cc6-bb1e-5ffd359bbf3c-P1-lane-x-2026-05-19-0';
const RAW_ARTIFACT_ID_2 = 'artifact:fh-masterplan-2b657ad0-988e-4cc6-bb1e-5ffd359bbf3c-P1-lane-y-2026-05-20-0';

const SAMPLE_REGISTRY = {
  [RAW_ARTIFACT_ID_1]: { artifactName: 'launch-proof packet' },
  [RAW_ARTIFACT_ID_2]: { artifactName: 'onboarding clearance' },
};

describe('Formal chart readability — synthetic rows', () => {
  it('block ref is short and does not contain the raw block id', () => {
    const block = { id: RAW_BLOCK_ID, phaseLabel: 'P1', laneLabel: 'Operation Endgame product engine' };
    const ref = formatBlockRef(block, 0);
    expect(ref.length).toBeLessThan(30);
    expect(ref).not.toContain('fh-');
    expect(ref).not.toContain(RAW_BLOCK_ID);
    expect(isInternalId(ref)).toBe(false);
  });

  it('consumed artifacts cell uses semantic labels, not raw IDs', () => {
    const label = formatConsumedArtifacts([RAW_ARTIFACT_ID_1], SAMPLE_REGISTRY, new Map());
    expect(label).toBe('launch-proof packet');
    expect(label).not.toContain('artifact:');
    expect(label).not.toContain('fh-');
  });

  it('consumed artifacts cell summarizes multiple upstream as count + leader', () => {
    const label = formatConsumedArtifacts(
      [RAW_ARTIFACT_ID_1, RAW_ARTIFACT_ID_2],
      SAMPLE_REGISTRY,
      new Map(),
    );
    expect(label).toMatch(/launch-proof packet|onboarding clearance/);
    expect(label).not.toContain('artifact:');
    expect(label).not.toContain('fh-');
  });

  it('consumed artifacts cell falls back gracefully when registry is empty', () => {
    const label = formatConsumedArtifacts([RAW_ARTIFACT_ID_1], {}, new Map());
    expect(label).not.toContain('artifact:fh-masterplan-2b657ad0');
    expect(label.length).toBeLessThan(50);
  });

  it('output artifact label uses registry when given a raw id', () => {
    const label = formatArtifactLabel(RAW_ARTIFACT_ID_1, SAMPLE_REGISTRY);
    expect(label).toBe('launch-proof packet');
  });

  it('non-gate rows show dash for gate summary', () => {
    expect(formatGateSummary({ blockType: 'action' })).toBe('—');
    expect(formatGateSummary({ blockType: 'review' })).toBe('—');
  });

  it('gate rows show compact human summary, never a raw object dump', () => {
    const gate = {
      blockType: 'gate',
      gateCriteria: {
        metricName: 'launch readiness',
        threshold: 'validated_proof_artifacts >= 1 && critical_blockers_open = 0',
        acceptanceCriteria: 'Upstream proof threshold met.',
      },
    };
    const summary = formatGateSummary(gate);
    expect(summary).toContain('launch readiness');
    expect(summary.length).toBeLessThan(160);
    expect(summary).not.toContain('{');
    expect(summary).not.toContain('}');
  });

  it('no helper returns a string containing the raw block id substring', () => {
    const block = { id: RAW_BLOCK_ID, phaseLabel: 'P1', laneLabel: 'Operation Endgame product engine' };
    expect(formatBlockRef(block, 0)).not.toContain(RAW_BLOCK_ID);
    expect(formatGateSummary(block)).not.toContain(RAW_BLOCK_ID);
  });
});
