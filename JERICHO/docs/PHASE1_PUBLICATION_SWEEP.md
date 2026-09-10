# Phase 1 — Publication Sweep Result

**Date:** 2026-09-09
**Tree:** clean, HEAD `20406ec` lineage (record commits only; no fixture or test mutation)
**Fixture swept:** `tests/fixtures/reference_matrix_v3_0.json` (343 nodes: 7 Entity / 29 Initiative / 59 Project / 63 Deliverable / 175 Artifact / 10 System)
**Method:** read-only. Nothing in the fixture, the tests, or the Phase 0 anchor was modified.

---

## 1. The operational definition, in the form it was actually run

Deliverable rows carry exactly five fields — `class, name, parent_project, executing_entity, target_date`.
There is **no medium field, no `publication_required`, no type discriminator.** "Film-shaped"
therefore cannot be read off a row. It was derived from the artifact chain hanging off the row.

**Definition used:**

> A Deliverable is **film-shaped** iff it carries at least one Artifact whose name matches
> `/Shoot Complete|Pre-Production Complete|Edit\/Post Complete/i`.

**It carries a Release** iff it carries an Artifact whose name matches `/(^|—\s*)Release$/i`
— the standalone terminal artifact. The anchored `$` is load-bearing: it excludes
`Release Packaging (X)`, `Post-Release Rollout Complete (X)`, and `Public App Release Live`,
which are album- and product-lane artifacts, not film releases.

**Why the artifact chain and not the name.** Name-matching on `film|season|pt\.|feature`
would have been circular — it presumes the inventory the sweep is supposed to discover. The
artifact chain is evidence already in the fixture and independent of naming convention. It is
also what the loader will see.

**Measured discrimination.** The definition is sharp on this fixture: all 19 matches carry
`Shoot Complete` specifically, and all 19 carry `Pre-Production Complete`. The three markers
select the same 19 rows independently — they do not merely overlap. The union and the
intersection are the same set.

**Known limits of the definition, stated so it can be attacked:**

- It cannot see a film-shaped unit that carries **no production artifacts at all**. Tested for
  directly (§4). Two zero-artifact deliverables exist; neither is film-shaped.
- It is a definition of *film-shaped*, not of *publication-bearing*. Those are different sets,
  and conflating them is gate hit **GH-2**.

---

## 2. Result — the 13 is exact

**19 film-shaped deliverables. 6 carry a Release. 13 do not.**

Diffed against `RECOVERED_fixture_mutation.json` `intended_additions[]` (the enumeration of the
intended 13), **not** against the plan text:

```
SWEEP missing-Release: 13    RECOVERY intended: 13
in SWEEP not in RECOVERY: []
in RECOVERY not in SWEEP: []
EXACT SET MATCH: true
```

| Lane | Units | Carry Release | Missing |
|---|---|---|---|
| Our Fearless Leader (D8 N8, BLACKMAN) | 2 | 2 | 0 |
| State of Control pt. 1–5 | 5 | 1 (pt. 1) | **4** |
| Max Clout 1–3 | 3 | 3 | 0 |
| The Imaginary CEO S1–S8 | 8 | 0 | **8** |
| Desiree — Feature Film | 1 | 0 | **1** |
| **Total** | **19** | **6** | **13** |

**The mutation sequence's central premise holds.** 13 is the complete set of film-shaped
deliverables missing a Release artifact, by a definition derived independently of the plan.

---

## 3. Gate hits — these stop Phase 2a

### GH-1 — The inventory is 19, not 17. Two units were never audited.

`docs/PUBLICATION_RULE.md` § Coverage audit enumerates Max Clout (3), State of Control (5),
The Imaginary CEO (8), Desiree (1) = **17**. The fixture holds **19**. Unlisted:

| Unit | Project | Artifacts |
|---|---|---|
| **D8 N8** | Our Fearless Leader 3: Romance Riot — Rollout & Assets | Script, Pre-Production, Shoot, Edit/Post, **Release** (2027-01-31) |
| **BLACKMAN** | Our Fearless Leader 3: Romance Riot — Rollout & Assets | Script, Pre-Production, Shoot, Edit/Post, **Release** (2027-02-14) |

