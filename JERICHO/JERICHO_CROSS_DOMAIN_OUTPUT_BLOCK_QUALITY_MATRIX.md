# JERICHO Cross-Domain Output / Block Quality Matrix

## Purpose

This matrix pressure-tests the actual generated outputs and scheduled blocks
across the same five proving domains used for intake, policy, and plan-quality
validation:

- podcast / media
- software / product build
- fitness / training
- business launch
- real estate / project

The goal is not to prove that Jericho can merely admit a goal. The goal is to
prove that once a goal is admitted, the generated deliverables, task labels, and
calendar blocks are materially good enough to trust inside the already-validated
policy frame.

## Shared Output Dimensions

Every domain is judged by the same output-quality questions:

1. output correctness
2. endpoint fidelity
3. required vs recommended separation
4. task specificity
5. dependency realism
6. measurable block quality
7. starting-state sensitivity
8. non-genericity

## Quality Expectations

- `output_clean` means the generated deliverables and blocks are concrete,
  domain-shaped, and faithful to the declared endpoint.
- `output_degraded` means the plan is still policy-admissible, but the output is
  generic, partially assumed, or weakly differentiated from recommended work.
- `output_blocked` means the system cannot generate honest outputs without
  inventing the destination, the required work, or the execution shape.

P.O.S. trust follows the same shape:

- `trusted` only when the output is policy-clean and the plan is otherwise
  policy-clean.
- `provisional` when the output is admissible but still generic, partially
  assumed, or under-specified.
- `withheld` when the output is blocked or materially dishonest.

## Domain Matrix

| Domain                   | Canonical example goal                                   | Output pressure point                                            | Clean output shape                                                                                           | Degraded output shape                                            | Blocked output shape                                            | Must refuse                                                        |
| ------------------------ | -------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------ |
| Podcast / media          | `Publish 6 episodes by deadline`                         | Episode wording must remain concrete and episode-specific        | `Film episode N`, `Edit episode N`, `Publish episode N`, plus release support only when boundary warrants it | Generic show-prep language or overly broad release packaging     | The system would need to invent the endpoint or episode count   | Must not collapse all episodes into a generic production scaffold  |
| Software / product build | `Build the product by deadline`                          | Artifact clarity and release boundary must stay explicit         | Concrete artifact + implementation + verification + conditional release workflow                             | Generic “build” outputs without a concrete artifact boundary     | The system would need to invent the product or release shape    | Must not inflate MVP prep into production hardening by default     |
| Fitness / training       | `Prepare for a marathon by deadline`                     | Measurable target and starting-state sensitivity matter          | Baseline / target / training structure / recovery blocks that can actually be scheduled                      | Vague fitness progress language or weak recovery specificity     | No measurable target or the plan would need to invent the event | Must not pretend aspiration is a trustworthy training plan         |
| Business launch          | `Launch a service by deadline`                           | Offer, launch boundary, and acquisition workflow must be clear   | Offer definition + delivery workflow + acquisition channel + launch outreach                                 | Generic business-prep language or ideation-shaped outputs        | The system would need to invent the business type or offer      | Must not drift into brainstorming a business for the user          |
| Real estate / project    | `Renovate a rental unit to inspection-ready by deadline` | External feasibility gates must stay visible in the output shape | Site / permit / scope / inspection-critical work with concrete handoff sequencing                            | Generic renovation language without permit or inspection realism | The system would need to invent permit / ownership state        | Must not assume acquisition or permit state that was not confirmed |

## Acceptance Cases

The matrix is only valid if the implementation can prove all of the following
across the five domains:

- admitted goals generate domain-specific deliverables instead of generic
  placeholders
- generated task titles remain specific enough to act on without reopening the
  parent goal
- recommended work does not silently become required work
- starting-state differences produce meaningfully different outputs
- scheduled calendar blocks preserve the canonical deliverable titles
- the same output defect produces the same output-family outcome across domains

## Review Rule

If a change improves one domain by weakening output quality in another, the
change fails this matrix.
