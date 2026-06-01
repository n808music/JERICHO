import { describe, expect, it } from 'vitest';
import { callClaudeForActionGraph } from '../../src/state/mockLLMActionGraph.ts';

describe('mockLLMActionGraph professional qualification builder', () => {
  it('emits credential-native action titles for exam-readiness goals', async () => {
    const result = await callClaudeForActionGraph(
      {
        goalText: 'Pass the AWS Certified Cloud Practitioner exam.',
      },
      {
        executionType: 'ProfessionalQualification',
        terminalOutcome: {
          text: 'Pass the AWS Certified Cloud Practitioner exam.',
          verificationCriteria:
            'Eligibility verified, domain notes completed, timed mock exams reviewed, weak domains remediated, and exam-day checklist complete.',
        },
      },
      'ProfessionalQualification',
      'test-key'
    );

    expect(result.ok, JSON.stringify(result, null, 2)).toBe(true);
    if (!result.ok) {
      return;
    }
    const titles = result.graph.actions.map((action) => String(action.title || '').toLowerCase());

    expect(titles).toEqual(
      expect.arrayContaining([
        'capture aws certified cloud practitioner exam eligibility rules, scoring policy, and exam-day constraints',
        'verify aws certified cloud practitioner exam requirements, eligibility, and exam boundary',
        'map aws certified cloud practitioner exam core domains, weak areas, and scoring priorities',
        'build aws certified cloud practitioner exam study notes, flashcards, and review set',
        'assemble aws certified cloud practitioner exam question bank, timer rules, and error log',
        'complete aws certified cloud practitioner exam timed mock exam set and review misses',
        'identify aws certified cloud practitioner exam weak domains and remediation targets',
        'compile aws certified cloud practitioner exam weak-domain remediation log and cheat sheet',
        'prepare aws certified cloud practitioner exam readiness criteria, logistics, and final drill prompts',
        'run aws certified cloud practitioner exam readiness review and credential-day checklist',
      ])
    );
    expect(titles.join(' ')).not.toContain('study domain 1');
    expect(titles.join(' ')).not.toContain('study domain 2');
    expect(titles.join(' ')).not.toContain('complete first full-length practice exam');
  });
});
