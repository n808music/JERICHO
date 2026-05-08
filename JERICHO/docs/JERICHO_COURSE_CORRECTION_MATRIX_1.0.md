# Jericho Course Correction Matrix 1.0

## Purpose

This document defines the bounded course-correction and recovery layer for
Jericho 1.0.

The planning system is not complete if it can only compile forward plans. A real
execution engine must also detect deviation, classify failure, and propose
bounded recovery actions without losing structural coherence.

This matrix makes course correction part of the 1.0 freeze surface.

## 1.0 Recovery Principle

Jericho should not rely on vague advice like “work harder” or “get back on
track.” It should detect concrete execution drift and map that drift into
bounded, lane-specific recovery logic.

## Recovery Model

For each of the 45 lanes, define:

- Common drift signals
- Likely failure classes
- Default recovery levers
- Auto-adjust vs confirmation-required behavior
- Recovery output focus

## Global Drift Signal Types

These are the reusable signal categories across lanes:

1. Missed scheduled sessions
2. Delayed or incomplete top-level outputs
3. Weak benchmark / low readiness signal
4. Low throughput (applications, outreach, sales, etc.)
5. Quality failure (output exists but below threshold)
6. Dependency blockage
7. Capacity overrun / schedule compression
8. Low adherence / inconsistency
9. Resource/tooling gap
10. External timing disruption

## Global Failure Classes

These are the reusable classification buckets:

1. Scope overload
2. Capacity mismatch
3. Sequencing failure
4. Readiness gap
5. Quality gap
6. Resource gap
7. Consistency failure
8. Conversion failure
9. Recovery/safety failure
10. Unclear success definition

## Global Recovery Levers

These are the bounded levers the system may use:

1. Reduce scope
2. Reorder outputs or dependencies
3. Increase remediation / review
4. Shift schedule density
5. Add buffer or checkpoint
6. Split a deliverable into smaller outputs
7. Replace a high-load action with a lighter equivalent
8. Escalate missing context question
9. Change target threshold or deadline expectation
10. Pause and confirm assumptions before proceeding

## Auto-Adjust vs Confirmation Rule

Jericho may auto-adjust when the change is structural but low-risk, such as:

- reordering non-critical actions
- inserting review/remediation blocks
- splitting outputs into smaller pieces
- shifting schedule density within existing constraints

Jericho should require confirmation when the change affects goal meaning, such
as:

- reducing declared scope of the goal
- changing what counts as success
- moving a hard deadline
- downgrading a target metric materially
- pausing a lane because assumptions were wrong

## Recovery Output Format

The system should render recovery in this general form:

- issue detected
- likely failure class
- recovery adjustment proposed
- tradeoff introduced
- whether confirmation is required

---

# 1. VentureLaunch

## 1.1 SaaS Product Launch

**Common drift signals**

- MVP build behind schedule
- critical feature incomplete
- no usable beta flow by review checkpoint
- beta-user acquisition prep not ready

**Likely failure classes**

- scope overload
- sequencing failure
- resource gap
- unclear success definition

**Default recovery levers**

- reduce MVP feature scope
- move non-critical launch assets after beta readiness
- split build outputs into core vs optional
- add focused testing/remediation block

**Auto-adjust vs confirmation**

- auto: reorder tasks, split outputs, insert test block
- confirm: redefine launch from public release to beta-ready MVP

**Recovery output focus**

- preserve functional core and user testability before expansion

## 1.2 Consumer Product Launch

**Common drift signals**

- prototype/sample rejected or delayed
- packaging not ready on time
- sourcing/inventory uncertain
- product page not aligned to actual readiness

**Likely failure classes**

- resource gap
- scope overload
- sequencing failure
- external timing disruption

**Default recovery levers**

- simplify packaging scope
- narrow SKU/variant count
- shift campaign prep behind sample approval
- insert supplier follow-up checkpoint

**Auto-adjust vs confirmation**

- auto: reorder campaign/page work, add supplier checkpoint
- confirm: reduce launch ambition to sample-approved prelaunch instead of
  inventory-ready launch

**Recovery output focus**

- align launch promise to actual supply and packaging readiness

## 1.3 Service Business Launch

**Common drift signals**

