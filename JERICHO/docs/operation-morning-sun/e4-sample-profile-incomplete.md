---
name: e4-sample-profile-incomplete
description: 4 incomplete tests added during fixture refactoring — using new sample profile fixture that has different baseline than full-horizon multi-lane fixture
metadata: 
  node_type: memory
  type: project
  originSessionId: 2e9164c9-8e35-4fed-8b30-edc06d0ef61d
  modified: 2026-08-19T06:57:11.529Z
---

# E4: Sample Profile Fixture — 4 Incomplete Tests

## Status
**Out of scope for Phase 1** — E3 is closed. These are part of ongoing fixture refactoring work, not regressions.

## Tests Affected (in masterPlanFullHorizon.quality.test.js)
1. Line 475: `flags active-lane milestone coverage gaps when only a minority of active P2 lanes have named milestones`
2. Line 628: `passes the distributed baseline as an official trusted or provisional MVP plan`
3. Line 633: `keeps the Operation Endgame fixture inspectable under the official MVP standard`
4. Additional milestone test

## Root Cause
These tests were written for `buildSampleProfileFixtureState` (60-month sample profile) but the test file was switched to `buildFullHorizonMultiLaneFixtureState` (72-month full-horizon) as part of E3 closure. The tests now fail because they expect sample profile data.

## Resolution Path
These tests either need:
- To be rewritten for the full-horizon fixture, OR
- To be extracted to a separate sample-profile test file that uses the correct fixture

## Note
Not Phase 1 scope — this is new work on the fixture migration branch. Logged here to prevent silent disappearance from the ledger (same risk that surfaced with Operation Endgame references earlier in this session).
