# JERICHO Canonical 45 Hardening Matrix

## Purpose

This matrix hardens the canonical 45 lanes against the stabilized
execution-engine contract:

- intake honesty
- readiness and trust discipline
- plan-quality discipline
- output and block quality
- Apply -> Activate lifecycle integrity
- measurable execution suitability for trusted live P.O.S.

The canonical 45 are the 9 archetypes x 5 lanes defined in
`src/state/contracts/archetypeMatrix1_0.ts`. This matrix does not redefine those
lanes. It records where each lane stands under the stabilized contract and what
remains to harden.

## Maturity Legend

- `pass`: lane survives the stabilized contract with no known major gap in the
  matrix categories
- `degraded`: lane works, but one or more substantial gaps still weaken honesty,
  quality, measurability, or trust
- `blocked`: lane cannot yet honestly survive the stabilized contract without
  violating key policy, quality, or lifecycle rules

## Family Clustering Model

| Family                     | Archetypes                                      | Lane count | Current family state | Rollout role            |
| -------------------------- | ----------------------------------------------- | ---------- | -------------------- | ----------------------- |
| Creative / Release Media   | `CreativeProduction`                            | 5          | pass                 | reference baseline      |
| Capability / Credential    | `SkillAcquisition`, `ProfessionalQualification` | 10         | pass                 | reference baseline      |
| Physical Progression       | `PhysicalTraining`                              | 5          | pass                 | reference baseline      |
| Launch / Identity          | `VentureLaunch`, `BrandLaunch`                  | 10         | degraded             | first hardening target  |
| Employment Pipeline        | `JobSearchPipeline`                             | 5          | degraded             | second hardening target |
| Revenue / Capital Pipeline | `SalesPipeline`, `Fundraising`                  | 10         | degraded             | third hardening target  |

Shared family grammar:

- Creative / Release Media: release-shaped deliverables, revision-heavy blocks,
  publish-boundary sensitivity, batch production
- Capability / Credential: evidence-backed learning, threshold-based readiness,
  proof artifacts, assessment checkpoints
- Physical Progression: baseline-sensitive progressions, measurable benchmarks,
  recovery-dependent load changes
- Launch / Identity: offer/identity packaging, pre-launch vs launch boundary,
  launch-readiness assets, external readiness assumptions
- Employment Pipeline: target-role definition, staged outreach, interview
  conversion, externally mediated outcomes
- Revenue / Capital Pipeline: target list -> outreach -> qualification ->
  conversion, with external counterpart dependency and trust gating

## Current Lane Maturity Distribution

- `pass`: 20
- `degraded`: 25
- `blocked`: 0

## Current Family Status

Reference families:

- Creative / Release Media
- Capability / Credential
- Physical Progression

Next highest-leverage degraded family:

- Launch / Identity

## 1. Creative / Release Media

Family state: `pass`

Family-level status:

- endpoint taxonomy: pass
- intake sufficiency: pass
- blocked vs draft threshold: pass
- required vs recommended scope: pass
- output quality: pass
- block title / measurability: pass
- starting-state sensitivity: pass
- lifecycle compatibility: pass
- P.O.S. trust readiness: trusted
- current maturity: pass

Reference family watchpoints:

1. Keep release-ready vs published boundaries explicit on every lane.
2. Prevent batch production from duplicating semantic titles or outputs.
3. Preserve concrete deliverable names from source concept through calendar
   render.

Lanes:

- `TV / Series Writing`
  - maturity: pass
  - lane gap: longform structure can still overpack premise, season arc, and
    episode outline scope if boundary wording is weak
  - recommended next action: keep premise -> arc -> outline -> draft ordering
    strict and preserve episode-level titles end to end
- `Podcast Production`
  - maturity: pass
  - lane gap: publish-ready vs published must stay explicit; launch assets must
    not become required before the boundary demands them
  - recommended next action: keep show concept, format, record/edit, and publish
    prep separated by boundary
- `Music Project Production`
  - maturity: pass
  - lane gap: track list and release package can be conflated if final release
    boundary is not explicit
  - recommended next action: keep concept -> record -> mix/master -> release
    packaging distinct
- `Video Production`
  - maturity: pass
  - lane gap: edit/final delivery can absorb pre-production scope if shot-list
    discipline weakens
  - recommended next action: keep pre-production, shooting, editing, and final
    delivery distinct
- `Book / Longform Writing`
  - maturity: pass
  - lane gap: draft vs revision vs manuscript prep can blur when the input is
    only a generic writing goal
  - recommended next action: keep outline -> draft -> revision -> manuscript
    packaging explicit

