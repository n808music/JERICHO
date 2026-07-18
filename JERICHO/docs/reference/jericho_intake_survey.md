# Jericho Intake Survey v1.0 — Structured Form Flow

The form the intake presents, in order, with the schema field each question writes to and the validation gate that fires on submit. Built against `jericho_matrix_schema.json`; graded against `reference_matrix_v1_4.json`.

**Global invariant (all sections):** every name field is stored verbatim — no normalization, no spell-correction, no casing changes. What the user types is what persists.

**Global escape hatch (all sections):** every item has a **"Can't place it (30-second rule)"** button → writes the name verbatim to `parking_lot` with a required one-line `confusion` field. Guessing is a defect; parking is correct behavior.

---

## §1 — Enterprise header
| # | Question | Writes to | Validation |
|---|----------|-----------|------------|
| 1.1 | What is this enterprise/plan called? | `enterprise.name` | required |

## §2 — Entities
*Repeat block. "Add another" until done.*
*"Writes to" is the store field; the parenthetical is the reference-fixture column it maps from.*
| # | Question | Writes to (store field ← fixture col) | Validation |
|---|----------|-----------|------------|
| 2.1 | Entity name (exact spelling) | `name` | V1 unique, V2 verbatim |
| 2.2 | Legally registered or conceptual? | `formationState` (← legal_status) | required |
| 2.3 | One-line purpose | `purpose` | required |
| 2.4 | Role-tags — what else does it act as? | `roleTags` (← role_tags) | **required, ≥1** (`declareEntity` rejects empty), multi |
| 2.5 | Evidence of current status (registration #, URL, doc ref) | `statusEvidence` | required |

## §3 — Initiatives (the survey's initiative unit)
*Intro text shown to user: "An initiative is the REASON for a project — the why. If it doesn't have a specific objective and a deadline, it isn't an initiative yet."*
| # | Question | Writes to (store field ← fixture col) | Validation |
|---|----------|-----------|------------|
| 3.1 | Initiative name (exact spelling) | `name` | V1, V2 |
| 3.2 | Which ONE entity owns it? (or Cross-cutting) | `owningEntityId` (← owner) | **V3: single select from §2 entities + 'Cross-cutting' (→ null owner). Free-text dual names impossible by construction.** |
| 3.3 | Specific objective — why are we doing this? | `purpose` (← objective) | **V4: required, non-empty. Empty → parking lot, not a soft skip.** |
| 3.4 | Deadline / done-when | `doneWhen` (← deadline) | **V4: required.** |
| 3.5 | Objective or constraint? | `classification` | required, one of `objective`\|`constraint` (`declareInitiative` rejects other) |
| 3.6 | Phase number | `phase` | required |
| 3.7 | Role-tags | `roleTags` (← role_tags) | optional |
| 3.8 | Work state (free text: 'needs script', 'in progress 3/7'…) | `work_state` | optional — **fixture/lifecycle column; not persisted by the store, not displayed by the grid** |

## §4 — Systems (the survey's system unit)
*Intro: "A system is a repeatable mechanism that runs continuously. Every producing entity runs exactly one; cross-cutting loops connect them."*
| # | Question | Writes to (store field ← fixture col) | Validation |
|---|----------|-----------|------------|
| 4.1 | System name (exact spelling) | `name` | V1, V2 |
| 4.2 | Which ONE entity owns it? (or Cross-cutting) | `owningEntityId` (← owner) | V3 single select (Cross-cutting → null) |
| 4.3 | Mechanism: input → transform → output | `cycle` (← mechanism) | required |
| 4.4 | Running, missing, or planned? | `activationState` | required, one of `running`\|`missing`\|`planned` (`declareSystem` rejects other) |
| 4.5 | What does it feed / converge into? | `edge(feeds)` (← feeds) | creates edge, V7 |
| 4.6 | Work state | `work_state` | optional — fixture/lifecycle column, not persisted |

## §5 — Projects (the survey's project unit)
*Intro: "A project is the WHAT — a concrete body of work under an initiative's reason."*
| # | Question | Writes to (store field ← fixture col) | Validation |
|---|----------|-----------|------------|
| 5.1 | Project name (exact spelling) | `name` | V1, V2 |
| 5.2 | Which ONE entity owns it? | `owningEntityId` (← owner) | V3 single select; **must resolve to a declared §2 entity (`declareProject` rejects unknown)** |
| 5.3 | Which initiative is its reason? | `owningInitiativeId` (← parent_initiative) | **V5: single select from §3 initiatives only. A project cannot parent a project.** |
| 5.4 | Success metric — how is "done" measured? | `successMetric` | required (`declareProject` rejects empty) |
| 5.5 | How is completion verified? (the source) | `verificationSourceId` | required — single select from declared verification sources |
| 5.6 | Phase + target date | `phase`, `targetDate` (← target_date) | required |
| 5.7 | What does it depend on? (entity → thing) | `edge(depends_on)` | repeatable, V7 |
| 5.8 | Work state | `work_state` | optional — fixture/lifecycle column, not persisted |

## §6 — Deliverables
*Intro: "A deliverable is the THING THAT SHIPS — could you physically hand it to someone? Its producer may differ from its project's owner; this is the only place cross-entity work is recorded."*
| # | Question | Writes to (store field ← fixture col) | Validation |
|---|----------|-----------|------------|
| 6.1 | Deliverable name (exact spelling) | `name` | V1, V2 |
| 6.2 | Which project does it ship out of? | `producingProjectId` (← parent_project) | **V5: single select from §5 projects only; must resolve (`declareArtifact` rejects unknown).** |
| 6.3 | Which entity produces it? | `producedByEntityId` (← produced_by) | required, single select — may differ from project owner; must be a declared §2 entity |
| 6.4 | What ships, concretely? | `completionEvidence` (← what_ships) | required |
| 6.5 | How is completion verified? (the source) | `verificationSourceId` | required — single select from declared verification sources |
| 6.6 | How does the operator attest it shipped? | `operatorAttestationMethod` | required |
| 6.7 | Phase + target date | `phase`, `targetDate` (← target_date) | required |
| 6.8 | Does it ship with / promote anything? | `edge(ships_with/promotes)` | repeatable |
| 6.9 | Work state | `work_state` | optional — fixture/lifecycle column, not persisted |

## §7 — Convergences and edges
| # | Question | Writes to | Validation |
|---|----------|-----------|------------|
| 7.1 | Any dates where multiple lanes land together? Name the convergence, list what converges. | `edge(converges)` | endpoints must resolve, V7 |
| 7.2 | Any legal/hard cliffs? (e.g., patent expiry) | `edge(legal_cliff)` | optional |

## §8 — Completion gate (runs automatically)
1. **V7 referential sweep** — every owner/parent/produced_by/edge endpoint resolves. Unresolved → listed, user fixes or parks.
2. **Parking lot review** — each parked item re-presented once with placement tests. Still stuck → intake ends with `intake_complete=false` and an explicit blocker list. **Rule 3: never silently complete.**
3. **Readback proof (V9)** — system closes the session, reopens, reads every node back, and displays the full name list to the user with counts: "I am holding N nodes: [names]. Confirm." User confirms → `intake_complete=true`, and **every `DRAFT` node advances to `reviewStatus=CONFIRMED`** (the Master Grid's Ready column flips YES). This confirmation is the sole producer of `CONFIRMED` (satisfies V8); `NEEDS_REVIEW` stays operator-set, and an unconfirmed readback leaves nodes `DRAFT`.

Step 3 of the gate is the direct countermeasure to the 2026-07-06 failure: the run does not count as complete until the system *demonstrates* it can still recite every name after persistence.

---

## §9 — App structure directives (tabs and views)

Jericho's UI mirrors the reference workbook, with one architectural upgrade: data enters in exactly one place, and every summary is derived, never maintained.

**Shipped tab bar (`TAB_CONFIG`):** Structure · Today · Stability · Master Plan · Master Grid. The intake model maps onto it as below — the survey's conceptual surfaces are not all separate tabs.

| Surface | Shipped tab | Role | Editability |
|---------|-------------|------|-------------|
| **Intake** | **Structure** tab → `MatrixIntake` section | The survey above (§1–§8). The ONLY surface where nodes and edges are created or modified. Replaces reference sheets 1–5. | Editable |
| **Master Grid** | **Master Grid** tab | The matrix: all nodes, one row each — Name, Primary Class, Role-Tags, Owner/Parent, Phase, Status, Ready. **Generated read-only view rendered live from the datastore.** No create/edit/delete affordance. Rows appear the moment intake writes them and always reflect live store state — 'fill this LAST' enforced by architecture: always last because always derived. Row click deep-links back to the Structure/Intake section for that node. | **Read-only — hard directive** |
| **Schedule** | **Master Plan** tab | Second generated view from the same store: nodes ordered by phase → target date → dependency edges. Derived, never hand-edited. Regenerates on any store change. | **Read-only — hard directive** |
| — | **Today** / **Stability** | Execution and signal views; not part of the intake/matrix model. | — |

**Parking Lot — not yet a shipped tab (backlog).** Rule 2 (30-second rule) and V8's parking-lot-empty requirement currently have no UI mechanism or `parking_lot` store. Run 3 is unaffected (answering from a fully-resolved answer key needs no parking), but the first real intake with a genuinely confused node has nowhere to park it — it will force a guess (a V6 defect) or drop the node (the run-2 failure mode). **Backlog item, post-run-3: implement the Parking Lot surface + `parking_lot` store + the V8 empty-parking gate.**

**D1.** If the Master Grid or Schedule can disagree with the datastore, that is a defect by definition — there must be no second copy to drift.
**D2.** Any feature request to "edit from the grid" must route the user back to Intake for that node; the grid may deep-link, never write.
