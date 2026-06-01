import { describe, expect, it } from 'vitest';
import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph.ts';

describe('mockLLMActionGraph SQL skill builder', () => {
  it('emits SQL-native action titles for interview-ready portfolio goals', async () => {
    const result = await callClaudeForActionGraph(
      {
        goalText:
          'Build job-ready SQL and dashboard analysis skills in 30 days so I can complete three portfolio-quality data projects and speak confidently about them in interviews.',
      },
      {
        executionType: 'SkillAcquisition',
        terminalOutcome: {
          text: 'Build job-ready SQL and dashboard analysis skills in 30 days so I can complete three portfolio-quality data projects and speak confidently about them in interviews.',
          verificationCriteria:
            'Complete three SQL portfolio projects, publish GitHub-ready work, and explain SQL decisions in interviews.',
        },
      },
      'SkillAcquisition',
      'test-key'
    );

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
    if (!result.ok) {
      return;
    }
    const titles = result.graph.actions.map((action) => String(action.title || '').toLowerCase());

    expect(titles).toEqual(
      expect.arrayContaining([
        'set up sql practice database and baseline query checklist',
        'write select, where, order by, and aggregate practice queries',
        'define schema, tables, and import checks for relational dataset project',
        'answer business questions with join and group by sql case study',
        'build advanced sql reporting project with ctes and window functions',
        'run sql interview drills and explain project decisions aloud',
      ])
    );
    expect(titles.join(' ')).not.toContain('study core concepts and mental models');
    expect(titles.join(' ')).not.toContain('apply skill in real-world context');
  });
});
