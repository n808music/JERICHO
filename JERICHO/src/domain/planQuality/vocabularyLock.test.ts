import { describe, it, expect } from 'vitest';
import { ACTION_VERB_SET } from './actionVerbs';
import { LEAD_MGMT_VERBS, JARGON_WORDS, isAbstractJargon } from './isAbstractJargon';

// VOCABULARY LOCK (Gate 6, 2026-07-17). The two controlled vocabularies that drive the
// plan-quality / block-title gates are FROZEN here. This test fails on ANY silent add or
// removal — changing a list requires a deliberate edit to BOTH the source and the frozen
// array below. That is the whole point: no ad-hoc drift; every change is reviewed.

const FROZEN_ACTION_VERBS = [
  'activate', 'advance', 'analyze', 'archive', 'assemble', 'assess', 'audit', 'author', 'backup',
  'brief', 'build', 'capture', 'clarify', 'close', 'collect', 'communicate', 'compare', 'compile',
  'complete', 'configure', 'confirm', 'connect', 'consolidate', 'convert', 'coordinate', 'create',
  'debug', 'define', 'delegate', 'deliver', 'demo', 'deploy', 'design', 'develop', 'document',
  'draft', 'enrich', 'establish', 'evaluate', 'execute', 'expand', 'finalize', 'fix', 'formalize',
  'gate', 'gather', 'generate', 'groom', 'harden', 'hire', 'identify', 'implement', 'improve',
  'institutionalize', 'integrate', 'launch', 'log', 'map', 'measure', 'migrate', 'model', 'monitor',
  'onboard', 'optimize', 'outline', 'package', 'plan', 'prepare', 'present', 'produce', 'prototype',
  'prove', 'publish', 'qualify', 'reassess', 'reconcile', 'record', 'release', 'resolve', 'review',
  'revise', 'run', 'secure', 'select', 'sequence', 'set', 'share', 'ship', 'source', 'stabilize',
  'stress-test', 'submit', 'summarize', 'sync', 'test', 'track', 'train', 'triage', 'update',
  'validate', 'verify', 'widen', 'write',
];

const FROZEN_LEAD_MGMT_VERBS = [
  'coordinate', 'deliver', 'drive', 'enable', 'execute', 'facilitate', 'leverage', 'manage', 'support',
];

const FROZEN_JARGON_WORDS = [
  'alignment', 'alignments', 'bandwidth', 'capabilities', 'capability', 'competencies', 'competency',
  'efficiencies', 'efficiency', 'excellence', 'ideate', 'optimization', 'optimize', 'paradigm',
  'paradigms', 'solution', 'solutions', 'synergies', 'synergize', 'synergy', 'traction',
  'transformation', 'transformations', 'value',
];

describe('vocabulary lock (Gate 6) — frozen controlled vocabularies', () => {
  it('ACTION_VERB_SET matches the frozen allowlist exactly (no silent drift)', () => {
    expect([...ACTION_VERB_SET].sort()).toEqual([...FROZEN_ACTION_VERBS].sort());
  });

  it('the removed re-clarify compound is gone (debt cleared)', () => {
    expect(ACTION_VERB_SET.has('re-clarify')).toBe(false);
    expect(ACTION_VERB_SET.has('revise')).toBe(true); // its canonical replacement
  });

  it('isAbstractJargon lead management verbs match the frozen list exactly', () => {
    expect([...LEAD_MGMT_VERBS].sort()).toEqual([...FROZEN_LEAD_MGMT_VERBS].sort());
  });

  it('isAbstractJargon dead nouns match the frozen list exactly', () => {
    expect([...JARGON_WORDS].sort()).toEqual([...FROZEN_JARGON_WORDS].sort());
  });

  it('countable jargon nouns carry both forms; the values exception holds', () => {
    for (const [sing, plur] of [
      ['alignment', 'alignments'], ['transformation', 'transformations'], ['paradigm', 'paradigms'],
      ['competency', 'competencies'], ['efficiency', 'efficiencies'],
    ]) {
      expect(isAbstractJargon(sing)).toBe(true);
      expect(isAbstractJargon(plur)).toBe(true);
    }
    expect(isAbstractJargon('value')).toBe(true);   // singular management-speak
    expect(isAbstractJargon('values')).toBe(false); // principles — deliberately not jargon
  });

  it('the lead-management-verb regex still matches both base and -s forms', () => {
    expect(isAbstractJargon('manage the rollout')).toBe(true);
    expect(isAbstractJargon('manages the rollout')).toBe(true);
    expect(isAbstractJargon('ship the release')).toBe(false); // concrete action verb, not flagged
  });
});
