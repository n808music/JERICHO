# Decision Record: Artifact & Deliverable Doctrine — Closed 2026-09-02

## Status Summary

**Decisions landed in record**: 9 (doctrine written, definitions locked, constraints stated)

**Implementation status**: 
- **Gated on Deliverable intake** (2): parentDeliverableIds field (bundles completionEvidence→doneWhen rename + activationState removal); E15 amendment (line 25/27)
- **Gated on parentDeliverableIds field** (1): Validator rules 1-2 (missing parentDeliverableIds, multiple parents without satisfaction_mode)
- **Queued, not gated** (2): Validator rule 3 (grain-crossing check on all classes, no new field needed, runnable today); completionEvidence→doneWhen rename (if extracted from bundle, Artifact-only, no Deliverable dependency)

**Open items**: 6 (awaiting data or adjudication)

---

## Key Line Citations

- **docs/superpowers/specs/2026-08-23-e15-phase-assignment-rule.md:25** — defect location (Artifacts half wrong grain)
- **docs/superpowers/specs/2026-08-23-e15-phase-assignment-rule.md:27** — inline mark with correction and hold reason (immediately following line 25)

---

## Decision 1: Artifact Parentage — Confirm & Enforce, Not Decide

**Decision as stated:**
Doctrine already answers Artifact parentage: parent is a Deliverable. Stated in the Artifact Definition, Artifact schema, fixture's `parent_deliverable`, and the grain ladder. Nothing in doctrine points at Project. The work is confirm-and-enforce, not decide.

**Contradictions found:**
- `src/state/identityCompute.js:16853-16872` — `declareArtifact` stores `producingProjectId` (two hops via Deliverable), no Deliverable-grain parent field
- `src/domain/masterGrid/loadReferenceMatrix.js:76-164` — loader resolves `parent_deliverable`, walks to Deliverable's `owningProjectId`, dispatches with only `producingProjectId`, drops the Deliverable link
- `src/domain/elicitation/artifactSlot.ts:61-84` — `buildArtifactDeclarePayload` emits only `producingProjectId`

**Status**: Contradiction verified. Wiring plan (parentDeliverableIds field + validator) is specified but not yet landed. **Gated on Deliverable intake design.**

**Proof of landing**: 
- Artifact node shape carries `parentDeliverableIds` (array)
- No `producingProjectId` field (replaced, not alongside)
- Validator rejects Artifact without `parentDeliverableIds`
- Tests pass for Artifact parent traversal through Deliverable

---

## Decision 2: Both Paths Lossy the Same Way

**Decision as stated:**
The loader and intake both write wrong-grain field. Loader reads `parent_deliverable`, derives to Project, stores only `producingProjectId`. Intake has no Deliverable tier, so it writes the same wrong-grain field by default.

**Contradictions found:**
Same as Decision 1. Additionally:
- `tests/fixtures/reference_matrix_v3_0.json` — all 175 Artifacts carry `parent_deliverable`, none carry `producingProjectId`

**Status**: Verified. **Landed as architectural finding; wiring pending.**

**Proof of landing**: Code review confirms loader derivation trace and intake absence.

---

## Decision 3: Cardinality Exception — Clause 6 of Artifact Definition

**Decision as stated:**
Artifact is the only class that may carry multiple parent Deliverables. When an Artifact carries more than one parent, `satisfaction_mode` MUST be present and governs how parents combine — AND: every parent; OR: any parent. Multiple parents without it is invalid. Grain and hop count are not relaxed: every parent is a Deliverable, one hop.

**Contradictions found:**
- `docs/superpowers/specs/2026-08-23-e15-phase-assignment-rule.md` does not mention the cardinality exception (this is expected; the exception belongs in the Artifact Definition, not E15 spec)
- No validator exists yet to enforce the rule

**Status**: **Pending.** Clause 6 written; not yet added to the formal Artifact Definition document. Validator not implemented.

**Proof of landing**:
- Artifact Definition document includes Clause 6 verbatim
- Validator rejects Artifact with cardinality > 1 and no `satisfaction_mode`
- Tests verify rejection behavior

---

## Decision 4: Field Design — parentDeliverableIds Array

**Decision as stated:**
Stored field is `parentDeliverableIds`, an array, not a scalar. `producingProjectId` is replaced, not kept alongside; Project derives through Deliverable at read time. No two-way divergence between grains.

**Contradictions found:**
- `src/state/identityCompute.js:16856` — `producingProjectId` field exists and is written
- `src/domain/elicitation/artifactSlot.ts:67-68` — payload builder emits `producingProjectId`

**Status**: Not yet landed. Contradictions are the target of the fix. **Gated on Deliverable intake; bundles with E15 amendment and completionEvidence rename.**

