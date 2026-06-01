# JERICHO Employment Pipeline Hardening Spec

## Purpose

This spec hardens the `Employment Pipeline` family under the stabilized
execution-engine contract.

Family scope:

- `JobSearchPipeline`

The goal is not to make these lanes merely schedulable. The goal is to make them
honest, concrete, measurable, lifecycle-correct, and trustworthy under the same
contract already validated across the canonical 45.

## Family Maturity Target

Current family state: `degraded`

Desired family state after hardening: `pass`

Why this family goes next:

- it is the most externally mediated family after Revenue / Capital
- it is easy to mistake prepared materials for employer response
- application activity can look strong while the pipeline is still weak
- interview prep can be overcounted as interview progress
- trust can inflate before actual response evidence exists

## Canonical Lanes

### JobSearchPipeline

- `Corporate Role Search`
- `Remote Knowledge Work Search`
- `Creative Role Search`
- `Skilled Trade Role Search`
- `Career Transition Search`

## Stabilized Contract This Family Must Obey

1. Intake honesty
2. Readiness and trust discipline
3. Plan-quality discipline
4. Output and block quality
5. Apply -> Activate lifecycle integrity
6. Measurable execution suitability for trusted live P.O.S.

## Shared Family Grammar

Employment goals are not open-ended career conversations. They are bounded
pipeline goals where the system must preserve the user’s exact role-search or
transition boundary.

Shared grammar:

- define the target role family or transition direction
- prepare only the minimum market-facing materials needed
- launch applications or outreach
- collect real employer response evidence
- move pipeline stage honestly
- activate the schedule only when the plan is authoritative
- trust P.O.S. only when employer-side evidence justifies it

## Shared Endpoint Taxonomy

This family must distinguish the following completion boundaries:

- `application_ready`
- `applications_submitted`
- `interview_active`
- `final_round_active`
- `offer_received`
- `accepted_offer`
- `role_secured`
- `transition_accepted`

Policy rule:

- `application_ready` is not `applications_submitted`
- `applications_submitted` is not `interview_active`
- `interview_active` is not `final_round_active`
- `final_round_active` is not `offer_received`
- `offer_received` is not `role_secured`
- materials readiness is not employer response

## Intake Sufficiency

Minimum intake required for a hardening-clean plan:

- target role family or transition direction
- deadline or horizon
- starting state
- qualification / portfolio / credential baseline
- external response context when it materially changes feasibility

Blocked vs draftable rules:

- `intake_blocked` if the target role family is unclear enough that the plan
  would become generic career advice
- `intake_blocked` if the transition direction is missing and cannot be bounded
  honestly
- `assumption_marked_draft` only when the role family is known and the remaining
  assumptions can be written explicitly
- `fully_admitted` only when the target family and starting state are clear
  enough to plan without silent expansion

## Required vs Recommended Scope

Required scope is the minimum work needed to satisfy the declared boundary.

Recommended scope is useful but not required unless the user explicitly commits
to it.

This family must keep the following distinction sharp:

- required: role targeting, applications, outreach, interview prep, follow-up,
  evidence tracking
- recommended: networking polish, extra collateral, secondary channel expansion,
  additional interview rehearsal, personal-brand extras
- optional: nice-to-have portfolio polish, extra templates, experimental
  application variants, broader career exploration

Policy rule:

- resume / portfolio polish must not be promoted into required scope by default
- networking extras must not become a hidden employer-response requirement
- optional career support work must not be treated as pipeline advancement

## Deliverable Grammar

Expected deliverables in this family are concrete and pipeline-shaped, such as:

- target role list
- resume variant
- portfolio variant
- outreach messages
- application tracker
- interview prep pack
- follow-up log
- company list
- transition narrative

Deliverables are invalid if they are only generic labels such as:

- `job search work`
- `career tasks`
- `applications`
- `networking`

## Block Grammar and Measurability

Blocks in this family must be specific enough to be measured by the stability
modules.

Valid block titles:

- `Finalize target role list`
- `Tailor resume for target role set`
- `Submit batch 1 applications`
- `Log responses`
- `Prepare interview answers`
- `Schedule mock interview`
- `Send follow-up batch`
- `Update target company list`

Invalid or weak titles:

- `Work on job search`
- `Improve candidacy`
- `Do career tasks`
- `Networking`

Measurable block requirement:

- every block should represent a concrete artifact, gate, or stage change
- schedule authority does not mean employer-response authority

## Starting-State Sensitivity

This family must distinguish:

- starting from no resume / no portfolio
- starting from a warm material set
- starting from submitted applications
- starting from active interviews
- starting from final-round activity
- starting from offer stage
- starting from transition-in-progress

Policy rule:

- the same lane must produce materially different plans depending on whether the
  materials, applications, responses, and interview state already exist
- assuming a warm pipeline without evidence is not allowed

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

Employment Pipeline is one of the families most vulnerable to false trust.

Trust failure modes:

- schedule exists but employer response is still absent
- interview prep exists but no interviews are active
- applications exist but the pipeline is still weak
- offer-stage language is assumed before evidence exists

Policy rule:

- a schedulable job-search plan can remain `provisional`
- `trusted` requires real employer-side evidence and honest stage state
- `withheld` is acceptable when the target role or transition direction is too
  weak
- prep work must not become trust by default

## Family-Level Hardening Gaps

1. Target-role clarity can drift into broad career exploration.
2. Outcome quality depends on employer response, which should keep trust
   provisional until evidence appears.
3. Application/interview stages can blur and make the schedule look stronger
   than the pipeline really is.

## Lane-Level Hardening Notes

### Corporate Role Search

- maturity: degraded
- lane gap: target role scope can expand into generic career advice
- recommended next action: harden role targeting, materials, applications, and
  interview prep

### Remote Knowledge Work Search

- maturity: degraded
- lane gap: remote-readiness can be overclaimed before response data exists
- recommended next action: keep positioning, materials, outreach/apps, and
  interview readiness separate

### Creative Role Search

- maturity: degraded
- lane gap: portfolio curation can hide weak role fit unless target family is
  explicit
- recommended next action: keep portfolio, tailoring, outreach, and interviews
  distinct

### Skilled Trade Role Search

- maturity: degraded
- lane gap: qualification proof can be mistaken for job readiness without
  employer response evidence
- recommended next action: keep credential proof, employer targeting, outreach,
  and interview readiness separate

### Career Transition Search

- maturity: degraded
- lane gap: transition narrative can become a generic reinvention story instead
  of a target-role pipeline
- recommended next action: keep narrative framing, materials, applications, and
  interview loops explicit

## Family Rollout Logic

Employment Pipeline should be hardened after Launch / Identity and Revenue /
Capital because it reuses the same external-evidence discipline while adding a
new stage grammar around applications, interviews, and offers.

Recommended hardening order:

1. Corporate Role Search
2. Remote Knowledge Work Search
3. Creative Role Search
4. Skilled Trade Role Search
5. Career Transition Search

Rationale:

- Corporate and Remote roles are the cleanest general-purpose reference cases
- Creative roles pressure portfolio fit and targeted proof
- Skilled Trade roles pressure credential evidence and stage honesty
- Career Transition roles pressure narrative discipline without letting the
  system invent a generic reinvention path
