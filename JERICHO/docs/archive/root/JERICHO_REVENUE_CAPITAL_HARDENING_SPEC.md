# JERICHO Revenue / Capital Hardening Spec

## Purpose

This spec hardens the `Revenue / Capital Pipeline` family under the stabilized
execution-engine contract.

Family scope:

- `SalesPipeline`
- `Fundraising`

The goal is not to make these lanes merely schedulable. The goal is to make them
honest, concrete, measurable, lifecycle-correct, and trustworthy under the same
contract already validated across the canonical 45.

## Family Maturity Target

Current family state: `degraded`

Desired family state after hardening: `pass`

Why this family goes next:

- it is the most externally mediated family after Launch / Identity
- it is the easiest place to overcount activity as progress
- it is where internal work can look clean while external truth remains weak
- it is the most likely place for trusted P.O.S. to become optimistic without
  evidence

## Canonical Lanes

### SalesPipeline

- `B2B Service Sales`
- `B2C Product Sales`
- `High-Ticket Consultative Sales`
- `Retail / Local Offer Sales`
- `Subscription / Recurring Revenue Sales`

### Fundraising

- `Friends and Family Raise`
- `Angel Raise`
- `Seed Round Raise`
- `Grant / Non-Dilutive Funding`
- `Sponsorship / Partnership Raise`

## Stabilized Contract This Family Must Obey

1. Intake honesty
2. Readiness and trust discipline
3. Plan-quality discipline
4. Output and block quality
5. Apply -> Activate lifecycle integrity
6. Measurable execution suitability for trusted live P.O.S.

## Shared Family Grammar

Revenue / Capital goals are not open-ended activity goals. They are bounded
pipeline goals where the system must preserve the user’s exact conversion or
funding boundary.

Shared grammar:

- define the offer, narrative, or funding case
- define the target counterpart universe
- launch outreach or qualification work
- collect real external evidence
- move pipeline stage honestly
- activate the schedule only when the plan is authoritative
- trust P.O.S. only when external evidence justifies it

## Shared Endpoint Taxonomy

This family must distinguish the following completion boundaries:

- `pipeline_defined`
- `assets_ready`
- `outreach_launched`
- `conversations_active`
- `qualified_opportunities_active`
- `proposals_submitted`
- `commitment_closed`
- `funding_secured`
- `sale_closed`
- `partnership_signed`

Policy rule:

- `outreach_launched` is not `conversations_active`
- `conversations_active` is not `qualified_opportunities_active`
- `qualified_opportunities_active` is not `commitment_closed`
- `proposals_submitted` is not `funding_secured`
- `pipeline_defined` is not traction

## Intake Sufficiency

Minimum intake required for a hardening-clean plan:

- target amount or conversion target
- offer, thesis, or funding narrative
- target counterpart list or target market list
- deadline or horizon
- starting state
- external dependency or response context when it materially changes feasibility

Blocked vs draftable rules:

- `intake_blocked` if the target amount, counterpart universe, or conversion
  boundary is unclear enough that the plan would invent traction
- `intake_blocked` if the offer / narrative itself is missing and cannot be
  bounded honestly
- `assumption_marked_draft` only when the target and external boundary are known
  and the remaining assumptions can be written explicitly
- `fully_admitted` only when the target, boundary, and starting state are clear
  enough to plan without silent expansion

## Required vs Recommended Scope

Required scope is the minimum work needed to satisfy the declared boundary.

Recommended scope is useful but not required unless the user explicitly commits
to it.

This family must keep the following distinction sharp:

- required: offer packaging, target list, outreach, qualification, follow-up,
  proposal or diligence work, commitment tracking
- recommended: extra collateral, optional sequence variants, extra analytics,
  additional channel expansion, expanded follow-up tooling
- optional: nice-to-have polish, secondary assets, experimental channel work,
  deeper dashboarding, extra reporting variants

Policy rule:

- activity volume must not be promoted into required scope by default
- extra collateral must not become a hidden conversion or funding requirement
- outreach or qualification support work must not be inflated into closed
  outcomes without external evidence

## Deliverable Grammar

Expected deliverables in this family are concrete and pipeline-shaped, such as:

- target list
- offer package
- narrative package
- outreach sequence
- qualification tracker
- proposal set
- diligence package
- commitment tracker
- follow-up log

Deliverables are invalid if they are only generic labels such as:

- `sales work`
- `pipeline work`
- `fundraising tasks`
- `business development`

## Block Grammar and Measurability

Blocks in this family must be specific enough to be measured by the stability
modules.

Valid block titles:

- `Finalize target list`
- `Write outreach sequence`
- `Send batch 1`
- `Log responses`
- `Qualify active opportunities`
- `Prepare proposal set`
- `Submit diligence package`
- `Track commitment status`

