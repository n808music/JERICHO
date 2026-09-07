---
name: project-rtg-wave-1-trust-state
description: RTG Wave 1 Trust-State Stabilization — OE restore cluster RTG_PASSED 2026-06-11; pending follow-ups documented
metadata: 
  node_type: memory
  type: project
  originSessionId: 7abe579d-6573-44b8-901c-12e4f90b22b5
---

RTG Wave 1 Trust-State Stabilization stamped OE restore RTG_PASSED on 2026-06-11.

**Why:** The 6-failure OE restore cluster (`fullHorizonPlanQuality.state === 'trusted'` not holding) was diagnosed as **two independent layered bugs**, not a restore-path persistence issue.

**How to apply:** When OE restore tests fail with trust-state regressions, first check the `summarizeBlockDetailQuality` aggregation (it should ignore display-advisory codes) and the `ACTION_VERB_SET` coverage relative to what the schedule generator emits. Trust-state stabilization is about **what the gate measures**, not about persistence.

## Commits (rtg-wave-1-trust-state-stabilization, off main 4ef604f)

- 596cc97 — Exclude molecular advisories from full-horizon trust degradation. Filter `BLOCK_DETAIL_TOO_ABSTRACT`/`BLOCK_DETAIL_DO_THIS_EMPTY`/`BLOCK_DETAIL_DONE_WHEN_EMPTY` out of `summarizeBlockDetailQuality` counter inside `fullHorizonPlanQuality.js`. Codes remain emitted by `resolveBlockPlainLanguage` so the Block Details panel still surfaces them as a UI advisory.
- 2f70e05 — Expand canonical action verbs for OE schedule-generator drift. Added 11 verbs to `ACTION_VERB_SET` in `actionVerbs.ts`: `qualify`, `author`, `groom`, `re-clarify`, `triage`, `source`, `clarify`, `summarize`, `capture`, `enrich`, `log`.

## Root cause chain (now fixed)

90 OE blocks tripped `BLOCK_TITLE_NOT_ACTIONABLE` (missing verbs) → `fullHorizonBlockQuality.state = 'degraded'` → `buildCompensatingPhaseSubstrate` returns `compensates: false` (requires block quality 'trusted', line 485 of `fullHorizonPlanQuality.js`) → balance dimension fires 9 reason codes (milestone density/coverage/distribution thinness) → balance score drops to 22 → `fullHorizonPlanQuality.score = 81 < 88` → trust state downgrades from 'trusted' to 'provisional'.

Layered with: every OE block triggered T7's display-advisory codes via `summarizeBlockDetailQuality`'s aggregation (T7 created display codes but the gate counter treated them as substrate failures — a category error). That alone would have downgraded to 'degraded'.

Together: T7 advisories pushed trust to 'degraded'; with advisories filtered, the verb-vocabulary drift kept it at 'provisional'. Both fixes needed to restore 'trusted'.

## Verification

- 10/10 OE restore tests pass.
- 89/89 pass across Remediation #2 enterprise + panel + resolver + molecular + evaluatePlanQualityGate actionTitle tests. No regressions.

## Open follow-ups

- **`re-clarify` generator phrasing**: 9 blocks in OE use the compound verb `re-clarify`. Cleaner design would have the schedule generator emit two separate `Clarify` blocks instead of coining a compound. Track as schedule-generator clarity work, not a gate change.

## Doctrine locked in

> Trust-state stabilization is about what the gate measures, not about persistence. When OE drift surfaces, first verify the gate is measuring the right substrate, then check vocabulary drift, then check generator output. Persistence is the rarest cause.

> Action-verb vocabulary must stay aligned with what the schedule generator emits. New verbs added when the generator produces titles the actionability check rejects, only after confirming those verbs are genuinely imperative.

> Display-time advisories and substrate-level gate failures are different layers. Resolver `quality.failureCodes` may carry both, but the trust counter should only count the substrate ones.

## Inherited debt remaining

Of the 49 inherited failures from before this initiative, the 6 OE restore failures are resolved. The other 43 (across `ZionDashboard.profileHistory.test.jsx`, `autoAsanaPlan.distribution.spread.test.ts`, various `cycle.*` and `masterPlanFullHorizon.*` tests) are unrelated to trust-state stabilization. Address them as separate initiatives when each becomes load-bearing.