**Proof of landing**:
- Artifact node has `parentDeliverableIds: string[]`, no `producingProjectId`
- All consumers reading `producingProjectId` now derive it: `const project = state.matrix.deliverablesById[artifact.parentDeliverableIds[0]]?.owningProjectId`
- Tests verify traversal works
- Grep `producingProjectId` returns zero matches in live code (only in comments, history, or tests)

---

## Decision 5: E15 Amendment — Pending, Held Until parentDeliverableIds Lands

**Decision as stated:**
`docs/superpowers/specs/2026-08-23-e15-phase-assignment-rule.md` line 25 must split, not repoint:
- "Deliverables pure-copy their parent Project's Phase." (unchanged)
- "Artifacts pure-copy their parent Deliverable's Phase." (corrected)

Plus explicit prohibition: reading Artifact's parent Project directly is prohibited, even when the value matches. Resolution is through the Deliverable only.

Two consequences to add to doctrine:
1. Artifact phase is a copy-of-copy chain (Artifact → Deliverable → Project). Each node still reads only its immediate parent (hop compliance improves).
2. Direct Project reading is prohibited to prevent shortcut collapse.

**Current state:**
- Line 25 has inline warning mark but amendment not applied
- Amendment is held pending `parentDeliverableIds` field addition
- Applying before the field lands would put spec ahead of code

**Status**: **Pending.** Not applied yet. Will land in same commit as `parentDeliverableIds` field.

**Proof of landing**:
- E15 spec line 25 contains both sentences (split, not pointed)
- Prohibition clause appears in same paragraph
- Two consequences are stated explicitly
- Tests verify phase derivation follows Artifact → Deliverable → Project path
- Grep for direct `artifact.phase` computed from Project returns zero (all paths go through Deliverable)

---

## Decision 6: Stale Prose Demotion — Landed, Verified

**Decision as stated:**
`docs/superpowers/specs/2026-08-23-e15-phase-assignment-rule.md` is marked as stale. The defect (line 25 wrong grain) is marked inline rather than blanket file mark, so readers can distinguish which content is unreliable.

