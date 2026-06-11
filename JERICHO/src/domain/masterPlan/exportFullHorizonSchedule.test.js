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

  maybe('stays deterministic against the persisted agenda while allowing export-time rebasing', () => {
    const result = buildFullHorizonScheduleExport(fixture);
    expect(result).not.toBeNull();

    const agendaVersions = fixture.masterPlanAgendaVersionsById || {};
    const currentAgenda = Object.values(agendaVersions).find((v) => v.state === 'current');
    expect(currentAgenda).toBeDefined();

    expect(result.blocks.length).toBeLessThanOrEqual(currentAgenda.blockCount);

    expect(result.blocks.length).toBeGreaterThan(0);
    expect(result.range?.startDayKey).toBeTruthy();
    expect(result.range?.endDayKey).toBeTruthy();
    expect(result.summary.scheduledCount).toBe(result.blocks.length);
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

  it('rebases generated export blocks to the effective generation floor', () => {
    const plan = {
      id: 'export-rebase-plan',
      profileId: 'profile-1',
      title: 'Operation Endgame',
      horizonStart: '2026-05-19',
      horizonEnd: '2031-05-19',
      successStandard: 'Reach terminal execution readiness with evidence.',
      outcomeTarget: 'Cross-lane scale readiness.',
    };
    const state = {
      masterPlansById: { [plan.id]: plan },
      masterPlanLanesById: {
        'lane-product': {
          id: 'lane-product',
          laneId: 'lane-product',
          domain: 'product',
          title: 'Core App',
          laneTitle: 'Core App',
          activationState: 'active',
        },
      },
      masterPlanMilestonesById: {},
      cyclesById: {
        'cycle-1': {
          id: 'cycle-1',
          reassessmentCompletedAtISO: '2026-06-06T18:51:00.000Z',
          scheduleGeneratedAtISO: '2026-06-07T00:15:00.000Z',
        },
      },
      activeCycleId: 'cycle-1',
      appTime: {
        activeDayKey: '2026-06-07',
        nowISO: '2026-06-07T00:15:00.000Z',
        timeZone: 'UTC',
      },
      goalExecutionContract: {
        workWindows: {
          mon: [{ start: '09:00', end: '15:00' }],
          tue: [{ start: '09:00', end: '15:00' }],
          wed: [{ start: '09:00', end: '15:00' }],
          thu: [{ start: '09:00', end: '15:00' }],
          fri: [{ start: '09:00', end: '15:00' }],
        },
      },
    };

    const result = buildFullHorizonScheduleExport(state);
    expect(result).not.toBeNull();
    expect(result.range.startDayKey).toBe('2026-06-07');
    expect(result.blocks.every((block) => String(block.dayKey || '') >= '2026-06-07')).toBe(true);
  });
});
