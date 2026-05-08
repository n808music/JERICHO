# JERICHO Cross-Domain Policy Matrix

## Purpose

This matrix defines the proving set for the macro boundary policy, intake
sufficiency policy, plan quality policy, and P.O.S. trust policy across five
materially different goal shapes.

The goal is not to prove that Jericho can do everything. The goal is to prove
that the same policy architecture behaves deterministically across different
domains without silent scope expansion, chatbot drift, or trust inflation.

## Evaluation Questions

Each domain must be judged against the same questions:

1. What counts as a clear endpoint?
2. What ambiguity is blocking vs draftable?
3. What minimum context is required?
4. What assumptions are allowed?
5. What scope must remain required vs recommended vs optional?
6. When is P.O.S. trusted, provisional, or withheld?
7. What outputs are measurable by the stability modules?

## Normalized Ambiguity Taxonomy

Every domain must be reduced to the same reusable ambiguity buckets. Domain
wording may differ, but the policy classification must not.

- `endpoint_ambiguity`
  - the user has not clearly stated what counts as done
- `artifact_ambiguity`
  - the target object or deliverable is unclear
- `starting_state_ambiguity`
  - the system cannot tell where the user is starting from
- `deadline_ambiguity`
  - the horizon is missing, vague, or materially underspecified
- `resource_capacity_ambiguity`
  - time, budget, fitness, staffing, or similar capacity is unclear
- `delivery_mode_ambiguity`
  - publish vs prepare, internal vs external, draft vs live, etc.
- `external_dependency_ambiguity`
  - permits, approvals, contractors, integrations, or other outside gates are
    material but unresolved

Policy rule:

- domain rows may name their own examples
- the evaluation must still reduce them into these shared buckets
- if a domain cannot be mapped into the shared buckets, the intake contract is
  still too weak

## Blocking vs Draftable Thresholds

The same threshold logic applies across all domains. Domain examples may differ,
but the readiness decision must come from the same rule family.

### `intake_blocked`

Use `intake_blocked` when one or more critical ambiguity buckets still prevent
honest planning, especially when:

- the endpoint is unclear and the completion boundary changes required work
- the artifact is unclear and the plan would need to guess the target output
- the external dependency state materially changes feasibility and is unresolved
- the domain cannot produce a measurable draft without inventing the destination

### `assumption_marked_draft`

Use `assumption_marked_draft` only when:

- the primary artifact and endpoint are known
- the remaining ambiguity can be written as explicit assumptions
- those assumptions do not silently change the required work set
- the draft can remain honest while marking recommended or optional work

### `fully_admitted`

Use `fully_admitted` only when:

- the endpoint is clear
- the artifact is clear
- the deadline or horizon is clear when relevant
- the starting state is clear or explicitly assumed
- any external dependency that changes feasibility is known or explicitly
  bounded

If a goal would require the system to invent the destination, silently upgrade
the boundary, or pretend missing context is known, the goal is not fully
admitted.

## Domain-Independent Plan Quality Contract

Every plan must satisfy the same six quality pillars before it is treated as
high-trust:

1. Endpoint clarity
2. Starting-point honesty
3. Scope discipline
4. Dependency coherence
5. Block measurability
6. Feasibility honesty

These pillars are not domain-specific. Domain notes may explain how they show
up, but they do not get to redefine them.

## Measurable Output Standard

Measurable outputs must be durable state changes or concrete artifacts, not
vague progress language.

Examples of valid measurable outputs:

- recorded episode
- edited episode
- publish-ready episode
- deployed feature
- verified training session
- inspection-ready unit

Examples that are too soft on their own:

- progress
- advance
- improve concept
- move forward

## Policy States

The same policy states apply in every domain:

- `fully_admitted`
- `assumption_marked_draft`
- `intake_blocked`

P.O.S. trust states:

- `trusted`
- `provisional`
- `withheld`

Scope classifications:

- `required`
- `recommended`
- `optional`
- `blocked_by_unconfirmed_context`
- `assumed_baseline_supporting`

## Proving Set Matrix