- offer still unclear late in timeline
- outreach not started because client materials unfinished
- onboarding/delivery process still vague
- no response from first outreach wave

**Likely failure classes**

- unclear success definition
- sequencing failure
- conversion failure
- quality gap

**Default recovery levers**

- tighten offer into one clear package
- simplify onboarding materials to minimum viable set
- start outreach with lighter material set sooner
- revise outreach message after first weak wave

**Auto-adjust vs confirmation**

- auto: simplify materials, reorder outreach earlier, revise message
- confirm: narrow service scope or target niche materially

**Recovery output focus**

- get to credible offer + market contact faster

## 1.4 Marketplace Launch

**Common drift signals**

- one side of marketplace not onboarding
- workflow still undefined near activation point
- no first matches possible
- supply and demand build both lagging

**Likely failure classes**

- sequencing failure
- scope overload
- conversion failure
- resource gap

**Default recovery levers**

- focus on constrained side first
- narrow niche to improve liquidity odds
- simplify workflow to manual/assisted matching
- delay dual-sided activation until one side is ready

**Auto-adjust vs confirmation**

- auto: insert side-priority focus, simplify workflow
- confirm: narrow marketplace ambition or redefine launch milestone

**Recovery output focus**

- create first viable liquidity event, not full platform symmetry

## 1.5 Local Business Launch

**Common drift signals**

- operations not ready when marketing starts
- marketing assets done but no inquiries
- booking process creates friction
- first service delivery readiness uncertain

**Likely failure classes**

- sequencing failure
- conversion failure
- quality gap
- capacity mismatch

**Default recovery levers**

- simplify service menu
- fix booking and intake flow first
- shift promotion toward channels with fastest feedback
- add first-customer service rehearsal/checklist

**Auto-adjust vs confirmation**

- auto: reorder ops before promotion, simplify intake
- confirm: reduce local area scope or redefine initial service offering

**Recovery output focus**

- ensure service can actually be delivered before demand scales

---

# 2. SkillAcquisition

## 2.1 Software Skill Acquisition

**Common drift signals**

- practice completed but no working projects
- repeated concept confusion
- project blocked by environment/tooling issues
- milestone demo not functional

**Likely failure classes**

- readiness gap
- resource gap
- consistency failure
- scope overload

**Default recovery levers**

- replace broad study with targeted concept remediation
- reduce project complexity
- insert environment/setup repair block
- shift from theory-heavy work to guided build reps

**Auto-adjust vs confirmation**

- auto: add remediation, simplify project, rebalance study/build ratio
- confirm: downgrade end target from multi-project portfolio to one strong
  project

**Recovery output focus**

- restore momentum by producing functioning work, not more passive study

## 2.2 Design Skill Acquisition

**Common drift signals**

- exercises completed but polished outputs weak
- tool friction slows output quality
- critique reveals repeated layout/visual problems
- portfolio set incomplete near deadline

**Likely failure classes**

- quality gap
- readiness gap
- capacity mismatch
- scope overload

**Default recovery levers**

- reduce number of final pieces
- insert critique-informed revision loop
- narrow style/domain focus
- prioritize one strong polished set over many weak outputs

**Auto-adjust vs confirmation**

- auto: add revision block, narrow output set
- confirm: materially lower output count or change success definition from
  portfolio set to sample set

**Recovery output focus**

- maximize visible quality per finished artifact

## 2.3 Communication Skill Acquisition

**Common drift signals**

- many drills but no clear performance improvement
- recorded samples remain weak
- confidence or delivery collapses under mock conditions
- final event readiness low

**Likely failure classes**

- consistency failure
- quality gap
- readiness gap
- unclear success definition

**Default recovery levers**

- shift from drills to recorded/live reps
- narrow communication target (clarity, confidence, structure)
- insert mock-feedback loop
- reduce breadth of final presentation/output

**Auto-adjust vs confirmation**

- auto: change drill mix, add more reps and mock review
- confirm: lower final performance ambition or shift success definition

**Recovery output focus**

- convert repetition into measurable performance gains

## 2.4 Technical Trade Skill Acquisition

**Common drift signals**

- repeated procedure errors
- safety/process adherence weak
- independent competency not achieved
- practice opportunities too limited

