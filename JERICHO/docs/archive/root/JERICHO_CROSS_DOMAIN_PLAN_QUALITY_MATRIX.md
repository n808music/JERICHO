# JERICHO Cross-Domain Plan Quality Matrix

## Purpose

This matrix pressure-tests the plan-quality policy layer across the same five
proving domains used for intake and trust validation:

- podcast / media
- software / product build
- fitness / training
- business launch
- real estate / project

The goal is narrower than the intake matrix. This matrix asks whether an already
admissible goal still produces a high-quality plan under the same policy spine,
without reintroducing hidden assumptions, weak measurability, or scope
inflation.

## Shared Quality Pillars

Every domain is judged by the same six pillars:

1. endpoint clarity
2. starting-point honesty
3. scope discipline
4. dependency coherence
5. block measurability
6. feasibility honesty

## Policy Expectations

- `policy_clean` means all six pillars are satisfied.
- `policy_degraded` means the plan is admissible but at least one pillar is
  assumed, weak, or partially unresolved.
- `policy_blocked` means the plan cannot be trusted as a plan because the
  quality defect is material.

P.O.S. trust follows the same shape:

- `trusted` only when the plan is policy-clean and the intake contract is fully
  admitted.
- `provisional` when the plan is draftable but still assumption-marked or weakly
  evidenced.
- `withheld` when the plan is blocked or the evidence/quality is not honest
  enough to trust.

## Domain Matrix

| Domain                   | Canonical example goal                                   | Plan-quality pressure point                                  | Clean plan shape                                                                                                   | Degraded plan shape                                                                   | Blocked plan shape                                                                   | Must refuse                                                        |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------ |
| Podcast / media          | `Publish 6 episodes by deadline`                         | Publication-ready work is easy to overstate                  | Explicit boundary, explicit starting state, concrete episode artifacts, publish flow only when publish is explicit | Starting state assumed, or measurability weak because verification criteria are vague | Endpoint missing or the plan would need to invent publish scope                      | Must not silently upgrade `edited` into `published`                |
| Software / product build | `Build the product by deadline`                          | Artifact clarity and release assumptions                     | Concrete feature artifact, explicit boundary, measurable verification, conditional release scope                   | Deployment boundary assumed, or quality gates are present but still provisional       | Artifact missing, or the plan would need to invent the product                       | Must not inflate an MVP into production hardening by default       |
| Fitness / training       | `Prepare for a marathon by deadline`                     | Baseline and measurable target clarity                       | Measurable event target, explicit baseline, recovery blocks that are schedulable                                   | Recovery or baseline is assumed but written as an explicit assumption                 | No measurable target, or the plan would need to invent the finish line               | Must not pretend a vague aspiration is a trustworthy training plan |
| Business launch          | `Launch a service by deadline`                           | Offer definition and launch boundary can drift into ideation | Offer is concrete, launch boundary is explicit, support work is bounded                                            | Launch boundary is draftable but still assumption-marked                              | Offer is missing or the plan would have to invent the business type                  | Must not fall back into brainstorming a business for the user      |
| Real estate / project    | `Renovate a rental unit to inspection-ready by deadline` | External gates can be mistaken for internal schedule items   | Site state, permit state, and inspection boundary are explicit                                                     | Permit or approval state is known but still assumption-marked                         | Permit / approval / ownership state is unresolved and materially changes feasibility | Must not assume acquisition or permit state that was not confirmed |

## Acceptance Cases

The plan-quality matrix is only valid if the implementation can prove all of the
following across the five domains:

- a policy-clean admissible goal stays `policy_clean` and `trusted`
- a starting-state-assumed goal becomes `policy_degraded` and `provisional`
- a weak-measurement goal becomes `policy_degraded`
- an infeasible goal becomes `policy_blocked` and `withheld`
- recommended scope does not become required merely because it is useful
- the same quality defect produces the same quality-family outcome across
  domains

## Review Rule

If a change improves one domain by weakening these shared pillars in another,
the change fails this matrix.
