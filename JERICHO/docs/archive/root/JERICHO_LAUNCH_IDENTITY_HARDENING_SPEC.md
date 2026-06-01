# JERICHO Launch / Identity Hardening Spec

## Purpose

This spec hardens the `Launch / Identity` family under the stabilized
execution-engine contract.

Family scope:

- `VentureLaunch`
- `BrandLaunch`

The goal is not to make these lanes merely schedulable. The goal is to make them
honest, concrete, measurable, lifecycle-correct, and trustworthy under the same
contract already validated across the canonical 45.

## Family Maturity Target

Current family state: `degraded`

Desired family state after hardening: `pass`

Why this family goes first:

- it is the most exposed to scope inflation
- it is the most vulnerable to endpoint drift
- it is the most likely to turn launching into generic creative work
- it is where schedulable output most often gets mistaken for trusted readiness

## Canonical Lanes

### VentureLaunch

- `SaaS Product Launch`
- `Consumer Product Launch`
- `Service Business Launch`
- `Marketplace Launch`
- `Local Business Launch`

### BrandLaunch

- `Personal Brand Launch`
- `Business Brand Launch`
- `Product Brand Launch`
- `Artist / Creator Brand Launch`
- `Campaign Brand Launch`

## Stabilized Contract This Family Must Obey

1. Intake honesty
2. Readiness and trust discipline
3. Plan-quality discipline
4. Output and block quality
5. Apply -> Activate lifecycle integrity
6. Measurable execution suitability for trusted live P.O.S.

## Shared Family Grammar

Launch / Identity goals are not open-ended brainstorming goals. They are bounded
execution goals where the system must preserve the user’s exact launch boundary.

Shared grammar:

- define the offer or identity
- lock the launch boundary
- produce launch-ready artifacts
- schedule concrete blocks
- activate the schedule only when the plan is authoritative
- trust P.O.S. only when the evidence is real

## Shared Endpoint Taxonomy

This family must distinguish the following completion boundaries:

- `defined`
- `prepared`
- `launch_ready`
- `launched`
- `live`
- `activated`
- `rolled_out`
- `stabilized`

Policy rule:

- `prepared` is not `launched`
- `launch_ready` is not `live`
- `rolled_out` is not `stabilized`
- identity work is not launch authority unless the launch boundary is explicit

## Intake Sufficiency

Minimum intake required for a hardening-clean plan:

- target offer or identity object
- launch boundary
- deadline or horizon
- starting state
- channel or activation mode when relevant
- capacity or external constraint when it materially changes feasibility

Blocked vs draftable rules:

- `intake_blocked` if the offer / identity object is unclear
- `intake_blocked` if launch boundary is missing and cannot be bounded honestly
- `assumption_marked_draft` only when the offer is known and the remaining
  launch ambiguity can be stated explicitly
- `fully_admitted` only when the launch boundary and starting state are clear
  enough to plan without silent expansion

## Required vs Recommended Scope

Required scope is the minimum work needed to satisfy the declared boundary.

Recommended scope is useful but not required unless the user explicitly commits
to it.

This family must keep the following distinction sharp:

- required: offer definition, positioning, core assets, process/readiness work,
  launch gate work
- recommended: polish, secondary channels, optional campaign expansion, extra
  brand assets, additional content variants
- optional: nice-to-have brand extensions, secondary collateral, experimental
  campaigns

Policy rule:

- launch polish must not be promoted into required scope by default
- identity polish must not become a hidden launch requirement
- optional collateral must not be treated as launch-critical without
  confirmation

## Deliverable Grammar

Expected deliverables in this family are concrete and boundary-shaped, such as:

- positioning statement
- offer package
- pricing sheet
- onboarding workflow
- launch page
- identity brief
- visual system
- messaging framework
- rollout calendar
- activation collateral

Deliverables are invalid if they are only generic labels such as:

- `brand work`
- `launch prep`
- `marketing`
- `identity tasks`

## Block Grammar and Measurability

Blocks in this family must be specific enough to be measured by the stability
modules.

Valid block titles:

- `Finalize offer package`
- `Build onboarding flow`
- `Prepare launch page`
- `Refine messaging framework`
- `Assemble activation collateral`

Invalid or weak titles:

- `Work on brand`
- `Do launch prep`
- `Improve identity`
- `Marketing tasks`

Measurable block requirement:

- every block should represent a concrete artifact, gate, or state change
- a schedule is not trusted merely because it exists

## Starting-State Sensitivity

This family must distinguish:

- starting from scratch
- partially ready
- already branded
- already priced
- already operational

Policy rule:

- the same launch lane must produce materially different plans depending on
  whether the offer, assets, and operational readiness already exist
