# Jericho Canonical 1.0 Archetype–Subtype Test Spec

## Purpose

This document formalizes the bounded 1.0 execution-validation surface for
Jericho.

The system claim for 1.0 is not that it can handle every possible goal. The
system claim is that it can reliably process properly formatted goals through a
finite, validated archetype–subtype matrix into:

- top-level outputs
- action families
- schedule structure
- progress tracking
- correction logic

This artifact locks the 1.0 surface at:

- 9 archetypes
- 5 subtypes per archetype
- 45 subtype lanes total

Anything outside this matrix is outside 1.0 claim scope and may be treated as
fallback or unresolved classification.

## Canonical 1.0 Archetypes

1. VentureLaunch
2. SkillAcquisition
3. ProfessionalQualification
4. PhysicalTraining
5. JobSearchPipeline
6. CreativeProduction
7. BrandLaunch
8. SalesPipeline
9. Fundraising

## Spec Fields Per Lane

Each lane is defined by:

- Representative test goal
- Expected top-level outputs
- Expected action families
- Expected minimum schedule shape
- Expected correction triggers

---

# 1. VentureLaunch

## 1.1 SaaS Product Launch

**Representative test goal** Launch a task-tracking SaaS MVP within 60 days with
core feature set, landing page, pricing, and first 20 beta users ready.

**Expected top-level outputs**

- product concept and target user defined
- MVP feature scope finalized
- MVP built and usable
- landing page completed
- pricing/offer completed
- beta onboarding flow completed
- first beta user acquisition setup completed

**Expected action families**

- user/problem definition
- feature scoping
- product build and debugging
- landing page/copy creation
- pricing decisions
- onboarding setup
- beta outreach/testing

**Expected minimum schedule shape**

- early concept/scope blocks
- recurring build blocks across multiple weeks
- at least one testing/review block before launch
- launch-prep block near deadline
- beta outreach blocks after MVP readiness

**Expected correction triggers**

- build lag forces scope reduction
- usability issues force more testing
- no beta traction forces outreach/channel revision
- pricing confusion forces offer simplification

## 1.2 Consumer Product Launch

**Representative test goal** Launch a caffeinated gum product in 75 days with
product sample approved, packaging ready, product page live, and first sales
campaign prepared.

**Expected top-level outputs**

- product spec finalized
- sample/prototype approved
- packaging assets completed
- pricing completed
- product page/listing completed
- inventory readiness confirmed
- launch campaign assets completed

**Expected action families**

- product design/specification
- sourcing/vendor communication
- packaging development
- photography/mockups
- copywriting/listing setup
- pricing work
- campaign preparation

**Expected minimum schedule shape**

- upfront product/spec and sourcing block
- prototype review checkpoint
- asset/listing block after sample approval
- launch campaign block near release

**Expected correction triggers**

- sample rejection forces product iteration
- supplier delay forces launch adjustment
- packaging delay forces scope simplification
- weak conversion setup forces page/copy revision

## 1.3 Service Business Launch

**Representative test goal** Launch a project management consulting service in
30 days with offer, pricing, onboarding materials, and first 15 prospect
outreaches completed.

**Expected top-level outputs**

- service offer defined
- pricing/package completed
- onboarding materials completed
- delivery process documented
- prospect list completed
- outreach script completed
- first outreach batch completed

**Expected action families**

- offer design
- pricing strategy
- process documentation
- onboarding asset creation
- lead targeting
- outreach drafting/sending
- consultation prep

**Expected minimum schedule shape**

- front-loaded offer and pricing block
- materials/process block in middle
- recurring outreach blocks near end of window
- follow-up/admin blocks once outreach starts

**Expected correction triggers**

- weak response rate forces offer/message revision
- client confusion forces onboarding/process clarification
- too-broad targeting forces niche narrowing
- no conversations forces higher outreach volume

## 1.4 Marketplace Launch

**Representative test goal** Launch a local freelancer marketplace in 90 days
with service categories defined, first 10 providers onboarded, first customer
campaign live, and matching flow working.

**Expected top-level outputs**

- marketplace model defined
- service/provider criteria completed
- customer value proposition completed
- onboarding flow completed
- matching workflow completed
- first provider cohort onboarded
- first customer acquisition campaign launched

**Expected action families**

- marketplace design
- supply-side recruiting
- demand-side targeting
- workflow/process design
- onboarding creation
- activation outreach
- liquidity testing

**Expected minimum schedule shape**

- dual-track supply and demand workstreams
- onboarding blocks before activation
- concentrated activation period near launch
- monitoring blocks after first matches

**Expected correction triggers**

- supply shortage forces provider-side focus
- demand weakness forces campaign adjustment
- poor matching experience forces workflow revision
- two-sided activation overload forces narrower niche

## 1.5 Local Business Launch

**Representative test goal** Launch a local mobile detailing business in 45 days
with offer, booking process, local marketing assets, and first 10 customer leads
generated.

