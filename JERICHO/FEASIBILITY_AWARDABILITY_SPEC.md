# Feasibility Awardability Spec

Status: frozen governance brief for the next development phase.

Scope: pre-execution feasibility/support truth only. Live P.O.S., post-execution evidence, and probability-like scoring are out of scope.

## Governing Rule

Plan Quality must become canonically complete before Feasibility can be awarded strongly.

Feasibility requirements must still be defined now so Plan Quality hardening closes the right truth gaps instead of only improving presentation.

## What Feasibility Is Allowed To Mean

Feasibility is not a probability of success.

Pre-execution Feasibility is allowed to answer:

- whether the declared work appears schedulable under known capacity;
- whether the schedule is structurally complete enough to inspect;
- whether the plan covers the terminal goal object and terminal stage;
- whether required work appears accounted for across the contract horizon;
- whether missing baselines or external dependencies cap confidence.

Feasibility is not allowed to imply:

- that an externally mediated outcome will occur;
- that a market will buy;
- that a physical adaptation will happen safely;
- that a recurring cadence is sustainable beyond the modeled structure;
- that a visually plausible schedule is complete.

## Core Concepts

### Capacity Support

`capacity_support` is a throughput/capacity heuristic.

It may use:

- workable days remaining;
- work windows;
- max blocks per day/week;
- scheduled block count;
- scheduled minutes;
- required-vs-scheduled count reconciliation;
- projected slack or overload.

It must not be presented as full feasibility unless plan-quality and input sufficiency gates are also satisfied.

### Feasibility Awardability

Awardability is the permission layer above `capacity_support`.

Awardability states:

- `withheld`
- `support_only`
- `rough_feasibility`
- `trusted_feasibility`

No numeric or probability-like score may exceed the awardability tier justified by canonical truth.

## Required Inputs

Required for any support forecast:

- admitted goal contract;
- goal id and active cycle id;
- terminal outcome text;
- definition of done or verification criteria;
- deadline or contract horizon;
- execution type or lane classification;
- canonical schedule source: proposed, applied review, or active;
- scoped schedule blocks for the active cycle/goal;
- capacity basis: work windows or explicit defaults;
- plan-quality state and failure codes.

Required for rough feasibility:

- canonical deliverables and actions;
- block lineage to deliverable/action or explicit explanation of missing lineage;
- required work estimate or count;
- scheduled work count;
- terminal object not semantically drifted;
- terminal stage not obviously missing;
- no zero-block collapse;
- no stale previous-cycle schedule truth.

Required for trusted feasibility:

- terminal object preserved;
- terminal stage covered;
- required work coverage complete or explicitly incomplete;
- required-vs-scheduled counts reconciled;
- long-horizon distribution valid for the declared contract window;
- recurring cadence bounded and materialized where relevant;
- capacity basis explicit enough to compute slack/strain;
- lane baseline either known or declared non-material;
- external dependency burden classified and capped where necessary.

## Required Plan-Quality Conditions

Plan Quality must close these before `trusted_feasibility` is allowed:

- canonical schedule scoped to active cycle and active goal;
- no draft-only schedule represented as applied truth;
- terminal endpoint present;
- terminal object preserved across deliverables, actions, and blocks;
- terminal stage represented in the plan;
- action and block lineage usable for audit;
- long-horizon goals distribute across the real horizon;
- recurring goals generate bounded cadence structure;
- required sessions and scheduled blocks reconcile or explain mismatch;
- formal plan chart exposes why each task exists, not only what it is.

## Non-Awardability Conditions

Force `withheld`:

- no admitted goal contract;
- no canonical schedule blocks for a schedule-required goal;
- generator failure or action-count overflow;
- zero scheduled blocks after generation/apply;
- stale or cross-cycle schedule truth;
- terminal endpoint missing;
- terminal object missing or semantically drifted;
- plan-quality gate withheld on outcome coverage;
- recurring cadence goal collapses to no schedulable structure;
- capacity basis missing and no safe default is declared.

Force `support_only`:

- capacity can be counted but terminal-stage coverage is partial;
- plan is visible but long-horizon distribution is compressed or understructured;
- required-vs-scheduled counts do not reconcile;
- lane baseline is missing but not clearly blocking;
- assumptions are high but bounded;
- external dependency is dominant and unmodeled.

Allow `rough_feasibility`:

- plan quality is mostly clean;
- schedule is canonical and active-cycle scoped;
- terminal object and terminal stage are represented;
- required work coverage appears complete enough to inspect;
- capacity support is computable;
- remaining assumptions are explicit and moderate;
- lane baseline is known or not critical to the lane.

Allow `trusted_feasibility`:

- plan quality is canonically sufficient;
- required-vs-scheduled reconciliation passes;
- long-horizon or recurring structure passes its lane-specific temporal checks;
- terminal object and terminal stage coverage pass;
- lane baseline minima are satisfied;
- external dependency burden is classified and confidence-capped;
- `capacity_support` is fit or only mildly constrained with explicit slack/strain.

## Plan-Quality Failure Caps

The following plan-quality failures cap or withhold feasibility:

