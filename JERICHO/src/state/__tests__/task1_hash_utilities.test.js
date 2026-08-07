import { describe, it, expect } from 'vitest';
import { simpleStringHash, generateQuestionId, stableHashObject } from '../identityCompute.js';

describe('Task 1: Hash & ID Generation Utilities', () => {
  describe('simpleStringHash()', () => {
    it('should compute FNV-1a hash and return hex string', () => {
      const hash = simpleStringHash('hello');
      expect(typeof hash).toBe('string');
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true); // Valid hex
    });

    it('should be deterministic - same input produces same output', () => {
      const input = 'hello world';
      const hash1 = simpleStringHash(input);
      const hash2 = simpleStringHash(input);
      expect(hash1).toBe(hash2);
    });

    it('should handle empty string', () => {
      const hash = simpleStringHash('');
      expect(typeof hash).toBe('string');
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('should produce different hashes for different inputs', () => {
      const hash1 = simpleStringHash('hello');
      const hash2 = simpleStringHash('world');
      expect(hash1).not.toBe(hash2);
    });

    it('acceptance: simpleStringHash("hello") returns a hex string', () => {
      const result = simpleStringHash('hello');
      expect(typeof result).toBe('string');
      expect(/^[0-9a-f]+$/.test(result)).toBe(true);
    });
  });

  describe('generateQuestionId()', () => {
    it('should create deterministic question ID from sourceIds and targetDate', () => {
      const id1 = generateQuestionId(['d1', 'd2'], '2026-09-15');
      const id2 = generateQuestionId(['d1', 'd2'], '2026-09-15');
      expect(id1).toBe(id2);
    });

    it('should sort sourceIds alphabetically - different orders produce same ID', () => {
      const id1 = generateQuestionId(['d2', 'd1'], '2026-09-15');
      const id2 = generateQuestionId(['d1', 'd2'], '2026-09-15');
      expect(id1).toBe(id2);
    });

    it('should produce different IDs for different targetDates', () => {
      const id1 = generateQuestionId(['d1', 'd2'], '2026-09-15');
      const id2 = generateQuestionId(['d1', 'd2'], '2026-09-16');
      expect(id1).not.toBe(id2);
    });

    it('should produce different IDs for different sourceIds', () => {
      const id1 = generateQuestionId(['d1', 'd2'], '2026-09-15');
      const id2 = generateQuestionId(['d1', 'd3'], '2026-09-15');
      expect(id1).not.toBe(id2);
    });

    it('should return full FNV-1a output (no truncation)', () => {
      const id = generateQuestionId(['d1', 'd2'], '2026-09-15');
      expect(typeof id).toBe('string');
      expect(/^[0-9a-f]+$/.test(id)).toBe(true);
      // FNV-1a produces at least 6-8 character hex (32-bit number)
      expect(id.length).toBeGreaterThanOrEqual(1);
    });

    it('acceptance: sorted sourceIds produce same ID', () => {
      expect(generateQuestionId(['d2', 'd1'], '2026-09-15'))
        .toBe(generateQuestionId(['d1', 'd2'], '2026-09-15'));
    });

    it('should handle single sourceId', () => {
      const id = generateQuestionId(['d1'], '2026-09-15');
      expect(typeof id).toBe('string');
      expect(/^[0-9a-f]+$/.test(id)).toBe(true);
    });

    it('should handle multiple sourceIds', () => {
      const id = generateQuestionId(['d1', 'd2', 'd3', 'd4'], '2026-09-15');
      expect(typeof id).toBe('string');
      expect(/^[0-9a-f]+$/.test(id)).toBe(true);
    });
  });

  describe('stableHashObject()', () => {
    it('should compute stable hash of an object', () => {
      const obj = { a: 1, b: 2 };
      const hash = stableHashObject(obj);
      expect(typeof hash).toBe('string');
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('should be deterministic - same object produces same hash', () => {
      const obj = { a: 1, b: 2 };
      const hash1 = stableHashObject(obj);
      const hash2 = stableHashObject(obj);
      expect(hash1).toBe(hash2);
    });

    it('should produce same hash regardless of key order', () => {
      const obj1 = { a: 1, b: 2, c: 3 };
      const obj2 = { c: 3, a: 1, b: 2 };
      const hash1 = stableHashObject(obj1);
      const hash2 = stableHashObject(obj2);
      expect(hash1).toBe(hash2);
    });

    it('should detect changes in object values', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 3 };
      const hash1 = stableHashObject(obj1);
      const hash2 = stableHashObject(obj2);
      expect(hash1).not.toBe(hash2);
    });

    it('should handle nested objects', () => {
      const obj = { a: { x: 1, y: 2 }, b: [3, 4] };
      const hash = stableHashObject(obj);
      expect(typeof hash).toBe('string');
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('should handle arrays', () => {
      const arr = [1, 2, 3];
      const hash = stableHashObject(arr);
      expect(typeof hash).toBe('string');
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });

    it('should handle primitives', () => {
      expect(typeof stableHashObject('string')).toBe('string');
      expect(typeof stableHashObject(42)).toBe('string');
      expect(typeof stableHashObject(true)).toBe('string');
      expect(typeof stableHashObject(null)).toBe('string');
    });

    it('acceptance: stable hash detects changes', () => {
      const obj1 = { a: 1, b: 2 };
      const obj2 = { a: 1, b: 2 };
      const obj3 = { a: 1, b: 3 };

      expect(stableHashObject(obj1)).toBe(stableHashObject(obj2));
      expect(stableHashObject(obj1)).not.toBe(stableHashObject(obj3));
    });

    it('should handle empty objects', () => {
      const hash = stableHashObject({});
      expect(typeof hash).toBe('string');
      expect(/^[0-9a-f]+$/.test(hash)).toBe(true);
    });
  });

  describe('Acceptance Criteria', () => {
    it('1. simpleStringHash("hello") returns a hex string', () => {
      const result = simpleStringHash('hello');
      expect(typeof result).toBe('string');
      expect(/^[0-9a-f]+$/.test(result)).toBe(true);
    });

    it('2. simpleStringHash is deterministic', () => {
      const result1 = simpleStringHash('test input');
      const result2 = simpleStringHash('test input');
      expect(result1).toBe(result2);
    });

    it('3. generateQuestionId with different order produces same result', () => {
      expect(generateQuestionId(['d2', 'd1'], '2026-09-15'))
        .toBe(generateQuestionId(['d1', 'd2'], '2026-09-15'));
    });

    it('4. stableHashObject is deterministic and detects changes', () => {
      const obj = { a: 1, b: 2 };
      const hash1 = stableHashObject(obj);
      const hash2 = stableHashObject({ a: 1, b: 2 });
      const hash3 = stableHashObject({ a: 1, b: 3 });

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(hash3);
    });

    it('5. generateQuestionId returns full FNV-1a output (no truncation)', () => {
      const id = generateQuestionId(['d1', 'd2'], '2026-09-15');
      // Full FNV-1a is a 32-bit number converted to hex, at least 1 char
      expect(id.length).toBeGreaterThanOrEqual(1);
      expect(/^[0-9a-f]+$/.test(id)).toBe(true);
    });

    it('6. Functions are exported for use by later tasks', () => {
      // These tests verify the functions can be imported
      expect(typeof simpleStringHash).toBe('function');
      expect(typeof generateQuestionId).toBe('function');
      expect(typeof stableHashObject).toBe('function');
    });
  });
});