**Likely failure classes**

- readiness gap
- safety/recovery failure
- consistency failure
- resource gap

**Default recovery levers**

- return to guided repetition
- add procedural checklist enforcement
- narrow task set to core procedures only
- insert safety review before independent reps

**Auto-adjust vs confirmation**

- auto: guided-rep block, checklist emphasis, narrower task focus
- confirm: reduce independent competency target if practice access is
  insufficient

**Recovery output focus**

- restore procedural reliability before independence claims

## 2.5 Creative Skill Acquisition

**Common drift signals**

- exercises done but no finished pieces
- finished pieces below expected quality
- creative stagnation / too much ideation, too little completion
- portfolio mini-set incomplete

**Likely failure classes**

- consistency failure
- quality gap
- scope overload
- unclear success definition

**Default recovery levers**

- prioritize finished-piece cadence over more exercises
- cut number of target outputs
- add reference/inspiration refresh block
- narrow technique/style focus

**Auto-adjust vs confirmation**

- auto: shift from drills to completion, reduce output count
- confirm: materially lower showcase/portfolio expectation

**Recovery output focus**

- force completion and visible evidence of skill growth

---

# 3. ProfessionalQualification

## 3.1 Certification Exam

**Common drift signals**

- practice scores below threshold
- weak domains not improving
- study coverage behind schedule
- exam date approaching with low readiness

**Likely failure classes**

- readiness gap
- consistency failure
- capacity mismatch
- unclear success definition

**Default recovery levers**

- shift time to weak domains
- increase practice-test frequency
- add final remediation block
- taper nonessential topics

**Auto-adjust vs confirmation**

- auto: redistribute study and remediation blocks
- confirm: move exam date or change attempt target if readiness remains low

**Recovery output focus**

- improve readiness signal, not just study volume

## 3.2 Licensure Exam

**Common drift signals**

- admin/application steps incomplete
- readiness low near exam date
- practice performance weak
- prerequisites still unresolved

**Likely failure classes**

- sequencing failure
- readiness gap
- capacity mismatch
- external timing disruption

**Default recovery levers**

- prioritize admin/compliance tasks immediately
- narrow study scope to tested high-value areas
- insert more practice and remediation
- add deadline-risk checkpoint

**Auto-adjust vs confirmation**

- auto: reorder admin ahead of study expansion, intensify remediation
- confirm: reschedule exam attempt or redefine milestone target

**Recovery output focus**

- keep eligibility and readiness synchronized

## 3.3 Compliance Training Completion

**Common drift signals**

- modules incomplete near deadline
- assessments failed
- missing submission docs
- access/system issues block progress

**Likely failure classes**

- sequencing failure
- readiness gap
- resource gap
- external timing disruption

**Default recovery levers**

- prioritize mandatory modules only
- add retake/remediation block after failed assessments
- escalate access issues immediately
- separate documentation submission sprint

**Auto-adjust vs confirmation**

- auto: reprioritize modules, add retake block, isolate admin sprint
- confirm: only if compliance completion by deadline is no longer feasible

**Recovery output focus**

- ensure hard compliance completion before optimization or polish

## 3.4 Portfolio-Based Qualification

**Common drift signals**

- not enough high-quality pieces
- supporting docs behind
- weak pieces consuming too much polish time
- package incomplete near submission

**Likely failure classes**

- quality gap
- scope overload
- sequencing failure
- capacity mismatch

**Default recovery levers**

- cut weakest pieces
- prioritize minimum strong set
- split creation and packaging into separate recovery blocks
- improve documentation clarity over additional polish on weak work

**Auto-adjust vs confirmation**

- auto: reduce sample set, reorder packaging tasks
- confirm: lower submission ambition if minimum criteria cannot be met

**Recovery output focus**

- maximize submission viability with strongest subset

## 3.5 Interview-Based Qualification

**Common drift signals**

- weak mock performance
- answer quality too vague
- low confidence near interview
- poor understanding of evaluator expectations

**Likely failure classes**

- readiness gap
- quality gap
- consistency failure
- unclear success definition

**Default recovery levers**

- add mock interview cycle
- strengthen story/example bank
- narrow answer frameworks to key themes
- add targeted research block on evaluation context

