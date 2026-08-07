# Task 1: Hash & ID Generation Utilities

**Where this fits:** Task 1 of 8. Implements foundational cryptographic/deterministic utilities needed by later tasks (Task 2 detection function, Task 4 memoization guard).

**Objective:** Add three utility functions to `src/state/identityCompute.js`: `simpleStringHash()` for FNV-1a hashing, `generateQuestionId()` for deterministic question ID derivation, and `stableHashObject()` for recursive object hashing.

## File to Modify

**File:** `src/state/identityCompute.js`

**Location:** Add functions starting around line 130 (before existing export statements).

## Function Specifications

### 1. `simpleStringHash(str)`

**Purpose:** Compute FNV-1a hash of a string.

**Input:** `str` (string)

**Output:** Hex string representation of 32-bit FNV-1a hash

**Implementation:**
```javascript
function simpleStringHash(str) {
  const FNV_OFFSET_BASIS = 2166136261;
  const FNV_PRIME = 16777619;
  
  let hash = FNV_OFFSET_BASIS;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * FNV_PRIME) >>> 0; // Ensure 32-bit unsigned
  }
  return hash.toString(16);
}
```

**Why FNV-1a:** Non-cryptographic, deterministic, distributes well over small input variations (critical for question ID generation — sorted sourceIds lists must produce identical hashes).

### 2. `generateQuestionId(sourceIds, targetDate)`

**Purpose:** Create deterministic, content-derived question ID.

**Input:** 
- `sourceIds` (array of strings, e.g., `['d1', 'd2']`)
- `targetDate` (ISO date string, e.g., `'2026-09-15'`)

**Output:** Hex string (question ID)

**Logic:**
1. Sort `sourceIds` alphabetically: `[...sourceIds].sort()`
2. Concatenate: `sorted.join('||') + '||' + targetDate`
3. Hash via `simpleStringHash()`
4. Return full hex string (no truncation)

**Example:**
```javascript
generateQuestionId(['d2', 'd1'], '2026-09-15')
// → sorted: ['d1', 'd2']
// → key: 'd1||d2||2026-09-15'
// → hash: simpleStringHash(key)
// → returns: 'abc123def456...' (full FNV-1a result)
```

**Why deterministic:** Same cluster always produces same ID across independent detection runs — ensures idempotency.

**Why no truncation:** Full FNV-1a output prevents hash collisions (collision resistance).

### 3. `stableHashObject(obj)`

**Purpose:** Recursively compute stable hash of an object (for memoization guard in Task 4).

**Input:** `obj` (object, array, or primitive)

**Output:** Hex string (stable hash)

**Logic:**
1. Serialize `obj` via `JSON.stringify()` with keys sorted (use `replacer` function or `Object.keys().sort()` approach)
2. Hash the serialized string via `simpleStringHash()`
3. Return hex string

**Implementation example:**
```javascript
function stableHashObject(obj) {
  const sortedJSON = JSON.stringify(obj, Object.keys(obj || {}).sort(), 2);
  return simpleStringHash(sortedJSON);
}
```

**Why stable:** Detects any change in registry data (deliverablesById, artifactsById, dependenciesById, convergenceEdgesById); used in memoization guard (Task 4) to skip detection if hashes unchanged.

## Testing

These functions are tested indirectly via later tasks (Task 4's memoization guard, Task 8's deterministic ID test). No standalone unit tests in this task.

## Acceptance Criteria

1. ✅ `simpleStringHash('hello')` returns a hex string (FNV-1a output)
2. ✅ `simpleStringHash` is deterministic (same input → same output every time)
3. ✅ `generateQuestionId(['d2', 'd1'], '2026-09-15')` == `generateQuestionId(['d1', 'd2'], '2026-09-15')` (sorted)
4. ✅ `stableHashObject({a: 1, b: 2})` is deterministic and detects changes
5. ✅ No truncation in `generateQuestionId()` (full FNV-1a output returned)
6. ✅ Functions are exported for use by later tasks (via `_internal` object or direct export)

## Related Code

- Later tasks depend on these functions: Task 2 uses `generateQuestionId()`, Task 4 uses all three for memoization
- No modifications to existing code (these are new functions added in isolation)