| Domain                   | Canonical example goal                                   | Normalized ambiguity buckets                                                                            | Minimum intake sufficiency                                                           | Expected readiness                                                                                                                                                                                                                                                                                      | Scope discipline                                                                                                                                                                                                                             | P.O.S. trust                                                                                                         | Measurable outputs                                                                                               | Must refuse                                                                                            |
| ------------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Podcast / media          | `Create 6 episodes by deadline`                          | `endpoint_ambiguity`, `artifact_ambiguity`, `delivery_mode_ambiguity`, `starting_state_ambiguity`       | Target count, deadline, completion boundary, production mode, starting state         | `fully_admitted` only once completion boundary is explicit; `assumption_marked_draft` only when the boundary is bounded and the remaining gaps are explicit assumptions; `intake_blocked` when boundary + mode + starting state are all too weak or when the draft would need to invent the destination | Required for `edited`: outline, record, edit. Publishing is required only when `published` is explicit. Show notes become required only at publish-ready or published.                                                                       | `provisional` until boundary and context are resolved; `trusted` only when admission and plan quality are clean      | Episodes, outlines, recording sessions, edit sessions, publish tasks, show notes when publish-ready or published | Must not silently upgrade `edited` to `published` or invent a live-release obligation                  |
| Software / product build | `Ship a v1 feature by deadline`                          | `endpoint_ambiguity`, `artifact_ambiguity`, `delivery_mode_ambiguity`, `external_dependency_ambiguity`  | Target artifact, deadline, definition of done, baseline state, critical integrations | `fully_admitted` when feature and release boundary are explicit; `assumption_marked_draft` when the feature is defined but deployment boundary remains a bounded assumption; `intake_blocked` when the artifact itself is unclear                                                                       | Required is conditional: internal MVP may require implementation + basic verification; public release may require tests + release workflow + rollout. Optional polish stays optional.                                                        | `trusted` only when dependencies and scope are explicit; otherwise `provisional`                                     | Epics, tickets, test coverage, build/release milestones, deployment checkpoints                                  | Must not inflate MVP into full production hardening without confirmation                               |
| Fitness / training       | `Prepare for a marathon by deadline`                     | `endpoint_ambiguity`, `artifact_ambiguity`, `starting_state_ambiguity`, `resource_capacity_ambiguity`   | Event type, deadline, starting state, training mode, injury/constraint context       | `fully_admitted` only when event target and endpoint are explicit; `assumption_marked_draft` when the event is known but the baseline is only assumed; `intake_blocked` when no measurable event target exists or the goal cannot be drafted without inventing a baseline                               | Required: training sessions, recovery, milestone tests. Recommended: nutrition, mobility. Optional: gear upgrades. Recovery is required only to the extent it is trackable or schedulable.                                                   | `provisional` until baseline and load tolerance are clear; `trusted` when plan feasibility and recovery are explicit | Training blocks, mileage, strength sessions, recovery days, test runs                                            | Must not silently assume elite training capacity or race completion boundary                           |
| Business launch          | `Launch a service by deadline`                           | `artifact_ambiguity`, `endpoint_ambiguity`, `delivery_mode_ambiguity`, `external_dependency_ambiguity`  | Offer definition, deadline, launch boundary, starting state, channel assumptions     | `intake_blocked` if the offer is not defined or the endpoint is still a brainstorm; `assumption_marked_draft` only after the offer exists and the launch boundary is bounded; `fully_admitted` once the launch boundary is explicit and the offer is concrete                                           | Required is conditional by channel and boundary: setup may be required for pre-launch; launch workflow becomes required when live launch is explicit. Branding/landing page/outreach are recommended unless the channel makes them required. | `provisional` until launch boundary is clear and scope is bounded                                                    | Offer assets, launch tasks, sales pipeline, setup milestones, launch checklist                                   | Must not upgrade pre-launch preparation into guaranteed market launch or invent the business idea      |
| Real estate / project    | `Renovate a rental unit to inspection-ready by deadline` | `endpoint_ambiguity`, `artifact_ambiguity`, `starting_state_ambiguity`, `external_dependency_ambiguity` | Artifact type, deadline, boundary, site state, approval/permit context               | `intake_blocked` if permit/approval status or delivery boundary is missing; `assumption_marked_draft` only when the site and boundary are known enough to draft safely; `fully_admitted` once the boundary is explicit and external gates are bounded                                                   | Required: scope, permits, critical path, inspection milestones. Recommended: contingency tasks. Optional: upgrades.                                                                                                                          | `withheld` until approval/permit status and baseline are known; `trusted` once scope and feasibility are grounded    | Inspection milestones, permit checkpoints, work packages, delivery milestones                                    | Must not treat optional renovation polish as required delivery work or assume acquisition/permit state |

## Domain-Specific Ambiguity Rules

### Podcast / media

- If the user says `create 6 episodes`, the boundary is ambiguous until the
  system knows whether completion means recorded, edited, publish-ready, or
  published.