## 2. Capability / Credential

Family state: `pass`

Family-level status:

- endpoint taxonomy: pass
- intake sufficiency: pass
- blocked vs draft threshold: pass
- required vs recommended scope: pass
- output quality: pass
- block title / measurability: pass
- starting-state sensitivity: pass
- lifecycle compatibility: pass
- P.O.S. trust readiness: trusted
- current maturity: pass

Family-level hardening gaps:

1. Keep assessment thresholds separate from study effort.
2. Prevent practice artifacts from being treated as proof artifacts too early.
3. Keep baseline skill assumptions explicit when the user has not stated
   readiness.

Lanes:

- `Software Skill Acquisition`
  - maturity: pass
  - lane gap: study volume can be mistaken for usable competence
  - recommended next action: keep learn -> practice -> build -> demonstrate
    ordering strict
- `Design Skill Acquisition`
  - maturity: pass
  - lane gap: critique output can be mistaken for portfolio-ready output
  - recommended next action: keep drills, artifact creation, critique, and
    portfolio packaging distinct
- `Communication Skill Acquisition`
  - maturity: pass
  - lane gap: rehearsal can be over-counted as performance readiness
  - recommended next action: keep draft -> rehearse -> feedback -> perform
    strict
- `Technical Trade Skill Acquisition`
  - maturity: pass
  - lane gap: supervised execution can be overpromoted to independent competence
  - recommended next action: keep procedure learning, guided reps, independent
    reps, and validation separate
- `Creative Skill Acquisition`
  - maturity: pass
  - lane gap: technique drills can hide the difference between practice and
    publishable output
  - recommended next action: keep technique -> experimentation -> refinement ->
    finished output explicit
- `Certification Exam`
  - maturity: pass
  - lane gap: practice exams can be misread as passing readiness
  - recommended next action: keep coverage -> practice -> remediation -> final
    readiness -> exam explicit
- `Licensure Exam`
  - maturity: pass
  - lane gap: compliance docs can lag behind study readiness and still look
    "close enough"
  - recommended next action: keep requirements, study, compliance, scheduling,
    and exam separate
- `Compliance Training Completion`
  - maturity: pass
  - lane gap: mandatory modules can be mistaken for full standing if
    verification lags
  - recommended next action: keep module completion, assessment, and
    verification submission separate
- `Portfolio-Based Qualification`
  - maturity: pass
  - lane gap: portfolio curation can hide weak samples unless criteria alignment
    stays explicit
  - recommended next action: keep artifact creation, curation, narrative
    alignment, and submission distinct
- `Interview-Based Qualification`
  - maturity: pass
  - lane gap: rehearsal can be inflated into interview readiness without
    response-quality evidence
  - recommended next action: keep materials prep, rehearsal, feedback, and
    interview execution separate

## 3. Physical Progression

Family state: `pass` (reference baseline)

Family-level status:

- endpoint taxonomy: pass
- intake sufficiency: pass
- blocked vs draft threshold: pass
- required vs recommended scope: pass
- output quality: pass
- block title / measurability: pass
- starting-state sensitivity: pass
- lifecycle compatibility: pass
- P.O.S. trust readiness: trusted
- current maturity: pass

Reference family watchpoints:

1. Keep baseline load assumptions explicit.
2. Keep recovery measurable rather than implied.
3. Prevent progression blocks from being treated as final-state proof.

Lanes:

- `Strength Program`
  - maturity: pass
  - lane gap: load progression can outrun baseline recovery assumptions
  - recommended next action: keep baseline -> progression -> benchmark ->
    adjustment strict
- `Endurance Performance`
  - maturity: pass
  - lane gap: pacing protocols can blur event readiness if test thresholds are
    not explicit
  - recommended next action: keep base conditioning -> build -> simulation ->
    taper -> event strict
- `Weight Loss / Body Composition`
  - maturity: pass
  - lane gap: adherence logs can hide weak measurement fidelity if checkpoints
    are vague
  - recommended next action: keep baseline metrics, adherence cycles,
    checkpoints, and adjustment separate
- `Rehab Return to Training`
  - maturity: pass
  - lane gap: clearance can be overpromoted before symptom stability is real
  - recommended next action: keep rehab baseline -> protocol adherence ->
    clearance -> graded return strict
- `General Conditioning`
  - maturity: pass
  - lane gap: generic conditioning can drift toward vague fitness language
    unless benchmarks stay concrete
  - recommended next action: keep baseline -> routine adherence -> periodic
    tests -> final review explicit

