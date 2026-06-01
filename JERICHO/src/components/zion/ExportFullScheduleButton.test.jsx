/**
 * Integration test for the in-app Export Full Schedule button.
 *
 * Mounts the button with the real persisted identity-state fixture, simulates
 * the click, and asserts the download payload is the expected full-horizon
 * bundle. This is the closest reproducible equivalent to clicking the button
 * in a real browser — it exercises the same React handler against the same
 * state, the same export module, and the same Blob/download wiring.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';

const FIXTURE_PATH = path.resolve(__dirname, '../../../tmp-live-jericho-identity.json');
const haveFixture = fs.existsSync(FIXTURE_PATH);
const fixture = haveFixture ? JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) : null;

vi.mock('../../state/identityStore', () => ({
  useIdentityStore: () => fixture,
}));

import ExportFullScheduleButton from './ExportFullScheduleButton.jsx';

const maybe = haveFixture ? describe : describe.skip;

maybe('ExportFullScheduleButton (browser-equivalent click test)', () => {
  let capturedBlobParts = null;
  let capturedBlobType = null;
  let capturedFilename = null;
  let OrigBlob;

  beforeEach(() => {
    capturedBlobParts = null;
    capturedBlobType = null;
    capturedFilename = null;
    OrigBlob = global.Blob;
    // Capture raw parts at Blob construction so we don't depend on Blob.text()
    // (jsdom's Blob polyfill doesn't implement async text extraction).
    global.Blob = function MockBlob(parts, options) {
      capturedBlobParts = parts;
      capturedBlobType = options?.type || null;
      return new OrigBlob(parts, options);
    };
    global.URL.createObjectURL = vi.fn(() => 'blob:mock-url');
    global.URL.revokeObjectURL = vi.fn();
    const origCreate = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tag) => {
      const el = origCreate(tag);
      if (tag === 'a') {
        const origClick = el.click;
        el.click = function () {
          capturedFilename = this.download;
          // do not actually navigate
          if (origClick) {
            // skip: we don't want the jsdom anchor to do anything
          }
        };
      }
      return el;
    });
  });

  afterEach(() => {
    global.Blob = OrigBlob;
    vi.restoreAllMocks();
  });

  it('renders the button', () => {
    render(<ExportFullScheduleButton />);
    expect(screen.getByRole('button', { name: /export full schedule/i })).toBeDefined();
  });

  it('downloads a JSON file with the full-horizon bundle when clicked', async () => {
    render(<ExportFullScheduleButton />);
    const button = screen.getByRole('button', { name: /export full schedule/i });
    fireEvent.click(button);

    expect(capturedBlobParts).not.toBeNull();
    expect(capturedBlobType).toBe('application/json');
    expect(capturedFilename).toMatch(/^jericho-.*-full-schedule-\d{4}-\d{2}-\d{2}\.json$/);

    const bundle = JSON.parse(capturedBlobParts.join(''));

    const agenda = Object.values(fixture.masterPlanAgendaVersionsById).find((v) => v.state === 'current');

    expect(bundle.meta.agendaVersionId).toBe(agenda.id);
    expect(bundle.masterPlan.title).toBe('Operation Endgame');
    expect(bundle.fullHorizonBlocks.length).toBe(agenda.blockCount);
    expect(bundle.cycleBlocks.length).toBe((fixture.proposedBlocks || []).length);
    expect(Object.keys(bundle.lanes).length).toBe(8);
    expect(bundle.milestones.length).toBe(39);

    // Every full-horizon block carries the substrate fields the doc builder needs.
    for (const b of bundle.fullHorizonBlocks) {
      expect(typeof b.id).toBe('string');
      expect(typeof b.dayKey).toBe('string');
      expect(typeof b.title).toBe('string');
      expect(typeof b.blockType).toBe('string');
    }
  });

  it('shows status message after a successful export', () => {
    render(<ExportFullScheduleButton />);
    fireEvent.click(screen.getByRole('button', { name: /export full schedule/i }));
    expect(screen.getByText(/exported \d+ blocks/i)).toBeDefined();
  });
});