**Auto-adjust vs confirmation**

- auto: more mocks, stronger examples, tighter frameworks
- confirm: only if user wants to redefine success from “ace interview” to
  “interview-ready”

**Recovery output focus**

- increase confidence and answer specificity under pressure

---

# 4. PhysicalTraining

## 4.1 Strength Program

**Common drift signals**

- missed training sessions
- lift performance stalls or regresses
- recovery markers poor
- pain limits progression

**Likely failure classes**

- capacity mismatch
- recovery/safety failure
- consistency failure
- readiness gap

**Default recovery levers**

- reduce volume/load
- add deload or recovery block
- simplify progression scheme
- replace aggravating movements with lower-load equivalents

**Auto-adjust vs confirmation**

- auto: deload, load adjustment, movement substitution
- confirm: lower target strength benchmark materially

**Recovery output focus**

- preserve continuity and safe progress, not ego targets

## 4.2 Endurance Performance

**Common drift signals**

- missed conditioning sessions
- pace benchmarks missed badly
- fatigue/injury risk rising
- long effort readiness weak near event

**Likely failure classes**

- capacity mismatch
- recovery/safety failure
- readiness gap
- consistency failure

**Default recovery levers**

- lower intensity temporarily
- extend base phase
- reduce event ambition or intermediate benchmarks
- insert taper/recovery earlier

**Auto-adjust vs confirmation**

- auto: schedule redistribution, lower intensity, added recovery
- confirm: change event goal pace or redefine success threshold

**Recovery output focus**

- salvage safe completion or realistic benchmark attainment

## 4.3 Weight Loss / Body Composition

**Common drift signals**

- trend stalls for multiple checkpoints
- adherence inconsistent
- fatigue or rebound behavior appears
- checkpoint outputs not reached on time

**Likely failure classes**

- consistency failure
- capacity mismatch
- unclear success definition
- recovery/safety failure

**Default recovery levers**

- simplify adherence plan
- add checkpoint review and reset
- adjust energy balance activity/training load moderately
- shift emphasis to trend consistency before aggressive target pace

**Auto-adjust vs confirmation**

- auto: checkpoint reset, adherence simplification, modest workload adjustments
- confirm: materially lower target rate or redefine end metric

**Recovery output focus**

- restore adherence and trend direction before intensifying

## 4.4 Rehab Return to Training

**Common drift signals**

- symptoms flare with progression
- readiness checkpoints fail
- pain-free movement milestone not achieved
- modified training not tolerated

**Likely failure classes**

- recovery/safety failure
- readiness gap
- capacity mismatch
- sequencing failure

**Default recovery levers**

- regress to earlier rehab phase
- reduce loading/progression speed
- insert symptom-monitoring checkpoint
- pause return-to-training milestone until safe movement restored

**Auto-adjust vs confirmation**

- auto: regress progression, add monitoring, reduce load
- confirm: materially delay return target or redefine success around
  symptom-free baseline instead of return to training

**Recovery output focus**

- safety and tolerance over deadline pressure

## 4.5 General Conditioning

**Common drift signals**

- missed sessions repeatedly
- fatigue too high for routine adherence
- checkpoints show little improvement
- routine complexity causing drop-off

**Likely failure classes**

- consistency failure
- capacity mismatch
- unclear success definition
- readiness gap

**Default recovery levers**

- simplify routine
- reduce weekly session count while preserving consistency
- narrow success target to one conditioning benchmark
- add easier re-entry block

**Auto-adjust vs confirmation**

- auto: simplify routine, reduce density, add re-entry block
- confirm: lower final benchmark expectation materially

**Recovery output focus**

- recover consistency first, improvement second

---

# 5. JobSearchPipeline

## 5.1 Corporate Role Search

**Common drift signals**

- applications sent but no interviews
- resume not tailored in time
- company list weak or too small
- interview prep lags when traction appears

**Likely failure classes**

- conversion failure
- quality gap
- consistency failure
- scope overload

**Default recovery levers**

- improve resume/target fit
- narrow target roles/companies
- increase application volume if materials are strong enough
- add interview prep sprint when traction begins

**Auto-adjust vs confirmation**

- auto: tighten targeting, rebalance materials vs throughput
- confirm: broaden role family or lower deadline expectation for offer outcome