**Expected top-level outputs**

- local offer defined
- booking/service process completed
- service-area readiness confirmed
- local marketing assets completed
- local profiles/listings completed
- first promotion campaign completed
- first lead pipeline generated

**Expected action families**

- offer design
- service logistics/process setup
- local listing creation
- flyer/social/local promo creation
- local outreach
- customer handling
- booking workflow setup

**Expected minimum schedule shape**

- setup blocks early
- local asset setup before demand push
- campaign bursts in later phase
- lead response windows once inquiries start

**Expected correction triggers**

- weak local response forces messaging or channel change
- operational friction forces booking/process simplification
- poor service-area fit forces geographic narrowing
- low conversion forces offer refinement

---

# 2. SkillAcquisition

## 2.1 Software Skill Acquisition

**Representative test goal** Learn React well enough in 45 days to build and
publish two working portfolio projects.

**Expected top-level outputs**

- learning roadmap completed
- environment setup completed
- fundamentals review completed
- practice exercises completed
- first working project completed
- second polished project completed
- portfolio/demo package completed

**Expected action families**

- concept study
- coding drills
- environment/tool setup
- project building
- debugging
- documentation
- deployment/publishing

**Expected minimum schedule shape**

- study/setup block at the front
- recurring practice sessions several times per week
- longer build blocks for projects
- review/debugging blocks after project attempts

**Expected correction triggers**

- concept confusion forces targeted review
- build blockage forces smaller project scope
- low retention forces more repetition
- time slippage forces one-project fallback or feature reduction

## 2.2 Design Skill Acquisition

**Representative test goal** Learn Figma in 30 days well enough to create three
polished mobile app mockup sets for a portfolio.

**Expected top-level outputs**

- design roadmap completed
- tool fluency exercises completed
- reference board completed
- first mockup set completed
- second mockup set completed
- third polished mockup set completed
- critique/revision pass completed

**Expected action families**

- principle study
- tool practice
- reference analysis
- layout/visual exercises
- critique review
- revision/polish
- portfolio curation

**Expected minimum schedule shape**

- early principles and tool blocks
- alternating practice and creation sessions
- critique/revision blocks after output sets
- final polish block near end

**Expected correction triggers**

- weak output quality forces narrower visual scope
- tool friction forces extra practice
- weak portfolio cohesion forces sample replacement
- slow progress forces fewer but stronger output sets

## 2.3 Communication Skill Acquisition

**Representative test goal** Improve public speaking in 21 days by completing
daily speaking drills, three recorded practice talks, and one final polished
presentation.

**Expected top-level outputs**

- communication baseline completed
- drill set completed
- first recorded talk completed
- feedback review completed
- second revised talk completed
- third polished talk completed
- final presentation completed

**Expected action families**

- drills
- scripting/outlining
- recording/performance
- playback review
- feedback analysis
- revision/rehearsal

**Expected minimum schedule shape**

- frequent short daily practice blocks
- repeated record-review-revise cycles
- longer rehearsal block before final presentation

**Expected correction triggers**

- weak clarity/confidence forces more reps
- theory overload forces more performance practice
- poor improvement trend forces tighter skill focus
- deadline pressure forces one fewer intermediate sample

## 2.4 Technical Trade Skill Acquisition

**Representative test goal** Learn the fundamentals of HVAC maintenance in 60
days well enough to complete five core diagnostic and maintenance procedures
independently.

**Expected top-level outputs**

- safety/procedure review completed
- core task checklist completed
- guided practice set completed
- first independent procedure completed
- remaining independent procedures completed
- performance log completed
- readiness evaluation completed

**Expected action families**

- procedural study
- safety review
- guided reps
- independent reps
- checklist use
- correction practice
- logging/verification

**Expected minimum schedule shape**

- early safety/procedure blocks
- repeated hands-on practice sessions
- review/evaluation checkpoints after rep clusters
- final competency verification block

**Expected correction triggers**

- repeated errors force more guided reps
- safety gaps force skill-scope reduction
- inconsistency forces better checklist/logging discipline
- time compression forces focus on highest-value procedures only

## 2.5 Creative Skill Acquisition

**Representative test goal** Improve songwriting in 45 days by completing
technique study, eight writing exercises, and three finished song drafts.

**Expected top-level outputs**

- technique study set completed
- inspiration/reference set completed
- writing exercise series completed
- first song draft completed
- second song draft completed
- third improved song draft completed
- mini-portfolio set completed

**Expected action families**

- study
- inspiration/reference gathering
- exercises
- drafting
- critique/review
- revision
- curation

**Expected minimum schedule shape**

- study and exercise blocks early
- recurring creation sessions
- review/revision loops after drafts
- final curation block near end

**Expected correction triggers**

- too much practice with no finished work forces output emphasis
- weak drafts force narrower technique focus
- stalled creativity forces prompt/reference intervention
- time pressure forces fewer but stronger finished pieces

---

# 3. ProfessionalQualification