## 4. Launch / Identity

Family state: `degraded`

Family-level status:

- endpoint taxonomy: pass
- intake sufficiency: degraded
- blocked vs draft threshold: degraded
- required vs recommended scope: degraded
- output quality: degraded
- block title / measurability: pass
- starting-state sensitivity: degraded
- lifecycle compatibility: pass
- P.O.S. trust readiness: provisional
- current maturity: degraded

Family-level hardening gaps:

1. Launch boundary blur can swallow pre-launch setup, launch readiness, and
   post-launch activation into one obligation.
2. Offer / identity / packaging work can be silently promoted from recommended
   to required.
3. Starting-state assumptions about existing brand assets, audience, or
   infrastructure remain too broad.

Lanes:

- `SaaS Product Launch`
  - maturity: degraded
  - lane gap: core feature readiness can over-expand into full product hardening
    and launch polish
  - recommended next action: harden launch-vs-prelaunch questions and freeze
    required scope around the MVP boundary
- `Consumer Product Launch`
  - maturity: degraded
  - lane gap: sample approval, packaging readiness, and sales campaign prep can
    be conflated
  - recommended next action: keep prototype, packaging, listing, and campaign
    gates separate
- `Service Business Launch`
  - maturity: degraded
  - lane gap: offer design and onboarding can inflate into unnecessary
    downstream service complexity
  - recommended next action: keep offer -> pricing -> process -> outreach ->
    close explicit
- `Marketplace Launch`
  - maturity: degraded
  - lane gap: supply-side and demand-side readiness can be over-assumed as a
    single launch state
  - recommended next action: keep supply setup, demand setup, matching, and
    activation distinct
- `Local Business Launch`
  - maturity: degraded
  - lane gap: operations readiness can be mistaken for launch readiness without
    explicit local market activation
  - recommended next action: keep ops readiness, local assets, launch, and
    stabilization separate
- `Personal Brand Launch`
  - maturity: degraded
  - lane gap: identity positioning can be overpacked with launch content and
    profile polish
  - recommended next action: keep positioning, identity system, launch assets,
    and rollout distinct
- `Business Brand Launch`
  - maturity: degraded
  - lane gap: messaging and touchpoint assets can be silently promoted to
    launch-critical scope
  - recommended next action: keep strategy -> messaging -> assets -> deployment
    explicit
- `Product Brand Launch`
  - maturity: degraded
  - lane gap: narrative and packaging work can absorb optional campaign variants
  - recommended next action: keep narrative, identity assets, packaging, and
    campaign separate
- `Artist / Creator Brand Launch`
  - maturity: degraded
  - lane gap: aesthetic identity can be mistaken for release-ready audience
    output
  - recommended next action: keep identity narrative, aesthetic system, media
    assets, and release distinct
- `Campaign Brand Launch`
  - maturity: degraded
  - lane gap: activation collateral can be treated as launch proof before
    rollout actually happens
  - recommended next action: keep theme strategy, identity system, collateral,
    and activation separate

## 5. Employment Pipeline

Family state: `degraded`

Family-level status:

- endpoint taxonomy: pass
- intake sufficiency: degraded
- blocked vs draft threshold: degraded
- required vs recommended scope: pass
- output quality: degraded
- block title / measurability: pass
- starting-state sensitivity: degraded
- lifecycle compatibility: pass
- P.O.S. trust readiness: provisional
- current maturity: degraded

Family-level hardening gaps:

1. Target-role clarity can drift into broad job-market exploration.
2. Outcome quality depends on external employer response, which should keep
   trust provisional until evidence appears.
3. Interview/conversion stages can blur and make the schedule look stronger than
   the pipeline really is.

Lanes:

- `Corporate Role Search`
  - maturity: degraded
  - lane gap: target role scope can expand into unrelated applications and
    generic career advice
  - recommended next action: harden role targeting, materials, application
    batches, and interview prep
- `Remote Knowledge Work Search`
  - maturity: degraded
  - lane gap: remote-readiness can be overclaimed before response data exists
  - recommended next action: keep positioning, materials, outreach/apps, and
    interview readiness separate
- `Creative Role Search`
  - maturity: degraded
  - lane gap: portfolio curation can hide weak role fit unless target family is
    explicit
  - recommended next action: keep portfolio, tailoring, outreach, and interviews
    distinct
- `Skilled Trade Role Search`
  - maturity: degraded
  - lane gap: qualification proof can be mistaken for job readiness without
    employer response evidence
  - recommended next action: keep credential proof, employer targeting,
    outreach, and interview readiness separate