**Recovery output focus**

- restore response rate and interview readiness simultaneously

## 5.2 Remote Knowledge Work Search

**Common drift signals**

- weak callback rate
- remote profile credibility weak
- proof-of-work missing
- interviews not converting

**Likely failure classes**

- conversion failure
- quality gap
- readiness gap
- scope overload

**Default recovery levers**

- strengthen remote positioning
- add proof-of-work asset
- tighten target list
- add remote-interview prep block

**Auto-adjust vs confirmation**

- auto: improve profile and proof, shift schedule toward readiness assets
- confirm: broaden target scope or redefine success away from offer by fixed
  deadline

**Recovery output focus**

- increase credibility in remote hiring context

## 5.3 Creative Role Search

**Common drift signals**

- portfolio not resonating
- applications out but no interviews
- weak presentation or case-study explanations
- target employers poorly matched

**Likely failure classes**

- quality gap
- conversion failure
- readiness gap
- unclear success definition

**Default recovery levers**

- replace or refine weakest portfolio pieces
- tighten creative niche/role match
- add interview/presentation prep loop
- shift effort from volume to portfolio quality if needed

**Auto-adjust vs confirmation**

- auto: portfolio refinement and niche focus
- confirm: reduce target breadth or lower timeline expectation for role landed

**Recovery output focus**

- improve portfolio signal quality before increasing volume blindly

## 5.4 Skilled Trade Role Search

**Common drift signals**

- employer outreach weak
- proof packet incomplete or unconvincing
- geography too narrow
- job-readiness prep weak when interviews appear

**Likely failure classes**

- conversion failure
- quality gap
- resource gap
- scope overload

**Default recovery levers**

- improve proof/qualification packet
- widen local search radius if feasible
- increase outreach cadence
- add readiness prep block for interview/test scenarios

**Auto-adjust vs confirmation**

- auto: packet refinement, outreach increase, prep block insertion
- confirm: materially broaden geography or redefine deadline outcome

**Recovery output focus**

- improve trust and local opportunity volume

## 5.5 Career Transition Search

**Common drift signals**

- transition narrative not landing
- recruiters ignore materials
- bridge proof missing
- interviews expose weak transition story

**Likely failure classes**

- quality gap
- conversion failure
- readiness gap
- unclear success definition

**Default recovery levers**

- strengthen transferable-skill map and story bank
- add bridge proof/project if absent
- narrow transition target
- shift schedule from volume to reframing/credibility work

**Auto-adjust vs confirmation**

- auto: tighter target, stronger narrative, added proof output
- confirm: redefine target role family or timeline materially

**Recovery output focus**

- close the credibility gap before scaling search volume

---

# 6. CreativeProduction

## 6.1 TV / Series Writing

**Common drift signals**

- premise still weak late in process
- outlines incomplete
- drafting behind schedule
- continuity problems emerge across episodes/materials

**Likely failure classes**

- scope overload
- sequencing failure
- quality gap
- consistency failure

**Default recovery levers**

- reduce package scope to strongest pilot + season frame
- add structure/continuity review block
- cut nonessential worldbuilding outputs
- move from broad ideation back to drafting priority

**Auto-adjust vs confirmation**

- auto: insert structure pass, reduce optional outputs
- confirm: redefine success from season package to pilot-centric package

**Recovery output focus**

- preserve one coherent compelling package over broad incomplete scope

## 6.2 Podcast Production

**Common drift signals**

- concept/format not locked
- recording setup unresolved
- editing bottleneck delays batch
- first episodes not ready by launch window

**Likely failure classes**

- scope overload
- resource gap
- sequencing failure
- consistency failure

**Default recovery levers**

- reduce initial episode batch
- simplify production format
- separate setup from content creation explicitly
- prioritize trailer + first episode over larger season promise

**Auto-adjust vs confirmation**

- auto: smaller batch, simpler format, setup-first recovery block
- confirm: redefine launch from multi-episode batch to lighter initial release

**Recovery output focus**

- achieve credible launchable output, not overbuilt production ambition

## 6.3 Music Project Production

**Common drift signals**

- too many unfinished tracks
- recording backlog grows
- revision/polish loops prevent completion
- release assets not ready near deadline

