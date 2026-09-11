# Completion Stated In — Column 9 Mutations

**Five Initiative rows, all flip from Terminating to Children.**

Source: reference_matrix_v3_0.json audit + fixture mutations applied.

---

## Row 1: Our Fearless Leader: 7 Seals

| Field | Current | New |
|---|---|---|
| **Completion Stated In** | (blank — Terminating) | **Children** |
| **Purpose** | (existing) | Add: *"Seven-tape arc (OFL 3–7). Tapes 1–2 released prior to plan horizon."* |

**Reasoning:** "All 7 tapes shipped" scope relocated. Tapes 1–2 are real history (confirmed pre-horizon, not plan-horizon work). Graph carries tapes 3–7 as projects; scope deserves recording in Purpose.

---

## Row 2: State of Control

| Field | Current | New |
|---|---|---|
| **Completion Stated In** | Terminating (+ CV: "5 short films uploaded to YouTube.") | **Children** |
| **Completion Value** | (clear) | _(empty)_ |
| **Purpose** | (existing) | Add: *"Release platform: YouTube"* |

**Reasoning:** YouTube is a scope clause, not a completion event. Four Release artifacts added to fixture (pt. 2–5); publication is now falsifiable for all five films.

---

## Row 3: The Imaginary CEO

| Field | Current | New |
|---|---|---|
| **Completion Stated In** | Terminating (+ CV: "Season 8 airs covering I Am The State and is published to the Global State YouTube channel.") | **Children** |
| **Completion Value** | (clear) | _(empty)_ |
| **Purpose** | (existing) | Add: *"Eight-season arc; Season 8 companion content to I Am The State (companion_content edge); release platform: YouTube"* |

**Reasoning:** "Season 8 airs" → missing Release artifact (now added, re-anchored to 2032-05-17 per companion-content precedent). "Covering I Am The State" and "published to YouTube" are scope, not events. All eight seasons now have falsifiable release dates in fixture.

---

## Row 4: Seeds of Destruction

| Field | Current | New |
|---|---|---|
| **Completion Stated In** | Terminating (+ CV: "Album trilogy and Max Clout short-film trilogy both shipped.") | **Children** |
| **Completion Value** | (clear) | _(empty)_ |
| **Purpose** | (existing) | _(no additions)_ |

**Reasoning:** Both trilogies are already captured by node count (3 SoD Entry projects, 3 Max Clout projects). No scope to relocate — the graph independently records "trilogy" via structure. Both carry Release artifacts; shipped is falsifiable.

---

## Row 5: I Am The State

| Field | Current | New |
|---|---|---|
| **Completion Stated In** | Terminating (+ CV: "Terminal album released; Desiree feature film released; arc complete.") | **Children** |
| **Completion Value** | (clear) | _(empty)_ |
| **Purpose** | (existing) | _(no additions)_ |

**Reasoning:** 
- "Terminal album released" → missing Upload Verified Live artifact (now added, 2032-04-21 per album convention)
- "Desiree feature film released" → missing Release artifact (now added, 2032-05-17)
- "arc complete" → non-falsifiable prose, deleted outright
- Both publications now have falsifiable artifacts.

---

## Fixture changes applied

| Type | Count | Details |
|---|---|---|
| Release artifacts added | 14 | SoC pt. 2–5 (4), TIC S1–S8 (8), Desiree (1), I Am The State album (1) |
| Deliverable terminals moved | 12 | SoC pt. 2–5 (+6wk each); TIC S8 (2032-03-15 → 2032-05-17) |
| Project terminals moved | 12 | Cascaded from deliverables |
| Completion Values cleared | 5 | All rows above |

**Offset family (per-lane):**
- Max Clout: album release +14d (n=3, uniform)
- State of Control: album release +42d / 6 weeks (n=4, uniform)
- The Imaginary CEO: companion album release +5d (n=8, uniform after S8 correction)

---

## Test expectations

**After sheet mutations + fixture deployed:**

- **Baseline movement**: Likely stable or minor increase. Publication artifacts now carry requirements that were previously asserted in prose only — if test coverage exists for "films must publish," test suite may show movement in *favorable* direction (requirements now falsifiable).
- **Nodes added**: +14 artifacts in fixture.
- **Dates moved**: 12 deliverable + 12 project terminals.
- **Coverage test**: Publication sweep (separate ticket) will verify 13-unit publication gap is complete.

---

## Approval gates

**Ready to apply when:**
- [ ] n8 confirms all five rows are Children (no exceptions)
- [ ] Sheet mutations applied
- [ ] Fixture deployed to test suite
- [ ] Full suite run complete (baseline established)
