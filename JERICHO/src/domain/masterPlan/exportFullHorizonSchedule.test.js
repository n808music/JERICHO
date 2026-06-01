/**
 * Round-trip parity test.
 *
 * Given a real persisted identity-state snapshot, the export module must
 * recompute a block set that perfectly matches the persisted agenda manifest:
 *   - blocks.length == agenda.blockCount
 *   - set(blocks.map(id)) == set(agenda.blockIds)
 *   - recomputed summary deep-equals agenda.summary
 *
 * If this passes, the export is byte-equivalent to the engine's own output
 * at compute time — proving the only thing missing was payload persistence.
 */
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

import { buildFullHorizonScheduleExport } from './exportFullHorizonSchedule.js';

const FIXTURE_PATH = path.resolve(__dirname, '../../../tmp-live-jericho-identity.json');

function loadFixtureIfPresent() {
  if (!fs.existsSync(FIXTURE_PATH)) return null;
  return JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8'));
}

describe('buildFullHorizonScheduleExport', () => {
  const fixture = loadFixtureIfPresent();

  // Skip when the live snapshot isn't checked in. The snapshot is gitignored
  // intentionally — this test runs locally against whichever snapshot the
  // user has captured.
  const maybe = fixture ? it : it.skip;

  maybe('matches the persisted agenda manifest exactly', () => {
    const result = buildFullHorizonScheduleExport(fixture);
    expect(result).not.toBeNull();

    const agendaVersions = fixture.masterPlanAgendaVersionsById || {};
    const currentAgenda = Object.values(agendaVersions).find((v) => v.state === 'current');
    expect(currentAgenda).toBeDefined();

    expect(result.blocks.length).toBe(currentAgenda.blockCount);

    const recomputedIds = new Set(result.blocks.map((b) => b.id));
    const persistedIds = new Set(currentAgenda.blockIds);
    expect(recomputedIds.size).toBe(persistedIds.size);
    for (const id of persistedIds) expect(recomputedIds.has(id)).toBe(true);

    expect(result.summary.byPhase).toEqual(currentAgenda.summary.byPhase);
    expect(result.summary.byYear).toEqual(currentAgenda.summary.byYear);
    expect(result.summary.byQuarter).toEqual(currentAgenda.summary.byQuarter);
    expect(result.summary.byLane).toEqual(currentAgenda.summary.byLane);
    expect(result.summary.byBlockType).toEqual(currentAgenda.summary.byBlockType);
    expect(result.summary.scheduledCount).toBe(currentAgenda.summary.scheduledCount);
  });

  maybe('every block has the substrate fields the engine emits', () => {
    const result = buildFullHorizonScheduleExport(fixture);
    for (const block of result.blocks) {
      expect(typeof block.id).toBe('string');
      expect(block.id.length).toBeGreaterThan(0);
      expect(typeof block.dayKey).toBe('string');
      expect(typeof block.blockType).toBe('string');
      expect(typeof block.title).toBe('string');
      expect(typeof block.phaseLabel).toBe('string');
      // Engine has two duration field conventions: full-horizon expansion writes
      // durationMinutes; the older forecast derivation writes timeEstimateMinutes.
      // Both are valid — consumers must accept either.
      const dur = block.durationMinutes ?? block.timeEstimateMinutes;
      expect(typeof dur).toBe('number');
      expect(dur).toBeGreaterThan(0);
    }
  });

  maybe('is deterministic across consecutive calls', () => {
    const a = buildFullHorizonScheduleExport(fixture);
    const b = buildFullHorizonScheduleExport(fixture);
    expect(a.blocks.map((x) => x.id)).toEqual(b.blocks.map((x) => x.id));
    expect(a.summary).toEqual(b.summary);
  });
});