Invalid or weak titles:

- `Work on sales`
- `Do fundraising`
- `Improve pipeline`
- `Marketing tasks`

Measurable block requirement:

- every block should represent a concrete artifact, gate, or stage change
- schedule authority does not mean external traction authority

## Starting-State Sensitivity

This family must distinguish:

- starting from no list / no narrative
- starting from a warm list or partial asset base
- starting from active outreach
- starting from active conversations
- starting from active proposals or diligence
- starting from partial commitments

Policy rule:

- the same lane must produce materially different plans depending on whether the
  target list, narrative, outreach state, and external response state already
  exist
- assuming a warm pipeline without evidence is not allowed

## Schedule Lifecycle Compatibility

This family must remain compatible with the stabilized lifecycle:

- `Generate Schedule` creates draft proposed blocks
- `Apply` places proposed blocks on-calendar for review
- `Activate` / `Commit` makes the schedule authoritative
- active required blocks are reschedulable, not casually deletable

Post-activation policy:

- required system-created blocks must not be casually deleted
- regenerate must not behave like a random outreach reroll over an active plan
- major changes must use controlled reschedule or rebuild flow

## P.O.S. Trust Readiness

Revenue / Capital is the family most vulnerable to false trust because the
calendar can look busy before the external world has changed.

Trust failure modes:

- activity is mistaken for traction
- conversations are mistaken for commitments
- proposal readiness is mistaken for funding or sale closure
- pipeline state is inferred from effort rather than evidence

P.O.S. states:

- `withheld` when external evidence is absent or the boundary is unresolved
- `provisional` when the plan is draftable but still assumption-marked
- `trusted` only when the boundary is explicit and external evidence supports
  the stage claim

## Lane Hardening Table

| Lane                                     | Current state | Primary gaps                                                                                 | Recommended next hardening action                                                       |
| ---------------------------------------- | ------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `B2B Service Sales`                      | degraded      | ICP targeting can inflate pipeline health before qualified conversations exist               | Keep target list, outreach, qualification, proposal, and close distinct                 |
| `B2C Product Sales`                      | degraded      | acquisition activity can be mistaken for conversion and repeatable revenue                   | Keep offer packaging, traffic, conversion, and follow-up explicit                       |
| `High-Ticket Consultative Sales`         | degraded      | discovery can be treated as value already created without proposal-stage evidence            | Keep discovery, stakeholder mapping, proposal, and follow-through separate              |
| `Retail / Local Offer Sales`             | degraded      | local promo activity can swamp actual conversion metrics                                     | Keep offer clarity, demand generation, conversion ops, and follow-up explicit           |
| `Subscription / Recurring Revenue Sales` | degraded      | acquisition can be mistaken for retention-quality revenue unless cohort behavior is explicit | Keep acquisition, conversion, onboarding handoff, and retention follow-up separate      |
| `Friends and Family Raise`               | degraded      | relationship support can be treated as committed capital before commitments exist            | Keep narrative, target list, outreach, commitment tracking, and follow-through separate |
| `Angel Raise`                            | degraded      | investor interest can be overcounted before commitments or diligence milestones exist        | Keep narrative, target list, meetings, diligence, and follow-up explicit                |
| `Seed Round Raise`                       | degraded      | diligence readiness can be mistaken for funded readiness                                     | Keep thesis, deck, investor map, outreach, and diligence materials distinct             |
| `Grant / Non-Dilutive Funding`           | degraded      | application volume can hide poor fit if eligibility and submission thresholds are fuzzy      | Keep eligibility, materials, deadlines, and submissions explicit                        |
| `Sponsorship / Partnership Raise`        | degraded      | partnership conversations can be overcounted before proposal or agreement evidence exists    | Keep value proposition, target list, outreach, proposals, and agreements separate       |

## Family Success Criteria

This family is hardened when all of the following are true:

1. The target amount, offer/narrative, and external boundary are explicit or
   honestly drafted with visible assumptions.
2. Required scope stays separate from recommended scope.
3. Deliverables are concrete and pipeline-shaped, not generic.
4. Blocks are measurable and survive calendar rendering without title drift.
5. Apply -> Activate authority remains intact.
6. Trusted P.O.S. is withheld until live external evidence supports the stage
   claim.

## Prioritized Hardening Order Within Family

1. `B2B Service Sales`
2. `Angel Raise`
3. `Seed Round Raise`
4. `High-Ticket Consultative Sales`
5. `Grant / Non-Dilutive Funding`
6. `Sponsorship / Partnership Raise`
7. `Subscription / Recurring Revenue Sales`
8. `B2C Product Sales`
9. `Retail / Local Offer Sales`
10. `Friends and Family Raise`
