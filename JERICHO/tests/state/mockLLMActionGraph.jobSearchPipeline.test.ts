import { describe, expect, it } from 'vitest';
import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph';

describe('mockLLMActionGraph JobSearchPipeline', () => {
  it('derives job-search actions from canonical deliverables instead of the old static scaffold', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'JobSearchPipeline',
        goalText: 'Land product manager interviews with a steady job search pipeline',
        goalLabel: 'PM job search pipeline',
      },
      {
        executionType: 'JobSearchPipeline',
        goalText: 'Land product manager interviews with a steady job search pipeline',
        terminalOutcome: {
          text: 'Land product manager interviews with a steady job search pipeline',
          verificationCriteria:
            'resume ready, 20 applications submitted, weekly networking outreach, and mock interviews completed',
        },
      },
      'JobSearchPipeline',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => action.title.toLowerCase()).join(' ');
    expect(result.graph.actions.length).toBeGreaterThanOrEqual(12);
    expect(titles).toContain('pipeline');
    expect(titles).toContain('resume proof points');
    expect(titles).toContain('company targets');
    expect(titles).toContain('outreach sequence');
    expect(titles).toContain('application batch');
    expect(titles).toContain('star stories');
    expect(titles).toContain('response tracker');
    expect(result.graph.diagnostics?.notes?.[0]).toContain(
      'Mock graph for JobSearchPipeline goals derived from admitted contract deliverables.'
    );
  });
});