**Likely failure classes**

- scope overload
- consistency failure
- quality gap
- resource gap

**Default recovery levers**

- cut weakest tracks
- lock track list earlier
- prioritize completion over over-polish
- simplify release package

**Auto-adjust vs confirmation**

- auto: reduce track scope, simplify packaging, shorten revision loops
- confirm: materially reduce project size or redefine completion standard

**Recovery output focus**

- get a finished release package, not a perpetual work-in-progress

## 6.4 Video Production

**Common drift signals**

- pre-production incomplete near shoot date
- production day under-resourced
- edit behind timeline
- missing critical footage

**Likely failure classes**

- sequencing failure
- resource gap
- scope overload
- quality gap

**Default recovery levers**

- simplify shot list
- cut nonessential scenes
- move to leaner production approach
- protect edit time by limiting reshoots to critical gaps

**Auto-adjust vs confirmation**

- auto: scene cuts, leaner production shift, edit-protection block
- confirm: downgrade final ambition or move delivery target materially

**Recovery output focus**

- deliver a coherent final cut rather than preserve every original production
  idea

## 6.5 Book / Longform Writing

**Common drift signals**

- draft pace too slow
- chapter structure drifting
- full draft far behind target
- revision impossible within remaining window

**Likely failure classes**

- scope overload
- consistency failure
- quality gap
- unclear success definition

**Default recovery levers**

- reduce chapter count or manuscript scope
- re-anchor to outline
- separate draft completion from revision ambition
- add chapter-cadence checkpoint

**Auto-adjust vs confirmation**

- auto: chapter pacing reset, outline re-anchor, revision deprioritization
- confirm: redefine target from revised manuscript to full draft completion

**Recovery output focus**

- finish a coherent draft before polishing beyond capacity

---

# 7. BrandLaunch

## 7.1 Personal Brand Launch

**Common drift signals**

- positioning unclear
- too many channels/assets planned
- content batch incomplete near launch
- visual identity and message mismatched

**Likely failure classes**

- unclear success definition
- scope overload
- quality gap
- consistency failure

**Default recovery levers**

- narrow channels to 1-2
- simplify visual system
- cut launch content quantity
- clarify audience/message first before more asset production

**Auto-adjust vs confirmation**

- auto: reduce asset/channel load, insert messaging clarification block
- confirm: materially reduce launch ambition from full rollout to positioning +
  core assets

**Recovery output focus**

- get a coherent visible brand presence, not maximal content volume

## 7.2 Business Brand Launch

**Common drift signals**

- offer and brand not aligned
- too many touchpoints being built
- website/collateral behind
- messaging still unstable near launch

**Likely failure classes**

- sequencing failure
- scope overload
- quality gap
- unclear success definition

**Default recovery levers**

- prioritize highest-value touchpoints only
- stabilize messaging before visual expansion
- simplify collateral scope
- align brand outputs to current offer reality

**Auto-adjust vs confirmation**

- auto: touchpoint prioritization, collateral reduction, messaging-first
  reordering
- confirm: lower launch scope materially or redefine success milestone

**Recovery output focus**

- make the brand usable for real business interactions first

## 7.3 Product Brand Launch

**Common drift signals**

- product readiness and brand outputs out of sync
- packaging behind
- campaign assets too broad
- value proposition unclear

**Likely failure classes**

- sequencing failure
- scope overload
- quality gap
- resource gap

**Default recovery levers**

- prioritize packaging and product-page essentials
- cut nonessential campaign assets
- sharpen product value proposition
- align brand timing to product readiness

**Auto-adjust vs confirmation**

- auto: asset prioritization, message tightening, campaign narrowing
- confirm: redefine launch from full campaign to minimal product-brand readiness

**Recovery output focus**

- preserve clear market-facing readiness over broad brand theatrics

## 7.4 Artist / Creator Brand Launch

**Common drift signals**

- aesthetic direction inconsistent
- media assets incomplete
- rollout channels overloaded
- intro content weak or unclear

**Likely failure classes**

- quality gap
- scope overload
- consistency failure
- unclear success definition

**Default recovery levers**

- narrow aesthetic direction
- reduce number of launch channels
- simplify intro content package
- prioritize strongest media assets only

