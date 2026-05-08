# JERICHO Launch / Identity Gap Closure Queue

## Purpose

This queue turns the remaining `Launch / Identity` degradation into a finite
implementation target.

It does not reopen the family spec, the acceptance plan, or the macro policy
layer. Those are already established.

This queue only tracks the residual closure items needed to move the family from
`degraded` to `pass`.

## Closure Rule

A queue item leaves the queue only when all of the following are true:

1. The boundary is explicit.
2. Required scope stays separate from recommended scope.
3. Deliverables are family-shaped and concrete.
4. Blocks are measurable and survive calendar rendering without generic drift.
5. Apply -> Activate authority remains intact.
6. Trusted P.O.S. is withheld until evidence supports it.

## Priority Order

Closure order should follow leverage, starting with the most boundary-sensitive
and reusable variants:

1. `Service Business Launch`
2. `SaaS Product Launch`
3. `Business Brand Launch`
4. `Marketplace Launch`
5. `Local Business Launch`
6. `Consumer Product Launch`
7. `Personal Brand Launch`
8. `Product Brand Launch`
9. `Artist / Creator Brand Launch`
10. `Campaign Brand Launch`

## Likely Code Touchpoints

The closure items below should primarily land in these areas:

- `src/core/autoDeliverables.ts`
- `src/domain/autoStrategy.ts`
- `src/domain/goal/GoalPolicy.test.ts`
- `src/domain/goal/LaunchIdentityPolicy.crossDomain.test.ts`
- `tests/state/goalToDeliverables.contract.test.ts`
- `tests/state/goalToDeliverables.actionDerivation.test.ts`
- `tests/state/goalToDeliverables.summary.test.ts`
- `tests/state/goalToDeliverables.schedulerCompatibility.test.js`
- `tests/components/StructurePageConsolidated.admitGoalFlow.test.jsx`
- `tests/components/ZionDashboard.pos.afterAdmit.test.jsx`

## Queue Items

### 1. Service Business Launch

- Gap name: launch-boundary inflation in service offers
- Current failure expression: offer design and onboarding can expand into
  generic service expansion, and early outreach can look like a finished launch
- Desired corrected behavior: the plan must keep
  `offer -> pricing -> process -> outreach -> close` explicit, with launch prep
  staying provisional until live evidence exists
- Acceptance proof: a target such as `Launch a consulting service by deadline`
  must remain `provisional` until the launch boundary is explicit and the block
  set stays concrete
- Promotion rule: the lane leaves the queue only when the output grammar
  preserves offer, process, outreach, and close as distinct stages

### 2. SaaS Product Launch

- Gap name: MVP boundary blur
- Current failure expression: core feature readiness can over-expand into full
  product hardening, and launch polish can be treated as required before the
  boundary is explicit
- Desired corrected behavior: the plan must freeze the MVP boundary, separate
  beta from public release, and keep launch page, pricing, and onboarding
  distinct from core feature scope
- Acceptance proof: `Ship a SaaS MVP by deadline` must not pull production
  hardening into required scope by default, and `Build a product by deadline`
  must remain `intake_blocked`
- Promotion rule: the lane leaves the queue only when MVP, beta, and public
  launch produce different deliverable sets and trust states

### 3. Business Brand Launch

- Status: closed
- Closure note: brand strategy, messaging, identity, core assets, and launch
  announcement now stay separate from campaign-style touchpoint inflation.
- Removed failure mode: launch-week content batch and engagement follow-up no
  longer sit on the required path by default.

- Gap name: messaging and touchpoint inflation
- Current failure expression: strategy, messaging, and asset work can be
  silently promoted into launch-critical scope
- Desired corrected behavior: brand strategy, messaging, assets, and deployment
  must remain separate, with polish staying recommended unless the boundary
  demands it
- Acceptance proof: a brand-launch goal must keep optional creative variations
  out of required scope and remain `provisional` until the identity boundary is
  honest
- Promotion rule: the lane leaves the queue only when messaging assets no longer
  auto-promote into launch authority