## 3.1 Certification Exam

**Representative test goal** Pass the AWS Certified Cloud Practitioner exam by
May 15 with all domain review, three practice exams, and final review completed
beforehand.

**Expected top-level outputs**

- exam target date set
- study plan completed
- domain review notes completed
- practice exam set completed
- weak-domain remediation completed
- final review pack completed
- exam passed or attempt completed

**Expected action families**

- study/review
- note-making
- quizzes
- practice exams
- score analysis
- targeted remediation
- final review

**Expected minimum schedule shape**

- recurring study sessions throughout
- periodic full practice-test blocks
- concentrated remediation before exam
- final review/taper block near exam date

**Expected correction triggers**

- low practice scores force remediation shift
- exam readiness too low forces date reassessment
- weak domains force time reallocation
- poor retention forces repetition and reduced breadth

## 3.2 Licensure Exam

**Representative test goal** Prepare for and pass the real estate licensing exam
within 90 days with registration, required study coverage, practice testing, and
final readiness completed.

**Expected top-level outputs**

- licensure requirements verified
- registration completed
- study coverage completed
- practice testing completed
- readiness threshold achieved
- final review completed
- exam taken/passed

**Expected action families**

- requirements/admin handling
- study
- note review
- practice testing
- remediation
- scheduling/logistics

**Expected minimum schedule shape**

- early admin and registration block
- long study phase
- recurring practice-test blocks
- readiness and final review block near exam

**Expected correction triggers**

- paperwork delay forces earlier admin prioritization
- low readiness forces attempt delay or focus shift
- weak domains force narrower review
- overbreadth forces more selective coverage

## 3.3 Compliance Training Completion

**Representative test goal** Complete all OSHA onboarding and compliance modules
within 14 days with all assessments passed and required documentation submitted.

**Expected top-level outputs**

- compliance requirements list completed
- training access/materials setup completed
- required modules completed
- assessments passed
- documentation submitted
- compliance confirmation received

**Expected action families**

- module completion
- quiz/assessment work
- note review
- document handling
- submission/follow-up

**Expected minimum schedule shape**

- modular completion blocks in sequence
- assessment blocks immediately after content
- final admin/submission block

**Expected correction triggers**

- failed assessments force module review/repeat
- missing documentation forces immediate admin action
- compressed time forces mandatory module prioritization
- access issues force setup escalation

## 3.4 Portfolio-Based Qualification

**Representative test goal** Assemble a UX portfolio submission within 45 days
with three polished case studies, supporting documentation, and final package
review completed.

**Expected top-level outputs**

- criteria checklist completed
- portfolio scope selected
- case study set completed
- supporting documents completed
- portfolio organization completed
- final submission package completed
- submission delivered

**Expected action families**

- criteria review
- case study creation/refinement
- documentation writing
- organization/formatting
- review
- submission prep

**Expected minimum schedule shape**

- criteria/scope block early
- repeated creation/refinement blocks
- packaging/review block near end
- final submission/admin block

**Expected correction triggers**

- weak sample quality forces sample replacement
- too many pieces force scope reduction
- documentation weakness forces clarity pass
- deadline compression forces polish prioritization

## 3.5 Interview-Based Qualification

**Representative test goal** Prepare for a graduate program interview in 21 days
with likely questions, mock interviews, and final response refinement completed.

**Expected top-level outputs**

- qualification criteria reviewed
- core materials completed
- likely question bank completed
- response frameworks completed
- mock interview completed
- revision pass completed
- final interview readiness completed

**Expected action families**

- research
- answer framework drafting
- mock interviewing
- feedback review
- revision
- rehearsal/logistics

**Expected minimum schedule shape**

- early research and question-mapping blocks
- repeated mock/revision loops
- lighter final review before interview

**Expected correction triggers**

- vague answers force story/example strengthening
- low confidence forces more mock pressure
- weak program knowledge forces research boost
- overlong responses force tightening

---

# 4. PhysicalTraining

## 4.1 Strength Program

**Representative test goal** Increase squat and bench strength over 12 weeks
with program structure, benchmark testing, and final reassessment completed.

**Expected top-level outputs**

- baseline assessment completed
- training program completed
- training block 1 completed
- benchmark lift test completed
- training block 2 completed
- deload/recovery review completed
- final reassessment completed

**Expected action families**

- lifting sessions
- accessory work
- mobility
- recovery
- logging
- benchmark testing

**Expected minimum schedule shape**

- recurring weekly lift sessions
- periodic benchmark/testing weeks
- at least one deload/recovery block
- final reassessment block

**Expected correction triggers**

- recovery problems force load/volume reduction
- stalled lifts force progression change
- pain issues force exercise modification
- missed sessions force block extension or scope adjustment

## 4.2 Endurance Performance

**Representative test goal** Run a 5K in under 30 minutes within 8 weeks with
base conditioning, speed benchmarks, and final race test completed.

**Expected top-level outputs**