**Current state (verified by reading)**:
- Line 25: original statement (Deliverables/Artifacts copy Project's Phase)
- Line 27: inline warning block with `[KNOWN WRONG — HELD FOR AMENDMENT]`
- Defect stated: Artifacts half is incorrect
- Correction stated: split sentence form
- Hold reason stated: blocked pending `parentDeliverableIds` field addition
- No file-level blanket mark (preserves specificity)

**Status**: **Landed and verified.** Inline mark placed at line 27 (immediately after line 25).

**Proof of landing** (verified):
- `docs/superpowers/specs/2026-08-23-e15-phase-assignment-rule.md:27` contains warning block with defect, correction, and hold reason
- Readers see exactly one marked defect (lines 25-27), not a whole-file stale banner

---

## Decision 7: Doctrine Location — Option A, Landed in Record

**Decision as stated:**
Locked doctrine stays in the decision record. The repo gets the rule in executable form — a validator rejecting three rules:
1. Artifact without `parentDeliverableIds`
2. Multiple Artifact parents without `satisfaction_mode`
3. Any parent pointer that crosses or skips a grain in **any class** (not just Artifact)

The third rule generalizes across all classes and would have caught `producingProjectId` on its own. Building only rules 1-2 would miss the rule with the most reach.

Not a prose restatement; drift is loud (test failure) not silent (prose drift).

**Demotion requirement**: Prose in `docs/` that restates doctrine must be marked derived and non-authoritative with date, or deleted. Otherwise the validator becomes a fourth source of truth alongside three prose versions, which is the outcome Option A was chosen to avoid.

**Current state:**
- No validator implemented yet
- Doctrine is authoritative in the decision record
- E15 spec marked inline (line 25); other prose locations not yet audited

**Gating notes:**
- Rules 1-2: **Gated on `parentDeliverableIds` field** (gated on Deliverable intake)
- Rule 3 (grain-crossing check): **Queued, not gated.** Independent validator that applies to all six classes, requires no new field, runnable today as a read-only test of the doctrine location decision. Worth running before field lands to validate doctrine against live data.
- Demotion of contradictory prose: Not optional; must run alongside validator implementation

**Status**: **Landed in record as decision.** Validator implementation pending. **Gated on Deliverable intake for rules 1-2; rule 3 could run independently.**

**Proof of landing**:
- Validator test suite passes all three rejection rules
- Rule 3 test suite runs against Project, Entity, Initiative, System, Deliverable, Artifact
- Grep `parentDeliverableId` in code returns only the new field, no alternate spellings
- Stale prose in `docs/` marked as derived or deleted (post-validator implementation, demotion sweep scheduled with field landing)

---

## Decision 8: System Responsibility Boundary — Landed in Record

**Decision as stated:**
External systems are expressed through their deadlines; Jericho's job is labeling, tracking and evaluating those deadlines against the work against the goal deadline, not running the system. A System's node expression carries what it is and what it feeds, not its run-state.

**Consequence**: `activationState` is retired. It is a system-measured state (run-state), which violates the Attestation Contract (done-when describes operator actions, not system states) and violates the System schema which intentionally dropped Work State and Status.

**Current state:**
- `buildSystemDeclarePayload` emits `activationState` (contradicts decision; marked for removal)
- `declareSystem` stores it (contradicts decision; marked for removal)
- Fixture System nodes: all 10 have `activationCondition: null`, verified **not** absorbing mechanism content

**Status**: **Decision landed in record as doctrine. Retirement implementation pending (bundled with Deliverable intake). Marked for removal from payload builder and reducer store.**

**Proof of landing**:
- `buildSystemDeclarePayload` does not read or emit `activationState`
- `declareSystem` reducer does not store it
- Grep `activationState` in live code returns zero matches (only in tests, fixtures, or history)
- Tests verify System nodes have no activation tracking

---

## Decision 9: Deliverable Definition — Locked, Five Clauses Plus Clause 6

**Decision as stated:**
Five clauses (locked):
1. A Deliverable is a shippable unit of work within exactly one Project.
2. A Deliverable is executed by exactly one Executing Entity, which may differ from its Project's Owning Entity and may vary across Deliverables in the same Project.
3. A Deliverable carries its own target date. *(Corrected: removed "and what ships")*
4. A Deliverable decomposes into one or more Artifacts, which verify it and never gate above it.
5. Deliverables sharing one Completion Value are Milestones within a single Project, not separate Projects.

Clause 6 to add: Deliverable is the scheduling grain — buffers and dependencies attach at this level. Phase resolves at this level.

**Cardinality checks (verified)**:
- Clause 1: 63/63 Deliverables have exactly one `parent_project` ✓
- Clause 2: 63/63 Deliverables have exactly one `executing_entity` ✓
- Clause 4: 61 of 63 Deliverables have ≥1 Artifact; 2 have zero (violation)
  - "79th Street — Acquisition Complete" (0 artifacts)
  - "First Academy Building — Opening" (0 artifacts)

**Status**: **Landed as doctrine and locked clauses. Clause 6 written, not yet formally added. Two cardinality violations flagged.**

**Proof of landing**:
- Deliverable Definition document exists with five clauses
- Clause 6 is written and included
- Cardinality test suite runs; Clause 1 and 2 pass; Clause 4 flags 2 violations
- Zero-Artifact Deliverables get collapsed Artifacts (pending Deliverable intake design)

---

## Decision 10: Clause 3 Corrected — successCriteria Retired

**Decision as stated:**
Original Clause 3 claimed "carries its own target date and its own statement of what ships." That was a clause error, not a schema gap. The locked Deliverable schema never had a what-ships column. `successCriteria` is retired as a reducer field. The 28 Deliverables with `what_ships` carry unique content that migrates to Artifact as done-when (via the completionEvidence rename to doneWhen).

**Verification (completed)**:
- All 28 Deliverables with `what_ships` carry unique content vs. their child Artifacts (category b, migrate)
- Deliverable schema (locked): no what-ships column, never did
- Fixture: 175 Artifacts all carry `what_ships`; 28 of 63 Deliverables carry it

**Status**: **Landed as doctrine correction. Payload/reducer cleanup pending (bundle with parentDeliverableIds + doneWhen rename).**

**Proof of landing**:
- Clause 3 reads: "A Deliverable carries its own target date." (no "and what ships")
- Grep `successCriteria` returns only Deliverable load line (line 133), tests, or comments
- All consumer code reading that field has migrated to `satisfaction_criteria` / schema semantics

---

## Decision 11: Deliverable what_ships → Description Relabel

**Decision as stated:**
The 28 Deliverables carrying `what_ships` serve context awareness (INTENT tier), never a gate. This is a relabel to Description in the schema, not a migration to Artifact. All 28 are verified unique against their child Artifacts; none is redundant.

**Verification (completed)**:
- Redundancy check: 28/28 have unique `what_ships` vs. all children (0 redundant, 28 unique)
- Two zero-Artifact Deliverables both carry substantive `what_ships`: "79th Street — Acquisition Complete" and "First Academy Building — Opening" (will need collapsed Artifacts)

**Current state:**
- Fixture carries `what_ships` on 28/63 Deliverables
- Schema location: unknown (not yet enumerated in `docs/`)

**Status**: **Landed in record as design decision. Implementation pending: schema column enumeration, naming (description or what_ships), loader line 133 update, intake elicitation design. Gated on Deliverable intake design.**

**Proof of landing**:
- Deliverable schema has `description` or `what_ships` column (enumerated in locked schema doc)
- Loader line 133 maps to that column, not `successCriteria`
- Intake elicits the field
- Grep `successCriteria` on Deliverable path returns zero
- All 28 Deliverables with `what_ships` have their content accessible (either in description column or in collapsed Artifact doneWhen)

---

## Decision 12: completionEvidence → doneWhen Rename, Bundle with parentDeliverableIds

**Decision as stated:**
Artifact currently has two names for the same concept: `completionEvidence` (reducer field) and `doneWhen` (locked column). Rename the reducer field to `doneWhen`. Code is already correct; this is a naming harmonization.

Bundle with parentDeliverableIds commit (same node, same consumers affected).

**Current state**:
- `declareArtifact` stores `completionEvidence` (line 16859)
- `buildArtifactDeclarePayload` emits `completionEvidence` (line 69)
- Locked Artifact column is `doneWhen`
- Fixture Artifacts all carry `what_ships` (175/175)

**Contradictions found:**
- Reducer field named `completionEvidence`, not `doneWhen`
- No validator preventing the two-name situation

**Status**: **Landed in record as decision. Code changes pending. Bundled with parentDeliverableIds for sweep efficiency, but queued (not gated) if extracted separately — Artifact-only rename, no Deliverable dependency. Gated on Deliverable intake if bundled.**

**Proof of landing**:
- Artifact reducer field is named `doneWhen`, not `completionEvidence`
- All consumers read `.doneWhen` off Artifact
- Grep `completionEvidence` returns zero in live code (only tests, history, comments)
- Validator rejects any Artifact with the old field name

---

## Open Items — Awaiting Decisions or Data

### 1. Deliverable Schema Property Enumeration

What are the six locked Deliverable schema columns?

**What's known:**
- Fixture carries: `name`, `parent_project`, `executing_entity`, `target_date`, `what_ships` (28/63), `buffer_anchor` (20/63), `buffer_binding` (20/63)
- Fixture `completion_value` does not appear on Deliverable (0/63), only Initiative (5/29)
- Locked schema includes buffer columns but may not include `what_ships` (moved to Description)

**What's needed:**
- Official enumeration of the six columns
- Whether `description` collides with the 28 `what_ships` (column-vs-clause check flagged this as open)

### 2. Description Column Collision Check

Do any of the 28 Deliverables with `what_ships` also carry a `description` field in the fixture?

**Status**: Not searched. Required before renaming `what_ships` to `description`.

### 3. completionEvidence on Other Classes

Does `completionEvidence` appear on nodes other than Artifact?

**Status**: Not searched. If it does, the rename scope expands.

### 4. activationCondition Mechanism Content

Verified false negative: all 10 System nodes have `activationCondition: null`. `mechanism` is not misfiled there; it's truly absent from the intake path.

**Status**: Closed. No content loss on activationState retirement.

### 5. Converges Edge → Milestone Transformation

Where is the rule written that converts a `converges` edge into a DECLARE_MILESTONE action?

**What's known:**
- Loader line 179-206 handles `canonical_edges`
- `e.type === 'converges'` dispatches DECLARE_MILESTONE
- `e.type === 'structural' | 'companion_content'` dispatches DECLARE_MATRIX_LINK

**What's needed:**
- Doctrine location: is this rule written down? If not, add it.
- Does `e.target_date` on converges edges matter (currently dropped)?

**Status**: Implementation found, documentation location unknown. "Not searched" for doctrine reference.

### 6. Initiative Properties — Declare or Retire

Three Initiative properties with partial fill rates:

- `completion_value` (5/29) — Project-grain concept at Initiative grain, evidence for retiring
- `ongoing_output` (6/29) — purpose text for ongoing Initiatives, currently unmapped
- `boundary_type` (29/29, all populated) — required field per loader, maps to Initiative intake

**What's needed:**
- Declare: completion_value gets formal schema column and intake field, or retire it
- Declare: ongoing_output gets schema column and intake field, or retire it
- Confirm: boundary_type is correctly wired (already has intake field, no change)

**Status**: Pending adjudication. Do not wire these until declared/retired. (Project's `boundary_type` is independently workable; Initiative's is also independently workable but depends on this decision.)

---

## Record Revisions

**2026-09-02 (afternoon)** — Intro summary revised to distinguish gated (blocked on prerequisite) from queued (ready but bundled for efficiency). Line citations added for E15 defect/mark locations. Validator rule 3 (grain-crossing check) pulled out as immediately runnable. `completionEvidence` → `doneWhen` marked queued if extracted. Item-level status words clarified throughout.