- terminal missing: `withheld`;
- terminal-stage missing: `withheld` or `support_only` if explicitly incomplete;
- semantic drift from goal object: `withheld`;
- recurring zero-block collapse: `withheld`;
- long-horizon compression: `support_only`;
- missing lane baseline: `support_only` unless the lane makes it blocking;
- stale schedule truth: `withheld`;
- zero scheduled blocks: `withheld`;
- incomplete required coverage: `support_only` or `withheld` depending on severity;
- broken lineage: `support_only`, or `withheld` if no audit path exists;
- high assumption burden: `support_only`;
- moderate assumption burden: max `rough_feasibility`.

## Lane-Specific Baseline Minima

These are not broad intake surveys. They are minimal high-leverage facts required before strong feasibility can be awarded.

### Physical Training

Minimum baseline:

- current capability baseline, such as recent longest comfortable run or weekly training volume;
- injury or hard constraint flag if present;
- terminal benchmark/retest requirement.

Missing baseline cap: `support_only`.

### Job Search / Externally Mediated Pipeline

Minimum baseline:

- target role family;
- current resume/portfolio readiness;
- pipeline starting state: no targets, target list ready, applications active, interviews active;
- external decision dependency classified.

External dependency cap: max `rough_feasibility`; never trusted as probability.

### Recurring Creative Cadence

Minimum baseline:

- cadence target;
- number of required outputs over the horizon;
- current asset/backlog state;
- publish or completion boundary.

Zero cadence materialization: `withheld`.

### Product / Sales / Brand Launch

Minimum baseline:

- product readiness stage: idea, prototype, sourced, manufactured, sellable;
- first-sales channel;
- first-sale definition;
- sourcing/manufacturing dependency flag.

Product-stage missing cap: `support_only`.
Product object drift cap: `withheld`.

### Software / Large Build

Minimum baseline:

- current artifact maturity: greenfield, prototype, existing app, production app;
- release boundary;
- checkpoint or milestone structure;
- test/integration burden represented.

Long-horizon compression cap: `support_only`.
Missing release boundary cap: `withheld`.

### Creative Production / EP / Podcast Episodes

Minimum baseline:

- current artifact maturity;
- target output count;
- completion boundary: recorded, edited, publish-ready, published;
- release/publish stage if the terminal outcome requires it.

Missing completion boundary cap: `support_only` or `withheld` if terminal endpoint becomes ambiguous.

## External Dependency Handling

External dependency must not be converted into probability.

If the outcome depends on another party, market response, hiring manager, buyer, manufacturer, distributor, or platform:

- Feasibility may evaluate whether the plan covers the controllable corridor;
- Feasibility must cap confidence for the uncontrollable terminal event;
- trusted feasibility is allowed only for the controllable plan, not for the external acceptance outcome;
- surface language must say what is feasible: "pipeline coverage appears feasible", not "getting hired is feasible."

## Decision Framework

### `withheld`

Use when canonical truth is missing or corrupted.

Examples:

- no schedule;
- zero blocks;
- generator collapse;
- terminal object missing;
- terminal stage missing without explicit incomplete status;
- schedule belongs to a previous cycle;
- no capacity basis.

### `support_only`

Use when the system can describe capacity or schedule pressure but cannot responsibly judge feasibility.

Examples:

- visible schedule but long-horizon compression;
- missing lane baseline;
- high assumptions;
- partial terminal coverage;
- unresolved required-vs-scheduled mismatch.

### `rough_feasibility`

Use when the plan is mostly complete and capacity is computable, but confidence is capped.

Examples:

- external dependency remains;
- moderate assumptions remain;
- lane baseline is present but coarse;
- terminal coverage is present but not richly validated.

### `trusted_feasibility`

Use only when plan quality, capacity support, terminal truth, temporal truth, and lane baseline minima all pass.

This tier should remain unavailable until the short-term and long-term plan-quality fixes are consistently passing visual and regression tests.

## Development Boundary

In scope now:

- define awardability states;
- define `capacity_support` separately from true feasibility;
- route plan-quality failure codes into feasibility caps;
- keep strong feasibility withheld unless all awardability conditions pass;
- add tests that assert caps and withholding behavior.

Out of scope now:

- final numeric feasibility score;
- probability-like language;
- advanced obstacle modeling;
- broad intake surveys;
- strong feasibility claims for incomplete or semantically drifted plans.

## Phase Order

Phase A: Feasibility governance now.

1. Freeze this awardability spec.
2. Define `capacity_support` versus true feasibility.
3. Define caps from plan-quality failures.

Phase B: Plan Quality implementation now.

1. Finish pre-execution support truth alignment.
2. Fix long-horizon temporal compression.
3. Fix terminal-object and terminal-stage coverage.
4. Fix recurring long-term cadence generation.
5. Fix required-vs-scheduled reconciliation.
6. Improve formal chart explanatory semantics.

Phase C: Feasibility infrastructure during Phase B.

1. Implement awardability shell only.
2. Route plan-quality states into feasibility caps.
3. Keep strong scoring withheld unless conditions are met.

Phase D: True Feasibility later.

1. Add minimal lane-baseline intake.
2. Revise formula beyond raw throughput/capacity.
3. Allow stronger feasibility only when canonical plan quality is consistently closed.