- baseline assessment completed
- training plan completed
- base block completed
- pace benchmark completed
- long effort benchmark completed
- taper completed
- event/test completed

**Expected action families**

- easy conditioning sessions
- speed/interval work
- tempo/pace sessions
- long efforts
- recovery
- test/logging

**Expected minimum schedule shape**

- recurring weekly cardio sessions
- periodic benchmark sessions
- taper block before final test
- final event block

**Expected correction triggers**

- poor recovery forces intensity reduction
- pace gap forces goal adjustment or base extension
- missed volume forces progression recalibration
- pain/fatigue forces workload redistribution

## 4.3 Weight Loss / Body Composition

**Representative test goal** Lose 15 pounds by July 1 with training adherence,
weekly check-ins, mid-phase adjustment, and final review completed.

**Expected top-level outputs**

- baseline measurements completed
- nutrition/training structure completed
- adherence system completed
- first checkpoint review completed
- mid-phase adjustment completed
- target-state checkpoint achieved or approached
- final progress review completed

**Expected action families**

- training sessions
- meal planning/prep
- tracking/logging
- weigh-ins/check-ins
- adjustment review
- recovery

**Expected minimum schedule shape**

- recurring weekly training blocks
- daily or near-daily adherence actions
- weekly measurement/review checkpoints
- one or more formal adjustment blocks

**Expected correction triggers**

- flat trend forces calorie/activity adjustment
- low adherence forces simplification
- fatigue forces recovery emphasis
- unrealistic pace forces target recalibration

## 4.4 Rehab Return to Training

**Representative test goal** Return to lifting safely after knee rehab within 10
weeks with movement restoration, readiness checkpoints, modified training block,
and full reassessment completed.

**Expected top-level outputs**

- limitation assessment completed
- rehab protocol completed
- pain-free movement checkpoint completed
- progressive load reintroduction completed
- return-to-training readiness checkpoint completed
- modified training block completed
- final reassessment completed

**Expected action families**

- rehab work
- mobility
- low-load strengthening
- symptom logging
- readiness testing
- modified training sessions

**Expected minimum schedule shape**

- frequent short rehab blocks
- repeated readiness checkpoints
- cautious progression blocks
- modified training block before full return

**Expected correction triggers**

- symptom flare-up forces regression
- readiness failure forces more prep time
- load intolerance forces slower progression
- inconsistency forces tighter monitoring

## 4.5 General Conditioning

**Representative test goal** Improve general fitness in 6 weeks with balanced
routine adherence, weekly conditioning sessions, checkpoint tests, and final
benchmark completed.

**Expected top-level outputs**

- baseline assessment completed
- balanced routine completed
- first consistency block completed
- first capacity checkpoint completed
- second consistency block completed
- general fitness benchmark completed
- final review completed

**Expected action families**

- cardio
- strength/bodyweight work
- mobility
- recovery
- habit tracking
- checkpoint testing

**Expected minimum schedule shape**

- recurring balanced sessions each week
- at least two consistency blocks
- one or more checkpoint tests
- final benchmark block

**Expected correction triggers**

- poor adherence forces routine simplification
- excess fatigue forces intensity reduction
- no measurable progress forces emphasis shift
- overcomplex program forces streamlining

---

# 5. JobSearchPipeline

## 5.1 Corporate Role Search

**Representative test goal** Land a corporate project coordinator role within 60
days with tailored resume, target company list, first 20 applications, and
interview prep completed.

**Expected top-level outputs**

- target role criteria completed
- master resume updated
- tailored resume completed
- target company list completed
- application tracker completed
- first application batch submitted
- interview prep packet completed

**Expected action families**

- role/company research
- resume editing
- list building
- application submission
- outreach/networking
- interview prep
- follow-up

**Expected minimum schedule shape**

- front-loaded materials/setup block
- recurring application blocks
- recurring follow-up blocks
- prep blocks when interviews arise

**Expected correction triggers**

- weak response rate forces resume revision
- poor fit forces target-role narrowing
- low application volume forces higher throughput
- stalled interviews force interview-prep adjustment

## 5.2 Remote Knowledge Work Search

**Representative test goal** Land a remote operations role within 75 days with
remote-ready positioning, first 25 applications, and remote interview readiness
completed.

**Expected top-level outputs**

- remote role criteria completed
- remote-ready resume/profile completed
- proof-of-work or portfolio completed if needed
- target company list completed
- application pipeline launched
- remote interview prep completed
- follow-up system completed

**Expected action families**

- positioning/profile updates
- remote company research
- applications
- networking/outreach
- interview prep
- async communication prep
- follow-up

**Expected minimum schedule shape**

- setup and positioning sprint early
- recurring application and outreach blocks
- interview-prep blocks around traction
- follow-up rhythm after submissions

**Expected correction triggers**

- low callback rate forces positioning changes
- credibility gap forces proof-of-work addition
- poor fit forces target-market revision
- interview issues force remote-specific prep improvement

