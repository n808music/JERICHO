# Run 3 Acceptance Checklist — "Did Jericho hold the enterprise?"

**Setup:** run the goal against Jericho's intake with the external reference matrix (v1.4 sheet) open beside you. You answer the survey from the sheet. Answer key: `reference_matrix_v1_4.json`.

**Baseline to beat (failure run 2026-07-06):** 53 nodes expected → 12 persisted (7 entities, 4 systems, 1 edge). 0 initiatives, 0 projects, 0 deliverables survived. All initiative/project names lost.

---

## Gate A — Capture (during intake)
- [ ] A1. Survey presented all six sections in order (§2 entities → §3 initiatives → §4 systems → §5 projects → §6 deliverables → §7 edges).
- [ ] A2. Owner fields were single-select. It was *impossible* to enter two entities as owner.
- [ ] A3. An initiative without objective+deadline was **rejected or parked**, not accepted. (Test deliberately: try entering one blank.)
- [ ] A4. A deliverable could record a producer different from its project's owner (test with D8 N8: project owner GS Corp, produced by GS Productions).
- [ ] A5. The 30-second/parking button existed on every item and parking wrote the name verbatim.

## Gate B — Fidelity (immediately after intake)
- [ ] B1. **Counts exact:** 7 Entities, 11 Initiatives, 17 Projects, 12 Deliverables, 6 Systems = **53 nodes**.
- [ ] B2. **Names byte-identical:** all 53 names match the answer key exactly — case, punctuation, spacing. Any rewrite/normalization = FAIL. Watch: "F8 ENERGY Company" (never E8), "State of Control pt. 5 (finale)", "First Building (79th Street) — HQ + Academy".
- [ ] B3. **Classification exact:** every node in its reference class. Known traps the system must not fumble: State of Control pts. 1–5 = ONE project + FIVE deliverables (not five projects); The Imaginary CEO = Initiative (not a project); Energy Gum / Alt Smoke Pens = Projects under F8 market entry (not initiatives).
- [ ] B4. **Chains intact:** every Deliverable → real Project → real Initiative. Zero orphans (answer key has zero).
- [ ] B5. **Owners singular:** zero dual-owner values. 7 Seals owner = "Global State Corp." alone, Productions visible only via produced_by.
- [ ] B6. **Edges held:** ≥ 20/20 canonical edges present (see answer key), including the Oct 17 convergence (4 lanes, one date), the software-sales→GSS funnel edge, Max Clout→Energy Gum promo, and the patent legal cliff (provisional expires Nov 2026).
- [ ] B7. **Phases + dates:** phase values 1/2/3 match; target dates match (10/17 cluster, 8/8 HYS, 9/11 patent).

## Gate C — Persistence (the failure run's killer)
- [ ] C1. Close the session / restart the app completely.
- [ ] C2. Full readback: system recites all 53 names unprompted, grouped by class, counts displayed.
- [ ] C3. Re-run B1–B6 on the readback data. Identical results.
- [ ] C4. Spot-query by name: "What is State of Control pt. 3?" → correct class, parent, produced_by, phase. Three random spot checks minimum.
- [ ] C5. **Master Grid tab is generated and read-only** (survey §9): all 53 rows render from the store with no edit affordance; a node added via Intake appears on the grid without any manual step.
- [ ] C6. **Ready column reflects the readback** (survey §8.3): after you confirm the C2 readback, every confirmed node shows Status = CONFIRMED and Ready = YES. Before confirmation they read DRAFT / NO. (The readback confirmation is the sole producer of CONFIRMED — an operator-flagged NEEDS_REVIEW node stays NEEDS_REVIEW / NO.)

## Gate D — Schedule generation
- [ ] D1. Generated schedule references ONLY nodes that exist in the matrix (no invented names, no dropped names).
- [ ] D2. Every Phase-1 node with a target date appears on the schedule: 8/8 (HYS + email capture), 9/11 (patent), 10/17 (OFL 3 tape, 3 short films, Jericho APP — the convergence cluster).
- [ ] D3. Dependency order respected: SOC pt. 1 scheduled before/with OFL 3; patent before its Nov 2026 cliff; email capture live before/with the flywheel needing it.
- [ ] D4. Phase 2/3 items appear as later horizon, not scheduled into Phase 1.

---

## Gate D triage caution (pre-existing test rot)
Several known-broken test suites sit on the schedule-generation path: `masterPlanAtomicBlocks`, `masterPlanDepth.blockExpansion`, `masterPlanFullHorizon.coverage`, `MasterPlanTimeline.render` (part of the documented 27-failure baseline, predating the matrix work). **A red Gate D must be checked against these suites FIRST before being attributed to intake or the matrix.** A schedule defect that reproduces under the old engine is pre-existing rot, not a run-3 failure.

## Scoring
| Result | Meaning |
|--------|---------|
| **PASS** | All gates green. Jericho holds the enterprise; schedule is trustworthy. |
| **PARTIAL** | Gate A+B green, C or D fails → capture works, persistence/scheduling is the defect. Fix and re-run C/D only. |
| **FAIL** | Any lost or rewritten name at Gate B/C. This is the run-2 failure mode recurring — stop, fix persistence before anything else. |

**One number to report per run:** nodes surviving Gate C readback / 53. Run 2 scored 12/53. Run 3 target: 53/53.
