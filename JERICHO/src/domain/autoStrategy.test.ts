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
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-12',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Leisure time',
          duration: '4 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Need focus',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');

      expect(result.deliverables.length).toBeGreaterThanOrEqual(3);
      expect(result.detectedType).toBe('software_build');
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
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-12',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '8 weeks',
          quantifiedImpact: '15 hours/week',
          rationale: 'Production work',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 6,
          specificDays: 'Mon-Sat',
          activationTime: '10:00',
          sessionDurationMinutes: 120,
          weeklyMinutes: 720,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Slack notification',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Evening check-in',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');

      expect(result.detectedType).toBe('music_release');
      expect(result.deliverables.length).toBeGreaterThanOrEqual(3);
      // Music templates should include music-specific language
      const deliverableTitles = result.deliverables.map((d) => d.title.toLowerCase()).join(' ');
      const hasMusic =
        deliverableTitles.includes('finalize') ||
        deliverableTitles.includes('artwork') ||
        deliverableTitles.includes('promo');
      expect(hasMusic).toBe(true);
    });

    it('uses creative-production builder deliverables for non-podcast video goals', () => {
      const contract: GoalExecutionContract = {
        goalId: 'video-goal',
        executionType: 'CreativeProduction',
        terminalOutcome: {
          text: 'Produce and release a short documentary film about neighborhood businesses',
          hash: 'h1',
          verificationCriteria:
            'Documentary film is edited, packaged, and published with a release checklist complete.',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-06-12',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '8 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Production sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-05-01',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard banner',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-05-01T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-05-01', 'UTC');
      const titles = result.deliverables.map((d) => d.title.toLowerCase());

      expect(titles).toEqual(
        expect.arrayContaining([
          'define video production concept, outline, and audience brief',
          'build video production shot plan, production checklist, and asset list',
          'produce first cut and rough edit for video production',
          'complete final edit, sound polish, and graphics for video production',
          'prepare video production release package and publication checklist',
        ])
      );
      expect(titles.join(' ')).not.toContain('creative brief and narrative intent');
      expect(titles.join(' ')).not.toContain('core artifact');
    });

    it('detects TV writing goals and generates TV-writing deliverables', () => {
      const contract: GoalExecutionContract = {
        goalId: 'tv-goal',
        terminalOutcome: {
          text: 'Write the first season of my TV show',
          hash: 'h1',
          verificationCriteria: 'Season draft package complete',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-05-12',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '8 weeks',
          quantifiedImpact: '12 hours/week',
          rationale: 'Writing sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-03-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-03-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-03-12', 'UTC');

      expect(result.detectedType).toBe('tv_writing');
      const joined = result.deliverables.map((d) => d.title.toLowerCase()).join(' | ');
      expect(joined.includes('season premise')).toBe(true);
      expect(joined.includes('character')).toBe(true);
      expect(joined.includes('episode')).toBe(true);
      expect(joined.includes('continuity')).toBe(true);
    });

    it('expands explicit episode references from verification criteria into concrete episode deliverables', () => {
      const contract: GoalExecutionContract = {
        goalId: 'tv-episodes-goal',
        terminalOutcome: {
          text: 'Complete season writing package',
          hash: 'h1',
          verificationCriteria:
            'Finish episode 1 outline, finish episode 1 script, finish episode 2 outline, finish episode 2 script',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-05-12',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '8 weeks',
          quantifiedImpact: '12 hours/week',
          rationale: 'Writing sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-03-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-03-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-03-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(titles).toContain('outline episode 1');
      expect(titles).toContain('draft episode 1 script');
      expect(titles).toContain('outline episode 2');
      expect(titles).toContain('draft episode 2 script');
    });

    it('expands podcast episode counts into explicit film/edit/publish deliverables', () => {
      const contract: GoalExecutionContract = {
        goalId: 'podcast-goal',
        terminalOutcome: {
          text: 'Start a podcast',
          hash: 'h1',
          verificationCriteria: '6 episodes recorded and edited for release',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-06-30',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '12 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Production sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-03-21',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-03-21T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-03-21', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('episodic_production');
      expect(titles).toContain('film episode 1');
      expect(titles).toContain('edit episode 1');
      expect(titles).toContain('publish episode 1');
      expect(titles).toContain('film episode 6');
      expect(titles).toContain('edit episode 6');
      expect(titles).toContain('publish episode 6');
    });

    it('preserves the podcast object in fallback episodic-production deliverables', () => {
      const contract: GoalExecutionContract = {
        goalId: 'podcast-fallback-goal',
        terminalOutcome: {
          text: 'Start a podcast by deadline from scratch',
          hash: 'h1',
          verificationCriteria: 'Launch a polished podcast feed with released episodes',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-06-30',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '12 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Production sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-03-21',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-03-21T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-03-21', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('episodic_production');
      expect(titles).toContain('finalize podcast show format and theme');
      expect(titles).toContain('prepare podcast recording workflow and equipment');
      expect(titles).toContain('record and edit podcast episode batch');
      expect(titles).toContain('finalize podcast release package and publishing plan');
    });

    it('generates object-bearing skill acquisition deliverables instead of generic practice grammar', () => {
      const contract: GoalExecutionContract = {
        goalId: 'skill-goal',
        executionType: 'SkillAcquisition',
        terminalOutcome: {
          text: 'Learn React well enough in 45 days to build and publish two working portfolio projects',
          hash: 'h1',
          verificationCriteria: 'Baseline assessment, practice plan, proof artifact, and readiness review completed',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-12',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Leisure time',
          duration: '6 weeks',
          quantifiedImpact: '8 hours/week',
          rationale: 'Skill sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('skill_acquisition');
      expect(titles).toEqual(
        expect.arrayContaining([
          'establish baseline in react',
          'complete first react portfolio project and walkthrough',
          'complete second react portfolio project with higher complexity',
          'produce proof artifact showing react',
          'run final readiness review for react',
        ])
      );
      expect(titles.join(' | ')).not.toContain('project 1');
      expect(titles.join(' | ')).not.toContain('project 2');
      expect(titles.join(' | ')).not.toContain('practice plan and drill set');
    });

    it('generates physical progression deliverables with baseline, progression, recovery, and benchmark grammar', () => {
      const contract: GoalExecutionContract = {
        goalId: 'physical-goal',
        executionType: 'PhysicalTraining',
        terminalOutcome: {
          text: 'Complete a 12-week physical training cycle with baseline recorded and recovery stable',
          hash: 'h1',
          verificationCriteria:
            'Baseline benchmark, training progression, recovery checkpoints, and benchmark re-test completed',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-12',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Leisure time',
          duration: '12 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Training cycle',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase()).join(' | ');

      expect(result.detectedType).toBe('physical_training');
      expect(titles).toContain('baseline');
      expect(titles).toContain('progression');
      expect(titles).toContain('recovery');
      expect(titles).toContain('benchmark');
      expect(titles).not.toContain('improve fitness');
      expect(titles).not.toContain('training tasks');
    });

    it('generates body-composition deliverables with explicit exercise and adherence grammar', () => {
      const contract: GoalExecutionContract = {
        goalId: 'physical-bodycomp-goal',
        executionType: 'PhysicalTraining',
        terminalOutcome: {
          text: 'Lose 10 pounds and improve conditioning in 10 weeks',
          hash: 'h1',
          verificationCriteria:
            '10 pounds lost with conditioning sessions complete, weigh-in trend recorded, and final adjustment review complete',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-12',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Late-night snacking',
          duration: '10 weeks',
          quantifiedImpact: 'Meal prep and training time',
          rationale: 'Body composition goal',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase()).join(' | ');

      expect(result.detectedType).toBe('physical_training');
      expect(titles).toContain('calorie/protein targets');
      expect(titles).toContain('weekly conditioning and strength sessions');
      expect(titles).toContain('nutrition adherence and weigh-in tracking block');
      expect(titles).toContain('review body composition trend and adjust training plan');
      expect(titles).not.toContain('nutrition cadence');
    });

    it('generates professional qualification deliverables with requirements, assessment, proof, and credential grammar', () => {
      const contract: GoalExecutionContract = {
        goalId: 'qualification-goal',
        executionType: 'ProfessionalQualification',
        terminalOutcome: {
          text: 'Pass the AWS Certified Cloud Practitioner exam by May 15',
          hash: 'h1',
          verificationCriteria: 'Requirements review, practice exams, proof packet, and credential step completed',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-05-15',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Leisure time',
          duration: '8 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Credential sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-03-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-03-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-03-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('professional_qualification');
      expect(titles).toEqual(
        expect.arrayContaining([
          'verify aws certified cloud practitioner exam requirements, eligibility, and exam boundary',
          'build aws certified cloud practitioner exam domain coverage map and study note set',
          'complete aws certified cloud practitioner exam question bank and timed mock exam set',
          'compile aws certified cloud practitioner exam weak-domain remediation log and cheat sheet',
          'run aws certified cloud practitioner exam readiness review and credential-day checklist',
        ])
      );
    });

    it('generates VentureLaunch service deliverables with offer, pricing, process, outreach, and close grammar', () => {
      const contract: GoalExecutionContract = {
        goalId: 'venture-launch-goal',
        executionType: 'VentureLaunch',
        terminalOutcome: {
          text: 'Launch a project management consulting service in 30 days with offer, pricing, onboarding materials, and first 15 prospect outreaches completed.',
          hash: 'h1',
          verificationCriteria: 'Offer defined and first clients acquired',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-20',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '6 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Launch sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('venture_launch');
      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('project management consulting service offer'),
          expect.stringContaining('pricing tiers'),
          expect.stringContaining('onboarding workflow'),
          expect.stringContaining('outreach scripts'),
          expect.stringContaining('discovery calls'),
        ])
      );
      expect(titles.some((title) => title.includes('launch outreach'))).toBe(false);
    });

    it('generates VentureLaunch product deliverables with landing page, customer validation, and traction grammar', () => {
      const contract: GoalExecutionContract = {
        goalId: 'venture-product-goal',
        executionType: 'VentureLaunch',
        terminalOutcome: {
          text: 'Launch a habit tracking app in 45 days with landing page, waitlist, first 25 user interviews, and traction review completed.',
          hash: 'h1',
          verificationCriteria: 'Landing page live, first users interviewed, and traction review documented',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-20',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '6 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Launch sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('venture_launch');
      expect(titles).toEqual(
        expect.arrayContaining([
          'define habit tracking app value proposition and target customer',
          'build habit tracking app landing page, waitlist flow, and first-user funnel',
          'prepare habit tracking app customer outreach list and interview script',
          'run habit tracking app first-user validation and feedback loop',
          'compile habit tracking app traction evidence and launch next-step review',
        ])
      );
    });

    it('generates BrandLaunch deliverables with positioning, messaging, and identity grammar', () => {
      const contract: GoalExecutionContract = {
        goalId: 'brand-launch-goal',
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: 'Launch a consulting business brand in 45 days with strategy, messaging, visual identity, website basics, and launch collateral completed.',
          hash: 'h1',
          verificationCriteria: 'Identity is defined and first rollout is complete',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-20',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '6 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Brand sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('brand_launch');
      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('positioning'),
          expect.stringContaining('messaging'),
          expect.stringContaining('identity'),
          expect.stringContaining('brand kit'),
          expect.stringContaining('brand launch announcement'),
        ])
      );
      expect(titles.some((title) => title.includes('launch-week content batch'))).toBe(false);
      expect(titles.some((title) => title.includes('engagement and response follow-up'))).toBe(false);
    });

    it('generates commercial product launch deliverables for gum first-sales goals instead of brand-only work', () => {
      const contract: GoalExecutionContract = {
        goalId: 'gum-product-launch-goal',
        executionType: 'BrandLaunch',
        terminalOutcome: {
          text: 'Launch a caffeinated gum brand in 75 days with concept validation, branding, packaging, sourcing, launch setup, and first real sales completed.',
          hash: 'h1',
          verificationCriteria:
            'Caffeinated gum product sample approved, packaging ready, product page live, purchase path active, and first sales evidence reviewed.',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-03-28',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '11 weeks',
          quantifiedImpact: '8 hours/week',
          rationale: 'Product launch sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('brand_launch');
      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('formula, sample approval, packaging, sourcing'),
          expect.stringContaining('offer, pricing, product page, checkout, ordering, and fulfillment path'),
          expect.stringContaining('first-sales outreach to initial buyers'),
          expect.stringContaining('first-sales evidence, conversion results, and next-step decision'),
        ])
      );
      expect(titles).not.toEqual(
        expect.arrayContaining([
          'define brand positioning and audience promise',
          'build messaging architecture for priority channels',
          'publish brand launch announcement and audience cta',
        ])
      );
    });

    it('uses raw goal text when terminal outcome wording is too brand-generic', () => {
      const contract = {
        goalId: 'gum-raw-goal',
        cycleId: 'cycle-gum-raw',
        executionType: 'BrandLaunch',
        goalText: 'Build a caffeinated gum brand and take it to first real sales',
        terminalOutcome: {
          text: 'Launch the brand with concept validation and launch setup completed.',
          hash: 'h1',
          verificationCriteria: 'The brand has launch setup complete.',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-12-31',
          isHardDeadline: true,
        },
        temporalBinding: {
          startDayKey: '2026-01-01',
        },
      } as GoalExecutionContract;

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-01', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());
      const requiredBlocks = result.deliverables.reduce((sum, deliverable) => sum + deliverable.requiredBlocks, 0);

      expect(result.detectedType).toBe('brand_launch');
      expect(titles).toEqual(
        expect.arrayContaining([
          expect.stringContaining('formula, sample approval, packaging, sourcing'),
          expect.stringContaining('checkout, ordering, and fulfillment path'),
          expect.stringContaining('first-sales outreach to initial buyers'),
          expect.stringContaining('first-sales evidence'),
        ])
      );
      expect(requiredBlocks).toBeGreaterThan(40);
    });

    it('sizes long-horizon commercial product launch strategy above sparse weekly cadence', () => {
      const contract = {
        goalId: 'gum-raw-goal',
        cycleId: 'cycle-gum-raw',
        executionType: 'BrandLaunch',
        goalText: 'Build a caffeinated gum brand and take it to first real sales',
        terminalOutcome: {
          text: 'Launch the brand with concept validation and launch setup completed.',
          hash: 'h1',
          verificationCriteria: 'The brand has launch setup complete.',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-12-31',
          isHardDeadline: true,
        },
        temporalBinding: {
          startDayKey: '2026-01-01',
        },
      } as GoalExecutionContract;

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-01', 'UTC');
      const requiredBlocks = result.deliverables.reduce((sum, deliverable) => sum + deliverable.requiredBlocks, 0);
      const requiredBlocksByFamily = result.deliverables.map((deliverable) => deliverable.requiredBlocks);

      expect(result.detectedType).toBe('brand_launch');
      expect(requiredBlocks).toBeGreaterThanOrEqual(104);
      expect(requiredBlocksByFamily).toEqual([24, 29, 20, 40, 25]);
      expect(requiredBlocksByFamily).not.toEqual([18, 18, 15, 18, 12]);
      expect(requiredBlocks).toBeGreaterThan(18 + 18 + 15 + 18 + 12);
      expect(result.deliverables.map((deliverable) => deliverable.id)).toEqual([
        'auto-deliv-product-readiness',
        'auto-deliv-product-commerce',
        'auto-deliv-product-launch-communications',
        'auto-deliv-product-first-sales',
        'auto-deliv-product-sales-review',
      ]);
    });

    it('generates SalesPipeline deliverables with pipeline-stage grammar', () => {
      const contract: GoalExecutionContract = {
        goalId: 'sales-pipeline-goal',
        executionType: 'SalesPipeline',
        terminalOutcome: {
          text: 'Build a sales pipeline for a consulting service with offer, ICP, outreach, CRM, discovery calls, proposals, negotiation, and onboarding handoff completed.',
          hash: 'h1',
          verificationCriteria: 'Qualified pipeline moves through proposal to close',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-20',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '6 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Pipeline sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('sales_pipeline');
      expect(titles).toContain('clarify offer, pricing tiers, and qualification criteria');
      expect(titles).toContain('define icp and build first target account list');
      expect(titles).toContain('create outreach scripts and objection-handling library');
      expect(titles).toContain('configure crm stages and pipeline tracking dashboard');
      expect(titles).toContain('run discovery calls and qualify active opportunities');
    });

    it('generates Fundraising deliverables with investor-stage grammar', () => {
      const contract: GoalExecutionContract = {
        goalId: 'fundraising-goal',
        executionType: 'Fundraising',
        terminalOutcome: {
          text: 'Run a seed fundraising round with thesis, deck, target investors, outreach, meetings, diligence, terms, and close completed.',
          hash: 'h1',
          verificationCriteria: 'Investor conversations move through diligence to commitment',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-20',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '6 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Raise sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('fundraising');
      expect(titles).toContain('define raise objective, use-of-funds, and investor thesis');
      expect(titles).toContain('build fundraising narrative and deck storyline');
      expect(titles).toContain('create diligence checklist and data room structure');
      expect(titles).toContain('build target investor list and fit scoring model');
      expect(titles).toContain('prepare outreach sequences and intro request scripts');
    });

    it('keeps package-preparation fundraising goals in investor-ready scope', () => {
      const contract: GoalExecutionContract = {
        goalId: 'fundraising-package-goal',
        executionType: 'Fundraising',
        terminalOutcome: {
          text: 'Prepare a friends-and-family fundraising package for Jericho in 21 days so I have a clear pitch, financial ask, use-of-funds story, and investor-ready materials.',
          hash: 'pkg-1',
          verificationCriteria: 'Investor-ready package, scripts, and materials are complete and ready to send',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-02',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Evenings',
          duration: '3 weeks',
          quantifiedImpact: '8 hours/week',
          rationale: 'Package sprint',
          hash: 'pkg-2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'pkg-3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'pkg-4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'pkg-5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('fundraising');
      expect(titles).toContain('build fundraising narrative, pitch deck, and financial ask storyline');
      expect(titles).toContain('create diligence checklist, financial package, and data room structure');
      expect(titles).toContain('prepare outreach sequences, intro request scripts, and send package checklist');
      expect(titles).toContain(
        'run fundraising readiness review, objection handling, and investor-ready materials check'
      );
      expect(titles.join(' ')).not.toMatch(
        /\bmeetings?\b|\bdiligence requests\b|\bcommitment\b|\bsignature workflow\b|\blegal close\b/
      );
    });

    it('generates JobSearchPipeline deliverables with application and interview grammar', () => {
      const contract: GoalExecutionContract = {
        goalId: 'job-search-goal',
        executionType: 'JobSearchPipeline',
        terminalOutcome: {
          text: 'Run a weekly job search pipeline for a corporate role with target roles, resume, outreach, applications, interviews, and follow-up completed.',
          hash: 'h1',
          verificationCriteria: 'Applications submitted, interviews scheduled, and follow-up logged',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-02-20',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Free time',
          duration: '6 weeks',
          quantifiedImpact: '10 hours/week',
          rationale: 'Search sprint',
          hash: 'h2',
        },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: 'Mon-Fri',
          activationTime: '09:00',
          sessionDurationMinutes: 90,
          weeklyMinutes: 450,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: 'Dashboard',
          checkInFrequency: 'DAILY',
          triggerDescription: 'Morning',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: 'I commit',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((deliverable) => deliverable.title.toLowerCase());

      expect(result.detectedType).toBe('job_search_pipeline');
      expect(titles).toContain('audit target role family, submitted applications, and response gaps');
      expect(titles).toContain('tailor resume and portfolio for target roles');
      expect(titles).toContain('build target company list and prioritization model');
      expect(titles).toContain('create application pipeline tracking and outreach workflow');
      expect(titles).toContain('prepare interview story bank and answer framework');
      expect(titles).toContain('log responses and manage active interview stages');
    });

    it('scales deliverable blocks based on time remaining', () => {
      const shortDeadlineContract: GoalExecutionContract = {
        goalId: 'short-goal',
        terminalOutcome: {
          text: 'Complete the project',
          hash: 'h1',
          verificationCriteria: 'Done',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-01-15', // 3 days away
          isHardDeadline: true,
        },
        sacrifice: { whatIsGivenUp: 'x', duration: 'y', quantifiedImpact: 'z', rationale: 'w', hash: 'h2' },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: '',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: '',
          checkInFrequency: 'DAILY',
          triggerDescription: '',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: '',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const longDeadlineContract: GoalExecutionContract = {
        ...shortDeadlineContract,
        deadline: {
          dayKey: '2026-03-12', // 59 days away
          isHardDeadline: true,
        },
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
          isConcrete: true,
        },
        deadline: {
          dayKey: 'invalid-date', // Invalid format
          isHardDeadline: true,
        },
        sacrifice: { whatIsGivenUp: 'x', duration: 'y', quantifiedImpact: 'z', rationale: 'w', hash: 'h2' },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: '',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: '',
          checkInFrequency: 'DAILY',
          triggerDescription: '',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: '',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      // Should not throw; instead should fallback to 3 weeks from now
      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');

      expect(result.deliverables.length).toBeGreaterThanOrEqual(3);
      expect(result.deliverables.every((d) => d.requiredBlocks > 0)).toBe(true);
    });

    it('generic fallback: deliverable titles carry the goal object, not hollow phase labels', () => {
      const contract: GoalExecutionContract = {
        goalId: 'generic-goal',
        terminalOutcome: {
          text: 'Launch a consulting practice with paying clients',
          hash: 'h1',
          verificationCriteria: 'Three clients onboarded',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-05-01',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Weekends',
          duration: '8 weeks',
          quantifiedImpact: '10h/week',
          rationale: '',
          hash: 'h2',
        },
        scope: { timezone: 'UTC', hash: 'h3' },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-01T00:00:00Z',
          acknowledgment: '',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      const titles = result.deliverables.map((d) => d.title.toLowerCase());

      // Should be generic fallback
      expect(result.detectedType).toBe('generic');

      // Each title should contain the goal object word(s), not hollow phase labels
      const hollowPatterns = [
        /^planning\s*&\s*setup$/,
        /^core production$/,
        /^verification\s*&\s*finalization$/,
        /^build\s*&\s*refinement$/,
        /^execution\s*&\s*iteration$/,
        /^main development$/,
        /^final review$/,
        /^launch\s*&\s*rollout$/,
      ];
      titles.forEach((title) => {
        const isHollow = hollowPatterns.some((p) => p.test(title));
        expect(isHollow).toBe(false);
      });

      // At least one title contains a goal object word
      const hasObject = titles.some((t) => t.includes('consulting') || t.includes('practice') || t.includes('client'));
      expect(hasObject).toBe(true);
    });

    it('minimum-deliverable padding: padded titles carry the goal object, not generic phase labels', () => {
      // Use a goal that produces fewer than 3 deliverables from its archetype builder
      // Physical training with very short deadline and no episode numbers tends to pad
      const contract: GoalExecutionContract = {
        goalId: 'short-goal',
        terminalOutcome: {
          text: 'Complete ceramic sculpture series for gallery submission',
          hash: 'h1',
          verificationCriteria: 'Five pieces submitted',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-01-20',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Evenings',
          duration: '1 week',
          quantifiedImpact: '2h/day',
          rationale: '',
          hash: 'h2',
        },
        scope: { timezone: 'UTC', hash: 'h3' },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-01T00:00:00Z',
          acknowledgment: '',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');

      expect(result.deliverables.length).toBeGreaterThanOrEqual(3);

      const titles = result.deliverables.map((d) => d.title.toLowerCase());
      const hollowPatterns = [
        /^planning\s*&\s*setup$/,
        /^core production$/,
        /^verification\s*&\s*finalization$/,
        /^final review$/,
        /^launch\s*&\s*rollout$/,
      ];
      titles.forEach((title) => {
        const isHollow = hollowPatterns.some((p) => p.test(title));
        expect(isHollow).toBe(false);
      });
    });

    it('episodic fallback non-count path: no longer produces DELIVERABLE_OBJECT_MISSING title', () => {
      const contract: GoalExecutionContract = {
        goalId: 'podcast-goal',
        terminalOutcome: {
          text: 'Record and release a podcast show',
          hash: 'h1',
          // No episode count in verification — triggers the fallback non-count path
          verificationCriteria: 'Podcast episodes recorded and published on major platforms',
          isConcrete: true,
        },
        deadline: {
          dayKey: '2026-04-30',
          isHardDeadline: true,
        },
        sacrifice: {
          whatIsGivenUp: 'Evenings',
          duration: '12 weeks',
          quantifiedImpact: '5h/week',
          rationale: '',
          hash: 'h2',
        },
        scope: { timezone: 'UTC', hash: 'h3' },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-01T00:00:00Z',
          acknowledgment: '',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = buildAutoDeliverablesFromGoalContract(contract, '2026-01-12', 'UTC');
      expect(result.detectedType).toBe('episodic_production');

      const titles = result.deliverables.map((d) => d.title.toLowerCase());
      // The old pattern that directly matched DELIVERABLE_OBJECT_MISSING_PATTERNS
      expect(titles).not.toContain('record and edit episode set');
      expect(titles).not.toContain('record and edit podcast episode set');
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
          isConcrete: true,
        },
        deadline: { dayKey: '2026-02-12', isHardDeadline: true },
        sacrifice: { whatIsGivenUp: 'x', duration: 'y', quantifiedImpact: 'z', rationale: 'w', hash: 'h2' },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: '',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: '',
          checkInFrequency: 'DAILY',
          triggerDescription: '',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: '',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
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
          isConcrete: true,
        },
        deadline: { dayKey: '2026-02-12', isHardDeadline: true },
        sacrifice: { whatIsGivenUp: 'x', duration: 'y', quantifiedImpact: 'z', rationale: 'w', hash: 'h2' },
        temporalBinding: {
          daysPerWeek: 5,
          specificDays: '',
          activationTime: '09:00',
          sessionDurationMinutes: 60,
          weeklyMinutes: 300,
          startDayKey: '2026-01-12',
        },
        causalChain: { steps: [], hash: 'h3' },
        reinforcement: {
          dailyExposureEnabled: true,
          dailyMechanism: '',
          checkInFrequency: 'DAILY',
          triggerDescription: '',
        },
        inscription: {
          contractHash: 'h4',
          inscribedAtISO: '2026-01-12T00:00:00Z',
          acknowledgment: '',
          acknowledgmentHash: 'h5',
          isCompromised: false,
        },
      };

      const result = detectCompoundGoal(singleContract);

      expect(result.isCompound).toBe(false);
    });
  });
});