## 5.3 Creative Role Search

**Representative test goal** Land a junior designer role within 60 days with
portfolio curation, targeted applications, and presentation/interview readiness
completed.

**Expected top-level outputs**

- target role criteria completed
- portfolio curated
- creative resume/materials completed
- target employer list completed
- application/outreach batch completed
- presentation/interview prep completed
- follow-up sequence completed

**Expected action families**

- portfolio curation
- materials editing
- employer research
- outreach/applications
- presentation prep
- interview prep
- follow-up

**Expected minimum schedule shape**

- heavy early portfolio block
- recurring application/outreach sessions
- presentation prep blocks after traction begins

**Expected correction triggers**

- weak portfolio quality forces sample replacement
- unclear niche forces target tightening
- poor interviews force presentation/story refinement
- low traction forces materials revision

## 5.4 Skilled Trade Role Search

**Representative test goal** Secure an entry HVAC technician role within 45 days
with qualification proof, employer list, first outreach batch, and
interview/job-readiness completed.

**Expected top-level outputs**

- role criteria completed
- qualification proof packet completed
- resume/application materials completed
- employer list completed
- outreach/application batch completed
- interview/job-readiness prep completed
- follow-up log completed

**Expected action families**

- documentation gathering
- material prep
- employer research
- outreach/application
- readiness review
- follow-up

**Expected minimum schedule shape**

- proof/material gathering block early
- local outreach/application waves
- rapid follow-up windows
- prep block before interviews

**Expected correction triggers**

- weak credibility proof forces packet improvement
- small lead pool forces geography widening
- low response forces higher outreach intensity
- readiness gaps force targeted prep

## 5.5 Career Transition Search

**Representative test goal** Transition from warehouse operations into project
coordination within 90 days with transferable-skills narrative, targeted
applications, and interview story bank completed.

**Expected top-level outputs**

- transition target clarified
- transferable skill map completed
- transition resume/narrative completed
- target company list completed
- application pipeline launched
- story bank completed
- transition interview prep completed

**Expected action families**

- self-assessment
- skill mapping
- resume reframing
- target research
- applications/networking
- interview prep
- follow-up

**Expected minimum schedule shape**

- heavy early reframing work
- recurring application/networking sessions
- interview prep block after traction begins

**Expected correction triggers**

- weak recruiter response forces better skill translation
- transition scope too broad forces target narrowing
- credibility gap forces proof-project or bridge asset creation
- interview weakness forces story/example refinement

---

# 6. CreativeProduction

## 6.1 TV / Series Writing

**Representative test goal** Develop a scripted TV pilot package in 90 days with
premise, series bible, season arc, episode outlines, and pilot draft completed.

**Expected top-level outputs**

- premise/logline completed
- series bible completed
- season arc completed
- episode outlines completed
- pilot draft completed
- continuity pass completed
- final package completed

**Expected action families**

- premise/worldbuilding
- outlining
- character development
- drafting
- revision
- continuity review

**Expected minimum schedule shape**

- early concept and structure blocks
- recurring drafting sessions
- revision and continuity block near end

**Expected correction triggers**

- diffuse concept forces premise tightening
- slow drafting forces scope reduction
- continuity issues force structural revision
- weak characters force focused character pass

## 6.2 Podcast Production

**Representative test goal** Launch a 10-episode podcast season in 60 days with
show concept, format, recording setup, first 3 episodes recorded, and publishing
package completed.

**Expected top-level outputs**

- show concept completed
- format/episode structure completed
- episode slate completed
- basic show assets completed
- recording setup completed
- first batch recorded
- publishing package completed

**Expected action families**

- concept development
- format planning
- episode outlining
- setup/equipment work
- recording
- editing
- publishing prep

**Expected minimum schedule shape**

- concept/setup blocks early
- recurring recording/editing sessions
- packaging block near launch

**Expected correction triggers**

- production load too high forces format simplification
- editing bottleneck forces smaller launch batch
- weak concept coherence forces format refinement
- setup friction forces technical simplification

## 6.3 Music Project Production

**Representative test goal** Complete a 5-song EP in 75 days with track list,
draft songs, recording, cover art, and release-ready package completed.

**Expected top-level outputs**

- project concept completed
- track list completed
- song draft set completed
- recording sessions completed
- mix/revision pass completed
- cover/package assets completed
- release-ready package completed

**Expected action families**

- concept and track planning
- songwriting
- recording
- editing/production
- mix/review
- artwork/release prep

**Expected minimum schedule shape**

- concept and songwriting block early
- clustered recording sessions
- revision/mix phase later
- packaging sprint near end

**Expected correction triggers**

- weak songs force track reduction
- slow recording forces narrower scope
- excessive polish loops force completion prioritization
- packaging delays force minimal release package

## 6.4 Video Production

**Representative test goal** Produce a branded short video in 30 days with
concept, script, shot plan, filmed footage, edit, and final delivery completed.