- Publishing tasks are not required unless `publish` or `published` is explicit
  or confirmed.
- If completion boundary, production mode, and starting state are all missing,
  the goal is `intake_blocked`, not a speculative draft.
- If the boundary is only `recorded` or `edited`, publication-adjacent work
  remains recommended unless explicitly committed.

### Software / product build

- If the user says `ship`, the system must determine whether that means internal
  delivery, MVP release, or public production release.
- Testing and release gating may be required, but polish work stays recommended
  unless explicit.
- If the artifact is still unclear, the goal is `intake_blocked`; if the
  artifact is clear but release mode is not, the goal is
  `assumption_marked_draft`.
- Required scope must be conditional on the declared boundary rather than
  defaulting to production hardening.

### Fitness / training

- If the user says `prepare`, the system must resolve whether the endpoint is
  race-ready, finish the race, or finish the training block.
- Recovery assumptions must be explicit when baseline fitness is unknown.
- If there is no measurable event target, the goal is `intake_blocked` or
  heavily degraded rather than cleanly draftable.
- A plan without a measurable event target is not allowed to pass as a trusted
  draft.

### Business launch

- If the user says `launch`, the system must distinguish between pre-launch
  setup and actual market launch.
- Sales readiness and channel setup may be required only if launch is explicit.
- If there is no defined offer, the goal is `intake_blocked`.
- If the offer exists but the launch boundary is vague, the goal is
  `assumption_marked_draft`.
- A brainstorm is not an offer. If the offer cannot be named, the goal does not
  become draftable by default.

### Real estate / project

- If the user says `deliver` or `complete`, the system must determine whether
  the boundary is approved, installed, inspected, or sold.
- Permit and approval context are blocking when they materially change the plan.
- If permit / approval / ownership state is unresolved and materially affects
  feasibility, the goal is `intake_blocked`.
- If the plan cannot be tied to a concrete site/boundary state, it stays blocked
  rather than inferred.

## Acceptance Tests

These are the required proving tests for the matrix. The implementation should
not be treated as stable until these pass for all five domains.

### Macro boundary enforcement

- Ambiguous commitments do not silently expand into broader obligations.
- Recommended work is never promoted to required work without policy
  confirmation.
- The system does not drift into open-ended ideation or chatbot-style intake.

### Intake sufficiency

- Clear goals with sufficient context resolve to `fully_admitted`.
- Partially specified goals resolve to `assumption_marked_draft` when a bounded
  draft is allowable.
- Materially ambiguous goals resolve to `intake_blocked` with stable reason
  codes.

### Plan quality

- Plans missing endpoint clarity or starting-state honesty are marked degraded.
- Policy-clean plans remain eligible for scheduling and trust.
- Block measurability is required for a plan to be considered high trust.

### P.O.S. trust gating

- `trusted` P.O.S. is withheld when admission or quality policy fails.
- `provisional` P.O.S. is used when the plan is draftable but still assumption
  marked.
- `trusted` P.O.S. is only allowed when admission, scope, and quality are all
  policy-clean.

### UI surfacing

- Structure shows admission state, assumptions, and policy state compactly.
- Dashboard shows intake, plan quality, and P.O.S. trust compactly.
- Intake-blocked goals stay in the intake path instead of pretending to be fully
  admitted.

### Domain coverage

- Podcast / media:
  - `create 6 episodes by deadline` does not auto-upgrade to `published`
  - explicit `publish` goals resolve to published boundary
- Software / product build:
  - `ship a v1 feature` does not silently become full production hardening
- Fitness / training:
  - training goals remain draftable without inventing elite baseline capacity
- Business launch:
  - launch plans distinguish setup from live launch, and unresolved offers block
- Real estate / project:
  - permit / approval ambiguity blocks or downgrades trust when material

### Pairwise threshold cases

- For each domain, include at least one pair where the first goal is draftable
  and the second, slightly weaker goal is blocked.
- For each domain, include at least one case where a plan is schedulable but
  P.O.S. remains provisional or withheld.
- For each domain, include at least one case where recommended work remains
  recommended and never becomes required by default.
- For each domain, include at least one case where the same ambiguity class is
  classified identically even though the domain wording differs.

## What This Matrix Is For

This matrix is the judge for implementation. If a future policy change helps one
domain by reintroducing chatbot behavior or silent scope expansion in another,
it fails the matrix.

The proving question is not:

- "Can Jericho do five domains?"

The proving question is:

- "Does the same policy architecture hold under five materially different goal
  shapes without special pleading?"