**Auto-adjust vs confirmation**

- auto: reduce channels, simplify content, tighten aesthetic focus
- confirm: materially reduce launch presentation ambition

**Recovery output focus**

- create a coherent first impression, not a maximal media spread

## 7.5 Campaign Brand Launch

**Common drift signals**

- activation date approaching with asset backlog
- message/theme still unstable
- too many collateral types in scope
- rollout calendar unrealistic

**Likely failure classes**

- scope overload
- sequencing failure
- quality gap
- external timing disruption

**Default recovery levers**

- lock core theme and stop expanding concept
- cut collateral variety
- simplify rollout calendar to essential beats
- prioritize public activation essentials first

**Auto-adjust vs confirmation**

- auto: collateral reduction, rollout simplification, message lock
- confirm: redefine campaign launch from full activation to limited release

**Recovery output focus**

- hit campaign window with coherent essentials

---

# 8. SalesPipeline

## 8.1 B2B Service Sales

**Common drift signals**

- outreach sent but no replies
- calls booked but no qualified movement
- offer unclear in conversations
- pipeline tracker too thin or inconsistent

**Likely failure classes**

- conversion failure
- quality gap
- consistency failure
- unclear success definition

**Default recovery levers**

- tighten ICP
- revise outreach message
- sharpen offer statement
- raise outreach cadence if messaging and ICP are sound

**Auto-adjust vs confirmation**

- auto: ICP/message/offer refinement and cadence rebalance
- confirm: materially change sales target or timeline for closed revenue outcome

**Recovery output focus**

- improve signal quality before brute-force volume alone

## 8.2 B2C Product Sales

**Common drift signals**

- traffic but low conversion
- promotion live but weak demand
- customer confusion about offer
- sales assets incomplete or weak

**Likely failure classes**

- conversion failure
- quality gap
- scope overload
- resource gap

**Default recovery levers**

- improve sales page clarity
- simplify offer/promotion message
- shift channels toward higher-signal opportunities
- reduce campaign complexity

**Auto-adjust vs confirmation**

- auto: message and conversion-path fixes, channel shift
- confirm: materially lower sales target or redefine milestone to campaign
  readiness + initial conversions

**Recovery output focus**

- increase conversion efficiency before scaling spend/effort

## 8.3 High-Ticket Consultative Sales

**Common drift signals**

- interest but no proposals accepted
- low-quality conversations
- authority/proof weak
- sales cycle stalls late

**Likely failure classes**

- conversion failure
- quality gap
- readiness gap
- unclear success definition

**Default recovery levers**

- strengthen authority/proof assets
- tighten qualification
- improve proposal framing
- add structured follow-up cadence

**Auto-adjust vs confirmation**

- auto: qualification/proposal/proof improvements
- confirm: materially lower close target or shift outcome to proposal-stage
  progress

**Recovery output focus**

- improve trust and fit, not just more conversations

## 8.4 Retail / Local Offer Sales

**Common drift signals**

- promotion generates weak foot traffic or inquiries
- inquiries do not convert
- local channel mix poor
- service handling process causes drop-off

**Likely failure classes**

- conversion failure
- quality gap
- sequencing failure
- resource gap

**Default recovery levers**

- shift to better local channel
- tighten local offer/message
- improve customer handling process
- simplify promotion assets to faster feedback loop

**Auto-adjust vs confirmation**

- auto: channel and process adjustment
- confirm: redefine target geography or materially reduce local sales target

**Recovery output focus**

- create repeatable local demand/conversion loop

## 8.5 Subscription / Recurring Revenue Sales

**Common drift signals**

- signups low
- onboarding path leaks conversions
- initial customers not retaining
- recurring value proposition unclear

**Likely failure classes**

- conversion failure
- quality gap
- resource gap
- unclear success definition

**Default recovery levers**

- simplify onboarding path
- sharpen recurring value proposition
- slow acquisition push until conversion path improves
- add retention checkpoint after first conversions

**Auto-adjust vs confirmation**

- auto: conversion-path and onboarding improvements, retention checkpoint
- confirm: lower subscriber target or shift milestone to first retained cohort
  rather than raw signup count

**Recovery output focus**