**Expected top-level outputs**

- concept completed
- script/treatment completed
- shot plan completed
- production logistics completed
- footage captured
- first edit completed
- final video delivered

**Expected action families**

- concepting
- script/treatment writing
- shot planning
- production logistics
- filming
- editing
- review/revision

**Expected minimum schedule shape**

- front-loaded pre-production block
- one or more concentrated shoot days
- later editing blocks
- final review/export block

**Expected correction triggers**

- over-ambitious shot plan forces simplification
- production delays force scene cuts
- edit overrun forces tighter final cut
- missing footage forces critical-only reshoot

## 6.5 Book / Longform Writing

**Representative test goal** Write a 30,000-word nonfiction manuscript draft in
120 days with outline, chapter drafts, revision pass, and final manuscript
package completed.

**Expected top-level outputs**

- concept and scope completed
- chapter outline completed
- chapter draft sequence completed
- full draft completed
- revision pass completed
- manuscript clean-up completed
- final manuscript package completed

**Expected action families**

- outlining
- research
- drafting
- revision
- proofreading
- organization/packaging

**Expected minimum schedule shape**

- outline block early
- recurring drafting sessions over many weeks
- later revision/proof blocks
- final packaging block

**Expected correction triggers**

- draft pace too slow forces chapter-scope reduction
- structure drift forces outline revision
- weak coherence forces extra revision pass
- deadline pressure forces draft-first, polish-later strategy

---

# 7. BrandLaunch

## 7.1 Personal Brand Launch

**Representative test goal** Launch a personal brand in 30 days with
positioning, identity basics, profile assets, content pillars, and first 10
launch posts completed.

**Expected top-level outputs**

- positioning completed
- personal narrative completed
- visual identity basics completed
- profile/platform assets completed
- content pillars completed
- launch content batch completed
- public rollout completed

**Expected action families**

- positioning work
- narrative writing
- design
- profile setup
- content creation
- publishing

**Expected minimum schedule shape**

- front-loaded positioning/narrative block
- asset creation block
- coordinated content/publishing block near end

**Expected correction triggers**

- muddy message forces audience narrowing
- identity execution overload forces simpler visuals
- content burden forces reduced launch batch
- weak coherence forces narrative tightening

## 7.2 Business Brand Launch

**Representative test goal** Launch a consulting business brand in 45 days with
strategy, messaging, visual identity, website basics, and launch collateral
completed.

**Expected top-level outputs**

- brand strategy completed
- messaging framework completed
- visual identity completed
- website/core touchpoints completed
- launch collateral completed
- launch content/assets completed
- brand rollout completed

**Expected action families**

- strategy
- messaging/copywriting
- design
- website setup
- collateral creation
- launch content production

**Expected minimum schedule shape**

- strategy and messaging block early
- design/system block mid-phase
- collateral and launch-assets sprint near end

**Expected correction triggers**

- unclear strategy forces message reset
- too many assets force prioritization
- weak touchpoints force focus on high-visibility channels
- deadline pressure forces minimal viable brand system

## 7.3 Product Brand Launch

**Representative test goal** Launch the brand for a new beverage product in 60
days with product positioning, packaging identity, product page assets, and
launch campaign materials completed.

**Expected top-level outputs**

- product positioning completed
- product brand narrative completed
- packaging/visual system completed
- product page/assets completed
- launch collateral completed
- campaign content completed
- brand launch executed

**Expected action families**

- positioning
- naming/copy
- packaging design
- product-page setup
- campaign asset creation
- launch prep

**Expected minimum schedule shape**

- strategy block first
- packaging/product-page work next
- campaign and launch-prep block near release

**Expected correction triggers**

- weak value proposition forces positioning revision
- packaging delay forces simplified asset plan
- too many campaign assets force narrower scope
- low clarity forces message simplification

## 7.4 Artist / Creator Brand Launch

**Representative test goal** Launch an artist brand in 45 days with identity
narrative, aesthetic system, profile refresh, media assets, and introduction
content batch completed.

**Expected top-level outputs**

- artist identity defined
- narrative/aesthetic system completed
- visual/media assets completed
- channel/profile rollout completed
- launch content batch completed
- introduction package completed
- brand rollout executed

**Expected action families**

- identity work
- narrative writing
- design/photo/video asset creation
- profile updates
- content creation
- publishing

**Expected minimum schedule shape**

- identity and aesthetic block early
- media asset creation block mid-phase
- introduction/rollout block near launch

**Expected correction triggers**

- inconsistent aesthetic forces narrowing
- too many channels force channel reduction
- weak intro content forces clearer narrative packaging
- asset shortfall forces minimal rollout kit

## 7.5 Campaign Brand Launch

**Representative test goal** Launch a summer campaign identity in 21 days with
campaign theme, visual kit, collateral, rollout calendar, and first content
batch completed.

**Expected top-level outputs**

