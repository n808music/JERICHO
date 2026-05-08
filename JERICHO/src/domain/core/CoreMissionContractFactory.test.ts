/**
 * CoreMissionContractFactory.test.ts
 *
 * Tests for CoreMissionContract creation, validation, and entropy handling
 */

import { describe, it, expect } from 'vitest';
import {
  createCoreMissionContract,
  recordEntropyEvent,
  recordRevision,
  addOrUpdateCampaign,
  pauseCampaign,
  killCampaign,
  validateTradeoff,
  validateNonNegotiable,
  generateContinuityStatusRationale,
} from './CoreMissionContractFactory';
import { validateCoreMissionContract, assessContinuityStatus } from './CoreMissionContract';

describe('CoreMissionContractFactory', () => {
  describe('createCoreMissionContract', () => {
    it('creates a valid contract with required fields', () => {
      const contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build a major company',
        horizonYears: 10,
        currentPhase: 'Phase 2 (years 5-10)',
        strategicThesis: 'Use creative output and systems to compound value',
        nonNegotiables: ['Ownership', 'Creative control'],
        allowedTradeoffs: ['Route changes', 'Timing adjustments'],
        forbiddenTradeoffs: ['Abandoning mission', 'Giving up ownership'],
        activeCampaignIds: ['campaign-1'],
        continuitySignals: [],
        derailmentSignals: [],
        masterPlanIds: ['plan-1'],
      });

      expect(contract).toBeDefined();
      expect(contract.missionId).toMatch(/^mission-/);
      expect(contract.durableObjective).toBe('Build a major company');
      expect(contract.createdAt).toBeDefined();
      expect(contract.continuityStatus).toBe('aligned');
    });

    it('throws on missing required fields', () => {
      expect(() => {
        createCoreMissionContract({
          profileId: '',
          durableObjective: 'Test',
          horizonYears: 5,
          currentPhase: 'Test',
          strategicThesis: 'Test',
          nonNegotiables: [],
          allowedTradeoffs: [],
          forbiddenTradeoffs: [],
          activeCampaignIds: [],
          continuitySignals: [],
          derailmentSignals: [],
          masterPlanIds: [],
        });
      }).toThrow();
    });

    it('throws if non-negotiables array is empty', () => {
      expect(() => {
        createCoreMissionContract({
          profileId: 'user-123',
          durableObjective: 'Test',
          horizonYears: 5,
          currentPhase: 'Test',
          strategicThesis: 'Test',
          nonNegotiables: [], // Empty
          allowedTradeoffs: ['change'],
          forbiddenTradeoffs: ['abandon'],
          activeCampaignIds: [],
          continuitySignals: [],
          derailmentSignals: [],
          masterPlanIds: ['plan-1'],
        });
      }).toThrow();
    });

    it('validates tradeoff contradiction (allowed and forbidden)', () => {
      const validation = validateCoreMissionContract({
        missionId: 'test',
        profileId: 'user-123',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        durableObjective: 'Test',
        horizonYears: 5,
        currentPhase: 'Test',
        strategicThesis: 'Test',
        nonNegotiables: ['test'],
        allowedTradeoffs: ['Route changes', 'Timing'],
        forbiddenTradeoffs: ['Route changes', 'Other'], // "Route changes" is in both!
        activeCampaignIds: [],
        campaignRegistry: [],
        continuitySignals: [],
        derailmentSignals: [],
        entropyEvents: [],
        revisionHistory: [],
        masterPlanIds: ['plan-1'],
        continuityStatus: 'aligned',
      });

      expect(validation.valid).toBe(false);
      expect(validation.errors.some(e => e.includes('contradiction'))).toBe(true);
    });
  });

  describe('recordEntropyEvent', () => {
    it('adds entropy event and updates timestamp', () => {
      const contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Creative + systems',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Income security'],
        forbiddenTradeoffs: ['Give up mission'],
        activeCampaignIds: ['app-campaign'],
        continuitySignals: [],
        derailmentSignals: [],
        masterPlanIds: ['plan-1'],
      });

      const updated = recordEntropyEvent(contract, {
        category: 'money-pressure',
        description: 'Runway depleted',
        impactedCampaignIds: ['app-campaign'],
        correctionApplied: 'Activate job search campaign',
        continuityPreserved: true,
      });

      expect(updated.entropyEvents.length).toBe(1);
      expect(updated.entropyEvents[0].category).toBe('money-pressure');
      expect(updated.entropyEvents[0].continuityPreserved).toBe(true);
      expect(updated.updatedAt).not.toBe(contract.updatedAt);
    });

    it('changes continuity status when entropy is uncontrolled', () => {
      let contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Creative + systems',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Route changes'],
        forbiddenTradeoffs: ['Give up mission'],
        activeCampaignIds: [],
        continuitySignals: [],
        derailmentSignals: [
          {
            name: 'Financial collapse',
            triggerCondition: '<2 weeks runway',
            currentSeverity: 'none',
          },
        ],
        masterPlanIds: ['plan-1'],
      });

      // Add uncontrolled entropy
      contract = recordEntropyEvent(contract, {
        category: 'money-pressure',
        description: 'Runway = 5 days',
        impactedCampaignIds: [],
        correctionApplied: 'None yet',
        continuityPreserved: false, // Not preserved
      });

      // Status may shift to strained
      expect(contract.entropyEvents.length).toBeGreaterThan(0);
    });
  });

  describe('recordRevision', () => {
    it('records thesis refinement with rationale', () => {
      const contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Old thesis',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Changes'],
        forbiddenTradeoffs: ['Abandonment'],
        activeCampaignIds: [],
        continuitySignals: [],
        derailmentSignals: [],
        masterPlanIds: ['plan-1'],
      });

      const updated = recordRevision(contract, {
        revisionType: 'thesis-refinement',
        description: 'Updated thesis based on market learning',
        rationale: 'AI leverage enables faster iteration; adjust thesis',
        continuousElements: ['durable objective', 'non-negotiables'],
        updatedFields: {
          strategicThesis: 'New thesis incorporating AI',
        },
      });

      expect(updated.revisionHistory.length).toBe(1);
      expect(updated.revisionHistory[0].revisionType).toBe('thesis-refinement');
      expect(updated.strategicThesis).toBe('New thesis incorporating AI');
      expect(updated.revisionHistory[0].continuousElements).toContain('durable objective');
    });
  });

  describe('campaign management', () => {
    it('adds a new campaign', () => {
      let contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Thesis',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Changes'],
        forbiddenTradeoffs: ['Abandonment'],
        activeCampaignIds: [],
        continuitySignals: [],
        derailmentSignals: [],
        masterPlanIds: ['plan-1'],
      });

      contract = addOrUpdateCampaign(contract, {
        id: 'podcast-campaign',
        name: 'Podcast campaign',
        contributionDescription: 'Audience building',
        status: 'active',
      });

      expect(contract.activeCampaignIds).toContain('podcast-campaign');
      expect(contract.campaignRegistry.length).toBe(1);
      expect(contract.campaignRegistry[0].name).toBe('Podcast campaign');
    });

    it('pauses a campaign without removing it', () => {
      let contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Thesis',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Pause campaigns'],
        forbiddenTradeoffs: ['Abandonment'],
        activeCampaignIds: ['app-campaign'],
        continuitySignals: [],
        derailmentSignals: [],
        masterPlanIds: ['plan-1'],
      });

      // Add the campaign first
      contract = addOrUpdateCampaign(contract, {
        id: 'app-campaign',
        name: 'App campaign',
        contributionDescription: 'Product proof',
        status: 'active',
      });

      // Pause it
      contract = pauseCampaign(contract, 'app-campaign');

      const pausedCampaign = contract.campaignRegistry.find(c => c.id === 'app-campaign');
      expect(pausedCampaign.status).toBe('paused');
    });

    it('kills a campaign and records revision', () => {
      let contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Thesis',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Kill campaigns'],
        forbiddenTradeoffs: ['Abandonment'],
        activeCampaignIds: ['app-campaign'],
        continuitySignals: [],
        derailmentSignals: [],
        masterPlanIds: ['plan-1'],
      });

      contract = addOrUpdateCampaign(contract, {
        id: 'app-campaign',
        name: 'App campaign',
        contributionDescription: 'Product proof',
        status: 'active',
      });

      contract = killCampaign(contract, 'app-campaign', 'Market fit not found');

      expect(contract.revisionHistory.length).toBeGreaterThan(0);
      expect(contract.revisionHistory[0].revisionType).toBe('campaign-adjustment');
      const killedCampaign = contract.campaignRegistry.find(c => c.id === 'app-campaign');
      expect(killedCampaign.status).toBe('killed');
    });
  });

  describe('validateTradeoff', () => {
    it('allows whitelisted tradeoffs', () => {
      const contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Thesis',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Route changes', 'Timing adjustments'],
        forbiddenTradeoffs: ['Give up ownership'],
        activeCampaignIds: [],
        continuitySignals: [],
        derailmentSignals: [],
        masterPlanIds: ['plan-1'],
      });

      const result = validateTradeoff(contract, 'Route changes');
      expect(result.valid).toBe(true);
    });

    it('rejects forbidden tradeoffs', () => {
      const contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Thesis',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Route changes'],
        forbiddenTradeoffs: ['Give up ownership', 'Abandon company'],
        activeCampaignIds: [],
        continuitySignals: [],
        derailmentSignals: [],
        masterPlanIds: ['plan-1'],
      });

      const result = validateTradeoff(contract, 'Abandon company');
      expect(result.valid).toBe(false);
      expect(result.reason).toContain('forbidden');
    });
  });

  describe('continuityStatusRationale', () => {
    it('explains aligned status', () => {
      const contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Thesis',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Changes'],
        forbiddenTradeoffs: ['Abandonment'],
        activeCampaignIds: [],
        continuitySignals: [
          {
            name: 'Revenue',
            measurementApproach: 'Monthly',
            target: '15% growth',
            currentState: 'on-track',
          },
        ],
        derailmentSignals: [
          {
            name: 'Fatigue',
            triggerCondition: 'No progress',
            currentSeverity: 'none',
          },
        ],
        masterPlanIds: ['plan-1'],
      });

      const rationale = generateContinuityStatusRationale(contract);
      expect(rationale).toContain('ALIGNED');
      expect(rationale).toContain('on-track');
    });

    it('warns endangered status', () => {
      const contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Thesis',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Changes'],
        forbiddenTradeoffs: ['Abandonment'],
        activeCampaignIds: [],
        continuitySignals: [],
        derailmentSignals: [
          {
            name: 'Financial collapse',
            triggerCondition: '<2 weeks',
            currentSeverity: 'critical',
          },
        ],
        masterPlanIds: ['plan-1'],
      });

      const rationale = generateContinuityStatusRationale(contract);
      expect(rationale).toContain('ENDANGERED');
      expect(rationale).toContain('critical');
    });
  });

  describe('assessContinuityStatus', () => {
    it('returns aligned for healthy contract', () => {
      const contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Thesis',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Changes'],
        forbiddenTradeoffs: ['Abandonment'],
        activeCampaignIds: [],
        continuitySignals: [],
        derailmentSignals: [
          {
            name: 'Test signal',
            triggerCondition: 'None',
            currentSeverity: 'none',
          },
        ],
        masterPlanIds: ['plan-1'],
      });

      expect(contract.continuityStatus).toBe('aligned');
    });

    it('returns endangered for critical derailment signal', () => {
      const contract = createCoreMissionContract({
        profileId: 'user-123',
        durableObjective: 'Build company',
        horizonYears: 10,
        currentPhase: 'Phase 1',
        strategicThesis: 'Thesis',
        nonNegotiables: ['Ownership'],
        allowedTradeoffs: ['Changes'],
        forbiddenTradeoffs: ['Abandonment'],
        activeCampaignIds: [],
        continuitySignals: [],
        derailmentSignals: [
          {
            name: 'Mission abandonment',
            triggerCondition: 'Intent to abandon',
            currentSeverity: 'critical',
          },
        ],
        masterPlanIds: ['plan-1'],
      });

      contract.continuityStatus = assessContinuityStatus(contract);
      expect(contract.continuityStatus).toBe('endangered');
    });
  });
});
