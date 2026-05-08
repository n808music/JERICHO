import React from 'react';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import DiagnosticsPanel from '../../src/components/DiagnosticsPanel.jsx';

describe('DiagnosticsPanel trace timeline', () => {
  it('renders transition entries as a timeline and ignores non-transition diagnostics', () => {
    render(
      <DiagnosticsPanel
        drift={0}
        risks={[]}
        metrics={{ completionRate: 25, streak: 2, driftIndex: 1 }}
        traceLog={[
          { traceId: 'legacy-1', moduleName: 'generatePlan', stepName: 'complete', status: 'success' },
          {
            timestamp: '2026-03-19T12:00:00.000Z',
            transition: 'generate',
            blockId: 'p1',
            label: 'Draft episode 1 outline',
          },
          {
            timestamp: '2026-03-19T12:05:00.000Z',
            transition: 'apply',
            blockId: 'p1',
            label: 'Draft episode 1 outline',
          },
        ]}
      />
    );

    expect(screen.getByText(/Trace timeline/i)).toBeInTheDocument();
    expect(screen.getByText('Generate')).toBeInTheDocument();
    expect(screen.getByText('Apply')).toBeInTheDocument();
    expect(screen.getAllByText('Draft episode 1 outline')).toHaveLength(2);
    expect(screen.getAllByText(/Block: p1/i)).toHaveLength(2);
    expect(screen.queryByText('generatePlan')).not.toBeInTheDocument();
  });

  it('renders an explicit missed-block signal when provided', () => {
    render(
      <DiagnosticsPanel
        drift={0}
        risks={[]}
        metrics={{ completionRate: 25, streak: 2, driftIndex: 1 }}
        missedSignal={{
          level: 'active',
          headline: '2 overdue blocks require missed-work recovery',
          actionLine: 'Resolve overdue unfinished work before treating the cycle as stable.',
          details: ['2 overdue unfinished', '1 missed'],
        }}
        traceLog={[]}
      />
    );

    expect(screen.getByText(/Missed block signal/i)).toBeInTheDocument();
    expect(screen.getByText(/2 overdue blocks require missed-work recovery/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Resolve overdue unfinished work before treating the cycle as stable\./i)
    ).toBeInTheDocument();
    expect(screen.getByText(/2 overdue unfinished · 1 missed/i)).toBeInTheDocument();
  });
});