- preserve recurring economics, not vanity signups

---

# 9. Fundraising

## 9.1 Friends and Family Raise

**Common drift signals**

- outreach conversations not started
- ask materials unclear
- commitments verbal but not closing
- target list too weak or too small

**Likely failure classes**

- conversion failure
- quality gap
- consistency failure
- unclear success definition

**Default recovery levers**

- simplify ask materials
- prioritize highest-trust prospects first
- clarify ask structure/terms
- add explicit follow-up close block

**Auto-adjust vs confirmation**

- auto: tighten list and ask flow, add close follow-up
- confirm: lower raise target or redefine success from funds collected to
  commitments secured

**Recovery output focus**

- move from vague support conversations to clear commitments

## 9.2 Angel Raise

**Common drift signals**

- weak meeting booking rate
- deck/story not resonating
- investor list low-fit
- traction not packaged clearly

**Likely failure classes**

- conversion failure
- quality gap
- readiness gap
- scope overload

**Default recovery levers**

- improve narrative/deck clarity
- tighten angel target profile
- add traction-proof packaging
- focus outreach on higher-fit investors first

**Auto-adjust vs confirmation**

- auto: list refinement, deck revision, traction packaging
- confirm: lower deadline expectation for commitments or redefine milestone to
  active meeting pipeline

**Recovery output focus**

- improve resonance and fit before scaling outreach volume

## 9.3 Seed Round Raise

**Common drift signals**

- institutional conversations not progressing
- diligence materials weak or missing
- investor map too broad or low-fit
- thesis/deck not landing

**Likely failure classes**

- conversion failure
- quality gap
- readiness gap
- sequencing failure

**Default recovery levers**

- improve fundraising thesis/deck
- strengthen diligence package
- tighten investor targeting
- separate outreach and diligence recovery blocks

**Auto-adjust vs confirmation**

- auto: narrative/diligence refinement and target tightening
- confirm: materially lower round timing ambition or redefine success to active
  diligence stage

**Recovery output focus**

- restore institutional credibility and process readiness

## 9.4 Grant / Non-Dilutive Funding

**Common drift signals**

- low-fit opportunities consuming time
- deadlines clustering too tightly
- application materials incomplete
- submissions weak or delayed

**Likely failure classes**

- scope overload
- sequencing failure
- quality gap
- external timing disruption

**Default recovery levers**

- drop low-fit applications
- prioritize nearest/highest-value deadlines
- build reusable materials packet
- separate research from submission sprint

**Auto-adjust vs confirmation**

- auto: priority triage, reusable packet creation, deadline-first ordering
- confirm: reduce opportunity count materially or redefine target to fewer
  high-fit submissions

**Recovery output focus**

- maximize submission quality on strongest opportunities

## 9.5 Sponsorship / Partnership Raise

**Common drift signals**

- weak partner interest
- sponsorship package unclear
- proposals not advancing
- target list poor-fit

**Likely failure classes**

- conversion failure
- quality gap
- readiness gap
- unclear success definition

**Default recovery levers**

- sharpen value proposition for partners
- tighten target list to better-fit brands/partners
- simplify sponsorship package/tiers
- add proposal follow-up and negotiation checkpoint

**Auto-adjust vs confirmation**

- auto: package simplification, list tightening, follow-up sequence
- confirm: redefine success from closed sponsorship to active proposal-stage
  traction

**Recovery output focus**

- improve mutual-fit clarity and proposal movement

---

## 1.0 Product Behavior Rule

When drift is detected, Jericho should:

1. identify the lane
2. detect the drift signal(s)
3. classify likely failure class
4. map to default recovery lever(s)
5. determine whether confirmation is required
6. show recovery output with tradeoff and updated plan implications

## 1.0 Freeze Scope Note

This matrix makes course correction part of the bounded 1.0 system claim. It
does not mean Jericho solves every possible recovery scenario. It means the
system has a finite, lane-specific recovery grammar for the validated 45-lane
surface.

## Next Step

The next implementation layer after this spec is:

- deterministic drift-signal detector
- failure-class mapper
- recovery recommendation engine
- canonical recovery payload in Stability
- recovery scorecard dimension upgrade from static grammar to live closed-loop
  behavior
