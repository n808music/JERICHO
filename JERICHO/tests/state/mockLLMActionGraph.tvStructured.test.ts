import { describe, expect, it } from 'vitest';
import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph';

describe('mock LLM GenericStructured TV compile', () => {
  it('returns TV-writing-specific ordered actions for TV goal text', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'GenericStructured',
        goalText: 'Write the first season of my TV show',
        goalLabel: 'TV season writing',
      },
      {
        executionType: 'GenericStructured',
        terminalOutcome: { text: 'Write the first season of my TV show' },
      },
      'GenericStructured',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const titles = result.graph.actions.map((action) => action.title.toLowerCase());

    expect(titles[0]).toContain('season premise');
    expect(titles.some((title) => title.includes('character'))).toBe(true);
    expect(titles.some((title) => title.includes('season arc'))).toBe(true);
    expect(titles.some((title) => title.includes('outline episode 1'))).toBe(true);
    expect(titles.some((title) => title.includes('draft episode 1'))).toBe(true);
    expect(titles.some((title) => title.includes('continuity pass'))).toBe(true);
    expect(titles.some((title) => title.includes('finalize revision package'))).toBe(true);
  });

  it('routes CreativeProduction TV goals to the same episode-specific action graph', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'CreativeProduction',
        goalText: 'Finish season 1 episode outlines and draft episode 1 and episode 2 scripts',
        goalLabel: 'TV season writing',
      },
      {
        executionType: 'CreativeProduction',
        terminalOutcome: { text: 'Finish season 1 episode outlines and draft episode 1 and episode 2 scripts' },
      },
      'CreativeProduction',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const titles = result.graph.actions.map((action) => action.title.toLowerCase());

    expect(titles.some((title) => title.includes('outline episode 1'))).toBe(true);
    expect(titles.some((title) => title.includes('draft episode 1'))).toBe(true);
    expect(titles.some((title) => title.includes('outline episode 2'))).toBe(true);
    expect(titles.some((title) => title.includes('draft episode 2'))).toBe(true);
  });

  it('routes episodic podcast CreativeProduction goals to concrete episode actions', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'CreativeProduction',
        goalText: 'Start a podcast',
        goalLabel: 'Podcast season',
      },
      {
        executionType: 'CreativeProduction',
        startDayKey: '2026-03-21',
        deadline: { dayKey: '2026-06-30' },
        terminalOutcome: {
          text: 'Start a podcast',
          verificationCriteria: '6 episodes recorded and edited for release',
        },
      },
      'CreativeProduction',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const titles = result.graph.actions.map((action) => action.title.toLowerCase());

    expect(titles).toContain('film episode 1');
    expect(titles).toContain('edit episode 1');
    expect(titles).toContain('publish episode 1');
    expect(titles).toContain('film episode 6');
    expect(titles).toContain('edit episode 6');
    expect(titles).toContain('publish episode 6');
  });

  it('routes SkillAcquisition goals to contract-derived project actions instead of the generic study template', async () => {
    const result = await callClaudeForActionGraph(
      {
        executionType: 'SkillAcquisition',
        goalText: 'Learn project management and data analysis well enough to complete three working portfolio projects',
        goalLabel: 'Project management and data analysis portfolio',
      },
      {
        executionType: 'SkillAcquisition',
        startDayKey: '2026-04-02',
        deadline: { dayKey: '2026-06-30' },
        terminalOutcome: {
          text: 'Learn project management and data analysis well enough to complete three working portfolio projects',
          verificationCriteria:
            'Projects: project management workflow dashboard; stakeholder communication plan; data analysis case study',
        },
      },
      'SkillAcquisition',
      'dev-mock-key'
    );

    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const titles = result.graph.actions.map((action) => action.title.toLowerCase());

    expect(titles).toEqual(
      expect.arrayContaining([
        expect.stringContaining('project management workflow dashboard'),
        expect.stringContaining('stakeholder communication plan'),
        expect.stringContaining('data analysis case study'),
      ])
    );
    expect(titles.some((title) => title.includes('study core concepts and mental models'))).toBe(false);
    expect(titles.some((title) => title.includes('apply skill in real-world context'))).toBe(false);
  });
});
