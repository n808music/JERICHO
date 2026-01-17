import { describe, it, expect } from 'vitest';
import { UI_AUTHORITY_MAP } from '../../src/contracts/uiAuthorityMap.ts';

describe('dead UI detector: generate plan', () => {
  it('generate plan has authoritative wiring or is explicitly disabled', () => {
    const entry = UI_AUTHORITY_MAP['suggestedPath.generatePlan'];
    expect(entry).toBeTruthy();
    expect(entry.authority).not.toBe('REFLECTIVE');
    expect(entry.writes && entry.writes.length).toBeTruthy();
    expect(entry.enforcedBy && entry.enforcedBy.length).toBeTruthy();
  });
});