### 4. Marketplace Launch

- Gap name: supply/demand readiness collapse
- Current failure expression: supply-side and demand-side readiness can be
  over-assumed as a single launch state, and matching flow can be overclaimed
  before liquidity exists
- Desired corrected behavior: supply setup, demand setup, matching, and
  activation must remain distinct, with each stage waiting on its own evidence
- Acceptance proof: a marketplace goal must not become `trusted` just because
  one side is prepared
- Promotion rule: the lane leaves the queue only when supply and demand are
  independently tracked and launch trust remains provisional until both are
  evidenced

### 5. Local Business Launch

- Gap name: operations-readiness overclaim
- Current failure expression: operations readiness can be mistaken for launch
  readiness without explicit local market activation
- Desired corrected behavior: ops readiness, local assets, launch, and
  stabilization must remain separate, and local visibility work must stay
  recommended until the launch boundary demands it
- Acceptance proof: local launch tasks remain reviewable without being treated
  as live market activation
- Promotion rule: the lane leaves the queue only when local ops and market
  activation are no longer conflated

### 6. Consumer Product Launch

- Gap name: packaging and sample conflation
- Current failure expression: sample approval, packaging readiness, and sales
  campaign prep can be conflated into one launch obligation
- Desired corrected behavior: prototype/sample, packaging, listing, and campaign
  gates must stay distinct, with launch polish remaining recommended until
  needed
- Acceptance proof: packaging work cannot silently become required launch work
  before the boundary is explicit
- Promotion rule: the lane leaves the queue only when sample, packaging, and
  campaign stages each have separate evidence requirements

### 7. Personal Brand Launch

- Gap name: identity positioning swallows launch content
- Current failure expression: positioning can absorb identity, content, and
  rollout scope, and channel count can stay implicit
- Desired corrected behavior: positioning, identity system, launch assets, and
  rollout must remain distinct, with content volume not auto-promoted to
  required scope
- Acceptance proof: a personal brand goal must not produce generic
  profile-polish requirements as launch-critical work
- Promotion rule: the lane leaves the queue only when positioning and launch
  assets are separate in both deliverables and blocks

### 8. Product Brand Launch

- Gap name: narrative and packaging overpack
- Current failure expression: narrative, identity assets, and packaging work can
  absorb optional campaign variants into a single generic brand task set
- Desired corrected behavior: narrative, identity assets, packaging, and
  campaign must remain separate, with campaign variants staying optional unless
  the user commits otherwise
- Acceptance proof: brand-launch deliverables stay concrete and do not flatten
  into generic `brand work`
- Promotion rule: the lane leaves the queue only when campaign variants no
  longer inflate the required launch path

### 9. Artist / Creator Brand Launch

- Gap name: aesthetic system mistaken for release output
- Current failure expression: aesthetic identity can be mistaken for
  release-ready audience output, and style direction expands silently
- Desired corrected behavior: identity narrative, aesthetic system, media
  assets, and release must remain distinct
- Acceptance proof: the lane must preserve release readiness separately from
  style polish and aesthetic exploration
- Promotion rule: the lane leaves the queue only when visual identity work no
  longer counts as launch proof by itself

### 10. Campaign Brand Launch

- Gap name: activation collateral overcounted as launch proof
- Current failure expression: theme strategy, collateral, and activation
  materials can be treated as proof of rollout before the rollout actually
  happens
- Desired corrected behavior: theme strategy, identity system, collateral, and
  activation must remain separate, and launch proof must require actual
  activation evidence
- Acceptance proof: collateral readiness remains provisional until activation is
  observable
- Promotion rule: the lane leaves the queue only when activation evidence is
  required before launch trust is granted

## Queue Exit Summary

The family can be promoted from `degraded` to `pass` when the following are all
true across the remaining lanes:

- no lane silently inflates launch scope
- no lane treats prep as live launch
- no lane promotes polish into required work by default
- no lane grants trust from schedulability alone
- no lane collapses boundary states into generic launch language
