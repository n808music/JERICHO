import { describe, expect, it } from 'vitest';
import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph.ts';

describe('mockLLMActionGraph generic skill acquisition builder', () => {
  it('emits object-bearing action titles for non-SQL skill acquisition goals', async () => {
    const result = await callClaudeForActionGraph(
      {
        goalText:
          'Learn React well enough in 45 days to build and publish two working portfolio projects with baseline recorded and proof artifact complete.',
      },
      {
        executionType: 'SkillAcquisition',
        terminalOutcome: {
          text: 'Learn React well enough in 45 days to build and publish two working portfolio projects with baseline recorded and proof artifact complete.',
          verificationCriteria: 'Baseline assessment, practice plan, proof artifact, and readiness review completed',
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
        'define success criteria for baseline in react',
        'audit baseline in react',
        'scope first react portfolio project and walkthrough',
        'complete first react portfolio project and walkthrough',
        'scope second react portfolio project with higher complexity',
        'complete second react portfolio project with higher complexity',
        'scope proof artifact showing react',
        'produce proof artifact showing react',
        'prepare final readiness review for react',
        'run final readiness review for react',
      ])
    );
    expect(titles.join(' ')).not.toContain('study core concepts and mental models');
    expect(titles.join(' ')).not.toContain('apply skill in real-world context');
    expect(titles.join(' ')).not.toContain('project 1');
    expect(titles.join(' ')).not.toContain('project 2');
  });

  it('assigns canonical preparation and execution action types where the builder path distinguishes them', async () => {
    const result = await callClaudeForActionGraph(
      {
        goalText:
          'Learn React well enough in 45 days to build and publish two working portfolio projects with baseline recorded and proof artifact complete.',
      },
      {
        executionType: 'SkillAcquisition',
        terminalOutcome: {
          text: 'Learn React well enough in 45 days to build and publish two working portfolio projects with baseline recorded and proof artifact complete.',
          verificationCriteria: 'Baseline assessment, practice plan, proof artifact, and readiness review completed',
        },
      },
      'SkillAcquisition',
      'test-key'
    );

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
    if (!result.ok) {
      return;
    }

    const actionByTitle = new Map(result.graph.actions.map((action) => [String(action.title || ''), action]));
    expect(actionByTitle.get('Define success criteria for baseline in React')?.actionType).toBe('preparation');
    expect(actionByTitle.get('Complete first React portfolio project and walkthrough')?.actionType).toBe('execution');
    expect(actionByTitle.get('Run final readiness review for React')?.actionType).toBe('preparation');
  });
});
