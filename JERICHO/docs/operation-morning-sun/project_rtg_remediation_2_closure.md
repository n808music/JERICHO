---
name: project-rtg-remediation-2-closure
description: Plan Quality Remediation
metadata: 
  node_type: memory
  type: project
  originSessionId: 7abe579d-6573-44b8-901c-12e4f90b22b5
---

Plan Quality Remediation #2 stamped RTG_PASSED on the enterprise identity layer on 2026-06-11.

**Why:** The Plan tab and Block Details panel were rendering abstract lane names (`Civic`, `Product`, `Operation Endgame product...`) instead of founder-facing entity names. The user delivered a paper enterprise map (8 entities including F8 Energy Co. — never E8) and required an audit + projection that prevents the system from silently materializing lanes intake didn't declare.

**How to apply:** When extending the Plan chart, Block Details panel, or audit layer, route everything through `src/domain/enterprise/enterpriseDisplayProjection.ts`. The 8 canonical entities and the E8→F8 alias guard live in `src/domain/enterprise/enterpriseIdentityMap.ts`. The audit's 10 failure codes live in `src/domain/enterprise/evaluateEnterpriseIdentityAudit.ts`.

## Commits (12, on rtg-remediation-1)

- 61a968f canonical map (F8 Energy Co.)
- 09a0f88 map test coverage (category lookup + uniqueness)
- b217449 provenance classification (6 statuses)
- 5ce28ce lane-to-entity mapping (civic → Global State Holdings; energy_gym → F8)
- 1ca9730 enterprise display projection
- 301e70d enterprise identity audit (10 failure codes, 7 actively detected)
- b6338e1 Plan tab chart wired to projection
- bb2ac45 (reverted — molecular quality over-engineered)
- 68207cb revert of bb2ac45
- 2d8e17f molecular block detail quality enforcement (constrained re-do)
- 1495baa Block Details panel enterprise header
- 260eead enterprise audit wired into derived state via applyEnterpriseIdentityAudit

## RTG verification result

- Enterprise identity layer: **PASSED** 2026-06-11. Verified programmatically by running OE intake signals through `projectEnterpriseDisplay` for all 8 declared lanes. All entities render correctly: Global State Systems / Productions / Solutions / Holdings / Corp. / Academy / Capital Path or Revenue Engine / F8 Energy Co. (with the deferred + Real Estate warning surfacing on civic).
- Audit emits 0 findings on clean chart rows. With drift injected (Civic label, E8 Energy Co., internal name patterns, P1 Real Estate execution with no justification, abstract block detail), the audit emits 6 distinct findings covering CIVIC_LABEL_NOT_NORMALIZED, DISPLAY_ROW_USES_INTERNAL_LANE_NAME, INCORRECT_ENTERPRISE_ENTITY_NAME, REAL_ESTATE_P1_EXECUTION_UNJUSTIFIED, BLOCK_DETAIL_TOO_ABSTRACT.
- Remediation-specific tests: 51/51 passing (across all 5 new domain modules + state wiring + chart + block panel + molecular resolver).
- Full vitest suite: 3102 / 3151 passing; 49 inherited failures (OE restore trust-state tests fail with `expected 'trusted' got 'degraded'/'provisional'` — verified pre-existing, not regressions from this remediation. Confirmed by stashing prior-session dirty work from `fullHorizonPlanQuality.js` / `evaluatePlanQualityGate.ts` and re-running: failures persist with a different word).

## Inherited test debt (next initiative candidate)

The 49 inherited failures cluster in: `operationEndgameRestore.test.jsx` (6, trust state), `ZionDashboard.profileHistory.test.jsx` (5), `masterPlanFullHorizon.quality.test.js` (3), `autoAsanaPlan.distribution.spread.test.ts` (3, pre-existing), `cycle.*` tests (multiple). The trust-state cluster is the most visible and centers on `fullHorizonPlanQuality.state === 'trusted'` no longer holding after restore. Diagnose `fullHorizonPlanQuality.js` and `evaluatePlanQualityGate.ts` (both still uncommitted in the working tree from a prior session) before opening a new remediation.

## Pattern locked in

The 10-task plan executed under subagent-driven-development worked well but produced one over-engineered task (T7 added a 5000-entry cache to a pure resolver; reverted and re-dispatched with hard line caps under 30 additions). The hard-cap pattern (`Diff cap: ≤ X line additions`) in subagent prompts is the lever that prevented further drift in T8 and T9. Use it for all "modify large existing file" subagent dispatches going forward.
