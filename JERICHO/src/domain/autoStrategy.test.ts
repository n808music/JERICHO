/**
 * autoStrategy.test.ts
 * Tests for auto deliverable generation
 */
import { describe, it, expect } from 'vitest';
import { buildAutoDeliverablesFromGoalContract, detectCompoundGoal } from './autoStrategy';
import type { GoalExecutionContract } from './goal/GoalExecutionContract';

describe('autoStrategy', () => {
  describe('buildAutoDeliverablesFromGoalContract', () => {
    it('returns at least 3 deliverables for a valid goal', () => {
      const contract: GoalExecutionContract = {
        goalId: 'test-goal',
        terminalOutcome: {
          text: 'Launch a new feature',
          hash: 'h1',
          verificationCriteria: 'Feature is live',
          isConcrete: true
        },
        deadline: {
          dayKey: '2026-02-12',
          isHardDeadline: true
        },
        sacrifice: {
          whatIsGivenUp: 'Leisure time',
          duration: '4 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Need focus',
          hash: 'h2'
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-12'
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning'
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false
        }
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');

      expect(result.deliverables.length).toBeGreaterThanOrEqual(3);
      expect(result.detectedType).toBe('generic');
      expect(result.deliverables.every((d) => d.requiredBlocks > 0)).toBe(true);
      expect(result.deliverables.every((d) => d.title.trim().length > 0)).toBe(true);
    });

    it('detects music release goals and generates music-specific deliverables', () => {
      const contract: GoalExecutionContract = {
        goalId: 'music-goal',
        terminalOutcome: {
          text: 'Release album on Spotify and Apple Music',
          hash: 'h1',
          verificationCriteria: 'Album is live on streaming',
          isConcrete: true
        },
        deadline: {
          dayKey: '2026-02-12',
          isHardDeadline: true
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '8 weeks',
          quantifiedImpact: '15 hours/week',
          rationale: 'Production work',
          hash: 'h2'
        },
        temporalBinding: {
          daysPerWeek: 6,
          specificDays: 'Mon-Sat',
          activationTime: '10:00',
          sessionDurationMinutes: 120,
          weeklyMinutes: 720,
          startDayKey: '2026-01-12'
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Slack notification',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Evening check-in'
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false
        }
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');

      expect(result.detectedType).toBe('music_release');
      expect(result.deliverables.length).toBeGreaterThanOrEqual(3);
      // Music templates should include music-specific language
      const deliverableTitles = result.deliverables.map((d) => d.title.toLowerCase()).join(' ');
      const hasMusic = deliverableTitles.includes('finalize') || deliverableTitles.includes('artwork') || deliverableTitles.includes('promo');
      expect(hasMusic).toBe(true);
    });

    it('scales deliverable blocks based on time remaining', () => {
      const shortDeadlineContract: GoalExecutionContract = {
        goalId: 'short-goal',
        terminalOutcome: {
          text: 'Complete the project',
          hash: 'h1',
          verificationCriteria: 'Done',
          isConcrete: true
        },
        deadline: {
          dayKey: '2026-01-15', // 3 days away
          isHardDeadline: true
        },
        sacrifice: { whatIsGivenUp: 'x', duration: 'y', quantifiedImpact: 'z', rationale: 'w', hash: 'h2' },
        temporalBinding: { daysPerWeek: 5, specificDays: '', activationTime: '09:00', sessionDurationMinutes: 60, weeklyMinutes: 300, startDayKey: '2026-01-12' },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: { dailyExposureEnabled: true, dailyMechanism: '', checkInFrequency: 'DAILY', triggerDescription: '' },
        inscription: { contractHash: 'h4', inscribedAtISO: '2026-01-12T00:00:00Z', acknowledgment: '', acknowledgmentHash: 'h5', isCompromised: false }
      };

      const longDeadlineContract: GoalExecutionContract = {
        ...shortDeadlineContract,
        deadline: {
          dayKey: '2026-03-12', // 59 days away
          isHardDeadline: true
        }
      };

      const shortResult = buildAutoDeliverablesFromGoalContract(shortDeadlineContract, '2026-01-12', 'UTC');
      const longResult = buildAutoDeliverablesFromGoalContract(longDeadlineContract, '2026-01-12', 'UTC');

      const shortTotal = shortResult.deliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);
      const longTotal = longResult.deliverables.reduce((sum, d) => sum + d.requiredBlocks, 0);

      expect(longTotal).toBeGreaterThan(shortTotal);
    });

    it('handles invalid deadline gracefully', () => {
      const contract: GoalExecutionContract = {
        goalId: 'bad-deadline-goal',
        terminalOutcome: {
          text: 'Do something',
          hash: 'h1',
          verificationCriteria: 'Done',
          isConcrete: true
        },
        deadline: {
          dayKey: 'invalid-date', // Invalid format
          isHardDeadline: true
        },
        sacrifice: { whatIsGivenUp: 'x', duration: 'y', quantifiedImpact: 'z', rationale: 'w', hash: 'h2' },
        temporalBinding: { daysPerWeek: 5, specificDays: '', activationTime: '09:00', sessionDurationMinutes: 60, weeklyMinutes: 300, startDayKey: '2026-01-12' },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: { dailyExposureEnabled: true, dailyMechanism: '', checkInFrequency: 'DAILY', triggerDescription: '' },
        inscription: { contractHash: 'h4', inscribedAtISO: '2026-01-12T00:00:00Z', acknowledgment: '', acknowledgmentHash: 'h5', isCompromised: false }
      };

      // Should not throw; instead should fallback to 3 weeks from now
      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');

      expect(result.deliverables.length).toBeGreaterThanOrEqual(3);
      expect(result.deliverables.every((d) => d.requiredBlocks > 0)).toBe(true);
    });
  });

  describe('detectCompoundGoal', () => {
    it('detects compound goals with conjunction patterns', () => {
      const compoundContract: GoalExecutionContract = {
        goalId: 'compound',
        terminalOutcome: {
          text: 'Build the app and also launch marketing campaign simultaneously',
          hash: 'h1',
          verificationCriteria: 'Both done',
          isConcrete: true
        },
        deadline: { dayKey: '2026-02-12', isHardDeadline: true },
        sacrifice: { whatIsGivenUp: 'x', duration: 'y', quantifiedImpact: 'z', rationale: 'w', hash: 'h2' },
        temporalBinding: { daysPerWeek: 5, specificDays: '', activationTime: '09:00', sessionDurationMinutes: 60, weeklyMinutes: 300, startDayKey: '2026-01-12' },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: { dailyExposureEnabled: true, dailyMechanism: '', checkInFrequency: 'DAILY', triggerDescription: '' },
        inscription: { contractHash: 'h4', inscribedAtISO: '2026-01-12T00:00:00Z', acknowledgment: '', acknowledgmentHash: 'h5', isCompromised: false }
      };

      const result = detectCompoundGoal(compoundContract);

      expect(result.isCompound).toBe(true);
      expect(result.outcomes.length).toBeGreaterThanOrEqual(1);
    });

    it('does not flag single outcome goals as compound', () => {
      const singleContract: GoalExecutionContract = {
        goalId: 'single',
        terminalOutcome: {
          text: 'Launch the website by March 1st',
          hash: 'h1',
          verificationCriteria: 'Site is live',
          isConcrete: true
        },
        deadline: { dayKey: '2026-02-12', isHardDeadline: true },
        sacrifice: { whatIsGivenUp: 'x', duration: 'y', quantifiedImpact: 'z', rationale: 'w', hash: 'h2' },
        temporalBinding: { daysPerWeek: 5, specificDays: '', activationTime: '09:00', sessionDurationMinutes: 60, weeklyMinutes: 300, startDayKey: '2026-01-12' },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: { dailyExposureEnabled: true, dailyMechanism: '', checkInFrequency: 'DAILY', triggerDescription: '' },
        inscription: { contractHash: 'h4', inscribedAtISO: '2026-01-12T00:00:00Z', acknowledgment: '', acknowledgmentHash: 'h5', isCompromised: false }
      };

      const result = detectCompoundGoal(singleContract);

      expect(result.isCompound).toBe(false);
    });
  });
});