- `Career Transition Search`
  - maturity: degraded
  - lane gap: transition narrative can become a generic reinvention story
    instead of a target-role pipeline
  - recommended next action: keep narrative framing, materials, applications,
    and interview loops explicit

## 6. Revenue / Capital Pipeline

Family state: `degraded`

Family-level status:

- endpoint taxonomy: pass
- intake sufficiency: degraded
- blocked vs draft threshold: degraded
- required vs recommended scope: degraded
- output quality: degraded
- block title / measurability: pass
- starting-state sensitivity: degraded
- lifecycle compatibility: pass
- P.O.S. trust readiness: provisional
- current maturity: degraded

Family-level hardening gaps:

1. Counterparty and market responses are external, so trust must stay
   provisional until live evidence exists.
2. Qualification and conversion stages can be overcounted as progress even when
   no commitments exist.
3. Target lists and outreach sequences can turn into generic activity unless
   stage definitions are explicit.

Lanes:

- `B2B Service Sales`
  - maturity: degraded
  - lane gap: ICP targeting and qualification depth can overinflate pipeline
    health
  - recommended next action: keep prospecting, outreach, qualification, and
    close distinct
- `B2C Product Sales`
  - maturity: degraded
  - lane gap: offer flow and funnel optimization can be mistaken for actual
    conversion
  - recommended next action: keep offer, lead flow, conversion, and follow-up
    explicit
- `High-Ticket Consultative Sales`
  - maturity: degraded
  - lane gap: deep discovery can be treated as closer value than it really is
    without proposal-stage evidence
  - recommended next action: keep discovery, stakeholder mapping, proposal, and
    follow-through separate
- `Retail / Local Offer Sales`
  - maturity: degraded
  - lane gap: local promo activity can swamp actual conversion metrics
  - recommended next action: keep offer clarity, demand generation, conversion
    ops, and follow-up explicit
- `Subscription / Recurring Revenue Sales`
  - maturity: degraded
  - lane gap: acquisition can be mistaken for retention-quality revenue unless
    cohort behavior is explicit
  - recommended next action: keep acquisition, conversion, onboarding handoff,
    and retention follow-up separate
- `Friends and Family Raise`
  - maturity: degraded
  - lane gap: relationship-based support can be treated as committed capital
    before commitments exist
  - recommended next action: keep narrative, target list, outreach, commitment
    tracking, and follow-through separate
- `Angel Raise`
  - maturity: degraded
  - lane gap: investor interest can be overcounted before actual commitments or
    diligence milestones
  - recommended next action: keep narrative, target list, meetings, and
    follow-up explicit
- `Seed Round Raise`
  - maturity: degraded
  - lane gap: diligence readiness can be mistaken for funded readiness
  - recommended next action: keep thesis, deck, investor map, outreach, and
    diligence materials distinct
- `Grant / Non-Dilutive Funding`
  - maturity: degraded
  - lane gap: application volume can hide poor fit if eligibility and submission
    thresholds are fuzzy
  - recommended next action: keep eligibility, materials, deadlines, and
    submissions explicit
- `Sponsorship / Partnership Raise`
  - maturity: degraded
  - lane gap: partnership conversations can be overcounted before proposal or
    agreement evidence exists
  - recommended next action: keep value proposition, target list, outreach,
    proposals, and agreements separate

## Top Systemic Patterns Across the 45

1. Launch / Identity and Revenue / Capital remain the most boundary-sensitive
   families. They are the most likely places for silent scope expansion,
   optimistic P.O.S., and required/recommended leakage.
2. Employment Pipeline remains the most externally mediated family. Trust must
   stay provisional until live response evidence exists.
3. Capability / Credential and Physical Progression are the strongest hardened
   reference families because their outputs, milestones, and recovery/assessment
   thresholds are naturally measurable.
4. Creative / Release Media is the strongest output-quality reference family
   because title fidelity, release boundaries, and measurable deliverables are
   already well exercised.

## Prioritized Next Actions

1. Harden Launch / Identity first. It is the highest-leverage degraded family
   and the most likely source of user-facing scope inflation.
2. Harden Revenue / Capital Pipeline second. It shares pipeline grammar with
   Launch / Identity but adds the strongest external-dependency trust failure
   modes.
3. Harden Employment Pipeline third. It benefits from the same pipeline
   discipline but needs stronger response-based trust gating.
4. Keep Creative / Release Media, Capability / Credential, and Physical
   Progression as reference baseline suites while the degraded families are
   hardened.