Both carry the full `[CPSER]` chain — they are film-shaped by any reading, and their Release
artifacts use the identical `what_ships` wording as the Max Clout lane ("Content publicly
released across declared channels").

**Why this stops Phase 2a rather than being a note.** They add **zero rows** — they already
have Releases. But `PUBLICATION_RULE.md` defines lane offsets for exactly three lanes (Max
Clout +14d, State of Control +6wk, The Imaginary CEO 4–6d). There is **no lane for the OFL
rollout-asset units**. The moment `publication_required` is enforced at load time, these two
rows enter a gate that has no rule to evaluate them against. The audit that produced the 17
did not see them, so the offset table cannot be assumed complete either.

### GH-2 — Keying the gate on the literal name "Release" breaks 13 non-film units.

`PUBLICATION_RULE.md` scopes itself to "any **film-shaped or episodic** deliverable with a
public release requirement," but the pseudocode gate tests for "a Release artifact." Those do
not describe the same set. Thirteen publication-bearing deliverables outside the film-shaped 19
express publication under other names:

| Unit(s) | Publication artifact |
|---|---|
| 6 × `— Artwork & Packaging` (Romance Riot, Painkillers, Coronation, Savior, Sacrifice, SoD 1–3, IATS — 9 rows) | `Upload Verified Live (X)`, `Release Packaging (X)`, `Post-Release Rollout Complete (X)` |
| **Help Yourself Broadcast — Batch 1 (5 episodes)** | `Published (5 episodes live)` |
| The Jericho System — 1.0 Public Launch | `Launch Announcement Live`, `Public App Release Live` |
| F8 Energy GUM — Product Launch | `GUM — Product Available for Purchase` |
| Marketing Flywheel — Capture Layer Live | `Pre-Save / Platform-Follow / App-Signup Capture Live` |

**Help Yourself Broadcast is the sharp case.** It is *episodic* — squarely inside the rule's
own stated scope — it has a real publication event, and its artifact is named `Published`, not
`Release`. A gate matching on "Release" raises `PUBLICATION_REQUIRED_MISSING` against a unit
whose publication is already falsifiable. The gate must key on publication *semantics*, or its
scope sentence must be narrowed to film-shaped only. Deciding which is a prerequisite to 2a.

### GH-3 — The defective 14th row's premise is false, not just its id.

Recorded as a duplicate-id defect. It is worse than that. `COMPLETION_STATED_IN_MUTATIONS.md`
Row 5 reasons: *"Terminal album released" → missing Upload Verified Live artifact (now added)*.

The artifact is **not missing**:

```
EXISTS: "Upload Verified Live (I Am The State)"
        parent_deliverable = "I Am The State — Artwork & Packaging"   2032-04-21
defective row would attach to:
        parent_deliverable = "I Am The State — Terminal Album"
```

The album lane consistently splits: the `— tape/album` deliverable carries only the song-count
artifact, and every publication artifact lives on the sibling `— Artwork & Packaging`
deliverable. This holds for all 9 albums without exception. The 14th row was attached to the
wrong sibling, which is *why* it collided. The gap it was written to close does not exist, so
the row should not be re-added in corrected form — it should be dropped, and Row 5's reasoning
corrected.

---

## 4. False-negative test (definition robustness)

All 44 deliverables outside the film-shaped 19 were examined. 13 carry a public-release-event
artifact (GH-2 above). The remaining 31 are: 17 × `— Business Plan`, 9 × album song-count
rows, `The Jericho System — MVP`, `Behavioral Execution Engine — Patent Submission`, and two
carrying **zero artifacts** — `79th Street — Acquisition Complete` and
`First Academy Building — Opening`.

Neither zero-artifact row is film-shaped (both are property/facility units), so neither is a
false negative for this sweep. Flagged as a separate data-quality item, out of scope here.

---

## 5. Corrections to the governing documents

- `PUBLICATION_RULE.md` § Coverage audit cites **`reference_matrix_v3_1.json`**. No such file
  exists; the fixture in the repository and under test is `reference_matrix_v3_0.json`.
- `PUBLICATION_RULE.md` § Coverage audit total inventory: **17 → 19** (GH-1).
- `COMPLETION_STATED_IN_MUTATIONS.md` § Fixture changes applied: "Release artifacts added: 14"
  — 13 are Release artifacts; the 14th is an `Upload Verified Live` for a gap that is not open
  (GH-3).

---

## 6. Verdict

**The 13 is confirmed exact and Phase 6's row-count arithmetic (175 → 188) stands.**

Phase 2a is **held** on GH-1 and GH-2 — the first because the offset table has no rule for two
units the audit never saw, the second because the gate's match criterion and its stated scope
disagree, and the disagreement lands on a real unit. GH-3 removes a row rather than adding one
and does not change the 188.
