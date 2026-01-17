/**
 * mechanismClassV3.test.ts
 *
 * Tests for Phase 3 PlanGenerationMechanismClass enum and validation
 * Verifies GENERIC_DETERMINISTIC is required, v1 only supports GENERIC_DETERMINISTIC
 */

import { describe, it, expect } from 'vitest';
import {
  PlanGenerationMechanismClass,
  isValidPlanGenerationMechanism,
  isPhase3SupportedMechanism,
  describePlanGenerationMechanism,
} from '../mechanismClass';

describe('PlanGenerationMechanismClass', () => {
  describe('isValidPlanGenerationMechanism', () => {
    it('accepts GENERIC_DETERMINISTIC', () => {
      expect(isValidPlanGenerationMechanism('GENERIC_DETERMINISTIC')).toBe(true);
    });

    it('accepts all defined mechanisms', () => {
      const mechanisms: PlanGenerationMechanismClass[] = [
        'GENERIC_DETERMINISTIC',
        'TEMPLATE_PIPELINE',
        'HABIT_LOOP',
        'PROJECT_MILESTONE',
        'DELIVERABLE_DRIVEN',
        'CUSTOM',
      ];
      mechanisms.forEach((m) => {
        expect(isValidPlanGenerationMechanism(m)).toBe(true);
      });
    });

    it('rejects invalid strings', () => {
      expect(isValidPlanGenerationMechanism('INVALID')).toBe(false);
      expect(isValidPlanGenerationMechanism('generic_deterministic')).toBe(false);
      expect(isValidPlanGenerationMechanism('')).toBe(false);
      expect(isValidPlanGenerationMechanism(null)).toBe(false);
      expect(isValidPlanGenerationMechanism(undefined)).toBe(false);
      expect(isValidPlanGenerationMechanism(123)).toBe(false);
    });
  });

  describe('isPhase3SupportedMechanism', () => {
    it('accepts GENERIC_DETERMINISTIC as supported', () => {
      expect(isPhase3SupportedMechanism('GENERIC_DETERMINISTIC')).toBe(true);
    });

    it('rejects all other mechanisms as unsupported in v1', () => {
      const unsupported = [
        'TEMPLATE_PIPELINE',
        'HABIT_LOOP',
        'PROJECT_MILESTONE',
        'DELIVERABLE_DRIVEN',
        'CUSTOM',
      ];
      unsupported.forEach((m) => {
        expect(isPhase3SupportedMechanism(m as PlanGenerationMechanismClass)).toBe(false);
      });
    });
  });

  describe('describePlanGenerationMechanism', () => {
    it('provides description for GENERIC_DETERMINISTIC', () => {
      expect(describePlanGenerationMechanism('GENERIC_DETERMINISTIC')).toContain('Deterministic');
      expect(describePlanGenerationMechanism('GENERIC_DETERMINISTIC')).toContain('3-tier');
    });

    it('provides descriptions for all mechanisms', () => {
      const mechanisms: PlanGenerationMechanismClass[] = [
        'GENERIC_DETERMINISTIC',
        'TEMPLATE_PIPELINE',
        'HABIT_LOOP',
        'PROJECT_MILESTONE',
        'DELIVERABLE_DRIVEN',
        'CUSTOM',
      ];
      mechanisms.forEach((m) => {
        const desc = describePlanGenerationMechanism(m);
        expect(desc.length).toBeGreaterThan(0);
      });
    });

    it('indicates future mechanisms', () => {
      const futureList = [
        'TEMPLATE_PIPELINE',
        'HABIT_LOOP',
        'PROJECT_MILESTONE',
        'DELIVERABLE_DRIVEN',
        'CUSTOM',
      ];
      futureList.forEach((m) => {
        const desc = describePlanGenerationMechanism(m as PlanGenerationMechanismClass);
        expect(desc).toContain('future');
      });
    });
  });
});