- campaign theme completed
- campaign messaging completed
- campaign visual kit completed
- collateral completed
- rollout calendar completed
- launch content batch completed
- campaign launched

**Expected action families**

- campaign strategy
- writing
- design
- collateral production
- scheduling
- content publishing

**Expected minimum schedule shape**

- compressed strategy phase
- concentrated asset build phase
- timed rollout window near deadline

**Expected correction triggers**

- diffuse message forces theme simplification
- asset overload forces collateral reduction
- timeline compression forces focus on core campaign assets only
- weak channel fit forces rollout adjustment

---

# 8. SalesPipeline

## 8.1 B2B Service Sales

**Representative test goal** Generate the first 5 qualified consulting sales
calls in 30 days with offer definition, ICP list, outreach messaging, and first
50 outreaches completed.

**Expected top-level outputs**

- offer defined
- ICP criteria completed
- prospect list completed
- outreach messaging completed
- pipeline tracker completed
- first outreach batch completed
- first qualified calls/proposals completed

**Expected action families**

- offer refinement
- ICP research
- list building
- outreach
- qualification
- discovery calls
- proposal follow-up

**Expected minimum schedule shape**

- setup sprint early
- recurring outreach blocks
- follow-up/admin windows
- call blocks as responses come in

**Expected correction triggers**

- low reply rate forces messaging change
- poor fit forces ICP tightening
- weak call conversion forces qualification refinement
- too-thin pipeline forces more outbound volume

## 8.2 B2C Product Sales

**Representative test goal** Generate the first 50 online sales of a consumer
product in 45 days with product page, conversion assets, first campaign launch,
and sales tracking completed.

**Expected top-level outputs**

- offer/page completed
- audience target defined
- conversion assets completed
- sales channel setup completed
- first promotion batch completed
- sales tracking setup completed
- first conversion wave completed

**Expected action families**

- page/copy work
- asset creation
- audience research
- promotion/campaign launch
- sales monitoring
- customer response handling

**Expected minimum schedule shape**

- setup phase early
- promotional bursts later
- recurring monitoring/optimization blocks once live

**Expected correction triggers**

- poor conversion forces page/offer revision
- weak traffic forces channel adjustment
- customer confusion forces clearer messaging
- tracking gaps force instrumentation fixes

## 8.3 High-Ticket Consultative Sales

**Representative test goal** Close one $5,000 consulting engagement in 45 days
with authority assets, target list, outreach sequence, and first three proposals
completed.

**Expected top-level outputs**

- premium offer defined
- buyer criteria completed
- authority/proof assets completed
- outreach strategy completed
- first qualified conversations completed
- proposal framework completed
- close-stage follow-up system completed

**Expected action families**

- offer refinement
- proof/case-study creation
- buyer research
- outreach
- sales calls
- proposal writing
- close follow-up

**Expected minimum schedule shape**

- authority and offer blocks early
- recurring outreach and calls
- deeper prep blocks for proposals
- follow-up windows after proposals

**Expected correction triggers**

- trust gap forces stronger proof assets
- weak pipeline fit forces buyer-profile revision
- low close rate forces qualification or proposal changes
- long cycles force tighter follow-up system

## 8.4 Retail / Local Offer Sales

**Representative test goal** Generate the first 25 sales for a local weekend
pop-up offer in 21 days with local promotion assets, sales setup, and first two
outreach waves completed.

**Expected top-level outputs**

- local offer completed
- local audience criteria completed
- local promotion assets completed
- sales handling process completed
- first local promotion wave completed
- conversion tracking completed
- first sales cycle completed

**Expected action families**

- offer/pricing work
- local promo creation
- customer handling setup
- local outreach/promotion
- inquiry response
- follow-up/tracking

**Expected minimum schedule shape**

- quick local setup block early
- one or more promotional bursts
- daily response windows during campaign
- review block after first wave

**Expected correction triggers**

- low local interest forces channel change
- weak conversion forces offer adjustment
- response friction forces process simplification
- poor repeatability forces tracking/lesson capture

## 8.5 Subscription / Recurring Revenue Sales

**Representative test goal** Acquire the first 20 monthly subscribers for a paid
newsletter in 30 days with offer, onboarding path, sales page, and first
campaign sequence completed.

**Expected top-level outputs**

- recurring offer defined
- target customer profile completed
- onboarding/sales assets completed
- conversion path completed
- first acquisition pipeline launched
- first conversions completed
- follow-up/retention process completed

**Expected action families**

- offer design
- ICP work
- sales page/onboarding setup
- campaign/outreach execution
- conversion handling
- follow-up/retention planning

**Expected minimum schedule shape**

- front-loaded offer and conversion-path block
- recurring acquisition blocks
- post-conversion follow-up block

**Expected correction triggers**

- weak conversions force onboarding/path revision
- poor acquisition forces offer/message change
- retention concern forces expectation or value adjustment
- friction in checkout/signup forces simplification

---

# 9. Fundraising

## 9.1 Friends and Family Raise