- assuming partial readiness without evidence is not allowed

## Schedule Lifecycle Compatibility

This family must remain compatible with the stabilized lifecycle:

- `Generate Schedule` creates draft proposed blocks
- `Apply` places proposed blocks on-calendar for review
- `Activate` / `Commit` makes the schedule authoritative
- active required blocks are reschedulable, not casually deletable

Post-activation policy:

- required system-created blocks must not be casually deleted
- regenerate must not behave like a random schedule reroll over an active plan
- major changes must use controlled reschedule/rebuild flow

## P.O.S. Trust Readiness

Launch / Identity is the family most vulnerable to false trust.

Trust failure modes:

- schedule exists but launch boundary is still vague
- identity assets exist but launch readiness is unconfirmed
- launch prep is mistaken for live launch
- external readiness is assumed instead of evidenced

P.O.S. states:

- `withheld` when boundary or external readiness is unresolved
- `provisional` when the plan is draftable but still assumption-marked
- `trusted` only when the launch boundary, scope, and evidence are policy-clean

## Lane Hardening Table

| Lane                            | Current state | Primary gaps                                                                                                                               | Recommended next hardening action                                                                                                       |
| ------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------- |
| `SaaS Product Launch`           | degraded      | MVP vs public launch boundary blur; core feature scope inflates into full hardening; beta readiness and launch readiness collapse together | Freeze the launch boundary, separate beta from public release, and keep launch page/pricing/onboarding distinct from core feature scope |
| `Consumer Product Launch`       | degraded      | sample approval, packaging readiness, and sales campaign prep are conflated; sourcing assumptions are too loose                            | Separate prototype/sample, packaging, listing, and campaign gates                                                                       |
| `Service Business Launch`       | degraded      | offer design and onboarding can balloon into generic service expansion; first outreach can be mistaken for first client                    | Keep offer -> pricing -> process -> outreach -> close explicit                                                                          |
| `Marketplace Launch`            | degraded      | supply and demand readiness are not independently bounded; matching flow can be overclaimed before liquidity exists                        | Separate supply setup, demand setup, matching, and activation                                                                           |
| `Local Business Launch`         | degraded      | operational readiness can be mistaken for launch readiness; local assets can drift into generic marketing                                  | Keep ops readiness, local assets, launch, and stabilization separate                                                                    |
| `Personal Brand Launch`         | degraded      | positioning can absorb identity, content, and rollout scope; channel count is too implicit                                                 | Keep positioning, identity system, launch assets, and rollout distinct                                                                  |
| `Business Brand Launch`         | degraded      | messaging and asset work are overpromoted to launch-critical scope; conversion-critical assets are not isolated                            | Keep strategy -> messaging -> assets -> deployment explicit                                                                             |
| `Product Brand Launch`          | degraded      | narrative, packaging, and campaign variants blur into one generic brand task set                                                           | Keep narrative, identity assets, packaging, and campaign separate                                                                       |
| `Artist / Creator Brand Launch` | degraded      | aesthetic system work can be mistaken for release output; style direction expands silently                                                 | Keep identity narrative, aesthetic system, media assets, and release distinct                                                           |
| `Campaign Brand Launch`         | degraded      | activation collateral can be overcounted as campaign activation; rollout timing is not explicit enough                                     | Keep theme strategy, identity system, collateral, and activation separate                                                               |

## Family Success Criteria

This family is hardened when all of the following are true:

1. The user’s launch boundary is explicit or honestly drafted with visible
   assumptions.
2. Required scope stays separate from recommended scope.
3. Deliverables are concrete and launch-shaped, not generic.
4. Blocks are measurable and survive calendar rendering without title drift.
5. Apply -> Activate authority remains intact.
6. Trusted P.O.S. is withheld until evidence supports it.

## Prioritized Hardening Order Within Family

1. `VentureLaunch::Service Business Launch`
2. `VentureLaunch::SaaS Product Launch`
3. `BrandLaunch::Business Brand Launch`
4. `BrandLaunch::Personal Brand Launch`
5. `VentureLaunch::Marketplace Launch`
6. `BrandLaunch::Product Brand Launch`
7. `VentureLaunch::Local Business Launch`
8. `BrandLaunch::Artist / Creator Brand Launch`
9. `VentureLaunch::Consumer Product Launch`
10. `BrandLaunch::Campaign Brand Launch`

Reason for this ordering:

- the top four lanes most directly exercise scope inflation, boundary clarity,
  and trust gating
- the middle lanes reuse the same launch grammar with stronger
  external-dependency pressure
- the last two lanes are useful edge cases for packaging and campaign inflation
  once the core grammar is locked
