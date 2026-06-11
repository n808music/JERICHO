/**
 * Integration test for the in-app Export Full Schedule button (PDF flow).
 *
 * Mounts the button with the real persisted identity-state fixture, mocks
 * pdfmake's createPdf so we can capture the docDefinition + filename, and
 * confirms the click pipeline produces a valid PDF doc descriptor naming a
 * .pdf file with the expected slug pattern.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';
import React from 'react';

const FIXTURE_PATH = path.resolve(__dirname, '../../../tmp-live-jericho-identity.json');
const haveFixture = fs.existsSync(FIXTURE_PATH);
const fixture = haveFixture ? JSON.parse(fs.readFileSync(FIXTURE_PATH, 'utf-8')) : null;

vi.mock('../../state/identityStore', () => ({
  useIdentityStore: () => fixture,
}));

let lastDocDefinition = null;
let lastFilename = null;
let lastVfs = null;
let downloadImpl = vi.fn(async (filename) => {
  lastFilename = filename;
});

vi.mock('pdfmake/build/pdfmake.js', () => ({
  default: {
    addVirtualFileSystem: (vfs) => {
      lastVfs = vfs;
    },
    createPdf: (doc) => {
      lastDocDefinition = doc;
      return {
        download: (filename) => downloadImpl(filename),
      };
    },
    vfs: {},
  },
}));

vi.mock('pdfmake/build/vfs_fonts.js', () => ({
  default: {
    'Roboto-Regular.ttf': 'regular-font-bytes',
    'Roboto-Medium.ttf': 'medium-font-bytes',
    'Roboto-Italic.ttf': 'italic-font-bytes',
    'Roboto-MediumItalic.ttf': 'medium-italic-font-bytes',
  },
  vfs: {},
}));

import ExportFullScheduleButton from './ExportFullScheduleButton.jsx';

function flatten(node, out = []) {
  if (node == null) return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const child of node) flatten(child, out);
    return out;
  }
  if (typeof node === 'object') {
    if (node.text != null) flatten(node.text, out);
    if (node.columns) flatten(node.columns, out);
    if (node.stack) flatten(node.stack, out);
    if (node.ul) flatten(node.ul, out);
    if (node.ol) flatten(node.ol, out);
    if (node.table?.body) flatten(node.table.body, out);
  }
  return out;
}

const maybe = haveFixture ? describe : describe.skip;

maybe('ExportFullScheduleButton (PDF flow)', () => {
  beforeEach(() => {
    lastDocDefinition = null;
    lastFilename = null;
    lastVfs = null;
    downloadImpl = vi.fn(async (filename) => {
      lastFilename = filename;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the button', () => {
    render(<ExportFullScheduleButton />);
    expect(screen.getByRole('button', { name: /export full schedule/i })).toBeDefined();
  });

  it('downloads a PDF with the full-horizon doc definition when clicked', async () => {
    render(<ExportFullScheduleButton />);
    fireEvent.click(screen.getByRole('button', { name: /export full schedule/i }));

    await waitFor(() => {
      expect(lastFilename).not.toBeNull();
      expect(lastDocDefinition).not.toBeNull();
    });

    expect(lastFilename).toMatch(/^jericho-.*-full-schedule-\d{4}-\d{2}-\d{2}\.pdf$/);
    expect(Array.isArray(lastDocDefinition.content)).toBe(true);

    const text = flatten(lastDocDefinition.content).join('\n');
    expect(text).toMatch(/Operation Endgame/);
    expect(text).toMatch(/Full schedule/);
    expect(text).toMatch(/Operation Endgame Public Launch Convergence/);
    // At least one day heading appears.
    expect(text).toMatch(/(Sun|Mon|Tue|Wed|Thu|Fri|Sat) \d{4}-\d{2}-\d{2}/);
    expect(lastVfs).toMatchObject({
      'Roboto-Regular.ttf': 'regular-font-bytes',
      'Roboto-Medium.ttf': 'medium-font-bytes',
    });
  });

  it('shows status message after a successful export', async () => {
    render(<ExportFullScheduleButton />);
    fireEvent.click(screen.getByRole('button', { name: /export full schedule/i }));
    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/exported \d+ blocks/i);
    });
  });

  it('does not show success if the PDF download fails', async () => {
    const error = new Error('File \'Roboto-Medium.ttf\' not found in virtual file system');
    downloadImpl = vi.fn(async () => {
      throw error;
    });
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ExportFullScheduleButton />);
    fireEvent.click(screen.getByRole('button', { name: /export full schedule/i }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent(/export failed:/i);
    });

    expect(screen.queryByText(/exported \d+ blocks/i)).toBeNull();
    expect(consoleErrorSpy).toHaveBeenCalledWith('Full schedule PDF export failed:', error);
  });
});