**Representative test goal** Raise $10,000 from friends and family in 30 days
with target amount, simple deck, outreach list, and first conversations
completed.

**Expected top-level outputs**

- raise target clarified
- support narrative completed
- simple materials completed
- prospect list completed
- outreach sequence completed
- first conversations completed
- commitments tracked/closed

**Expected action families**

- raise planning
- memo/deck creation
- list building
- outreach
- conversation prep
- follow-up/commitment tracking

**Expected minimum schedule shape**

- quick planning/materials block early
- recurring outreach and conversations
- follow-up windows after asks

**Expected correction triggers**

- confusion about ask forces simpler materials
- weak response forces tighter target list
- stalled commitments forces clearer terms/follow-up
- too-broad ask strategy forces prioritization

## 9.2 Angel Raise

**Representative test goal** Raise $100,000 from angel investors in 60 days with
investor narrative, deck, target list, outreach sequence, and first meetings
completed.

**Expected top-level outputs**

- raise strategy completed
- investor narrative completed
- deck completed
- angel target list completed
- outreach sequence completed
- meeting prep completed
- follow-up/diligence handling completed

**Expected action families**

- story/deck work
- investor research
- outreach
- meeting prep
- follow-up
- diligence response

**Expected minimum schedule shape**

- deck/narrative sprint early
- recurring outreach/meeting cadence
- follow-up and diligence blocks after meetings

**Expected correction triggers**

- weak meeting traction forces deck/story revision
- poor investor fit forces list refinement
- diligence friction forces readiness improvements
- low response forces outreach/message adjustment

## 9.3 Seed Round Raise

**Representative test goal** Open a seed round in 75 days with fundraising
thesis, institutional deck, investor map, outreach pipeline, and diligence
materials completed.

**Expected top-level outputs**

- raise thesis completed
- institutional deck completed
- investor target map completed
- outreach pipeline completed
- data room/basic diligence materials completed
- meeting progression completed
- commitments/round progress tracked

**Expected action families**

- fundraising strategy
- deck writing
- investor mapping
- outreach
- meeting prep
- diligence preparation
- follow-up

**Expected minimum schedule shape**

- heavy prep block upfront
- sustained pipeline cadence over weeks
- diligence bursts later in process

**Expected correction triggers**

- weak narrative forces thesis/deck revision
- poor investor fit forces target-map changes
- diligence gaps force better materials organization
- slow progression forces pipeline intensification

## 9.4 Grant / Non-Dilutive Funding

**Representative test goal** Submit three high-fit grant applications within 45
days with eligibility review, materials, deadlines, and submissions completed.

**Expected top-level outputs**

- funding criteria list completed
- eligible opportunities identified
- application plan completed
- required materials completed
- applications submitted
- follow-up/compliance docs completed
- results/status tracker completed

**Expected action families**

- opportunity research
- eligibility review
- writing
- document gathering
- submission
- compliance follow-up

**Expected minimum schedule shape**

- deadline-driven writing/application blocks
- research and document-prep early
- admin/compliance follow-up after submissions

**Expected correction triggers**

- low-fit opportunities force stricter selection
- material gaps force reusable-template improvement
- deadline compression forces priority triage
- weak submissions force narrative/document upgrades

## 9.5 Sponsorship / Partnership Raise

**Representative test goal** Secure three sponsor meetings in 30 days for a
podcast launch with sponsorship package, target list, outreach sequence, and
first proposals completed.

**Expected top-level outputs**

- sponsorship offer defined
- partner value proposition completed
- target partner list completed
- sponsorship deck/materials completed
- outreach sequence completed
- first meetings/proposals completed
- follow-up/negotiation process completed

**Expected action families**

- sponsorship package design
- partner research
- outreach
- deck/proposal writing
- meeting prep
- negotiation follow-up

**Expected minimum schedule shape**

- package/material block first
- recurring outreach blocks
- proposal/meeting prep blocks as traction appears
- follow-up windows after meetings

**Expected correction triggers**

- weak partner interest forces value proposition sharpening
- low fit forces target-list refinement
- stalled negotiations force offer-tier simplification
- weak materials force better packaging/proof

---

## 1.0 Validation Use

This artifact is intended to serve as the canonical 1.0 execution-spec surface.

Every supported 1.0 goal should be testable against one of these 45 lanes. For
each lane, the system should be evaluated on whether it can:

- classify the goal into the correct archetype
- assign or infer the correct subtype lane
- produce expected top-level outputs
- derive the expected action families
- produce at least the expected minimum schedule shape
- trigger sensible correction logic when the plan drifts or degrades

Anything outside these 45 lanes is outside 1.0 validation scope.

## Next Step

The next step after this artifact is to create a formal test harness or
scorecard for each lane, with pass/fail or graded evaluation across:

- classification quality
- output quality
- action quality
- schedule quality
- correction quality
- progress tracking quality

That will turn this static specification into a full 1.0 validation matrix.
