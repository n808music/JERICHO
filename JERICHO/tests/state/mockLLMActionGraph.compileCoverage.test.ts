import { describe, expect, it } from 'vitest';
import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph';

describe('mock LLM compile coverage for remaining archetypes', () => {
  it('compiles JobSearchPipeline with concrete pipeline actions', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'JobSearchPipeline',
        goalText: 'Run a weekly job search pipeline to land interviews',
        goalLabel: 'Job search pipeline',
      },
      {
        executionType: 'JobSearchPipeline',
        terminalOutcome: { text: 'Land interviews through a steady job search pipeline' },
      },
      'JobSearchPipeline',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => action.title.toLowerCase());
    expect(result.graph.actions.length).toBeGreaterThanOrEqual(8);
    expect(titles.some((title) => title.includes('pipeline'))).toBe(true);
    expect(titles.some((title) => title.includes('application'))).toBe(true);
    expect(titles.some((title) => title.includes('interview'))).toBe(true);
  });

  it('compiles PhysicalTraining with validator-compliant action count and concrete benchmark/progression grammar', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'PhysicalTraining',
        goalText: 'Complete a 12-week physical training cycle',
        goalLabel: '12-week training cycle',
      },
      {
        executionType: 'PhysicalTraining',
        terminalOutcome: { text: 'Complete my target event with improved fitness' },
      },
      'PhysicalTraining',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const titles = result.graph.actions.map((action) => action.title.toLowerCase()).join(' ');
    expect(result.graph.actions.length).toBeGreaterThanOrEqual(8);
    expect(titles).toContain('benchmark');
    expect(titles).toContain('progression');
    expect(titles).toContain('training block');
    expect(titles).toContain('recovery');
  });
});
