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

## 3. Gate hits status

### GH-1 — RESOLVED

`docs/PUBLICATION_RULE.md` enumerates 17 publication-companions: Max Clout (3), State of
Control (5), The Imaginary CEO (8), Desiree (1). The fixture holds 19 film-shaped deliverables,
including D8 N8 and BLACKMAN. Both carry the full `[CPSER]` production chain and Release
artifacts.

**Resolution:** No `companion_content` edge exists for either unit in `canonical_edges`. The
publication offset rule applies only to declared companions. Without the edge, the offset logic
does not apply, and both units use their own production terminals as release dates. The offset
table is correctly sized for the 17 companions it describes.

**Separate ticket, out of scope:** Romance Riot album (2026-10-24) is a music-shaped deliverable
that carries no Release artifact in v3.0. It is another instance of the gap the sweep found, but
in a class (music-shaped) that Phase 1 did not audit. That is a parallel ticket independent of
the 13 film-shaped units and the two non-companion shorts.

### GH-2 — The gate declares and satisfies publication asymmetrically.

`PUBLICATION_RULE.md` scopes itself to "any **film-shaped or episodic** deliverable with a
public release requirement." The gate currently:

1. Declares publication is required (implicitly, by trying to find it)
2. Checks for satisfaction by matching artifact name to the pattern "Release"

These are separate concerns. Declaring *requirement* and identifying *satisfaction* need separate
mechanisms. Help Yourself Broadcast — Batch 1 (episodic, inside the rule's stated scope) has a
real publication event named `Published`, not `Release`. The gate would raise `PUBLICATION_REQUIRED_MISSING`
against a unit whose publication is already falsifiable.

**Ticket scope: three pieces, settled in order.**

1. Add `publication_required: boolean` field to **all 63 Deliverables** (not just 19). A boolean
   present on only some rows makes absence ambiguous — "publication not required" vs. "not filled in."
   This is the same principle that makes Completion Stated In total across all 29 Initiatives.
   Film-shaped = true, everything else = false. Every row carries the field, so blank is always an error.

2. Add a way to identify which artifact satisfies the requirement. Candidates: extend `satisfaction_mode` on
   Artifact, or a new field. Name-matching breaks when lanes use different terminology (Help Yourself
   Broadcast uses `Published`; film lanes use `Release`; music uses `Upload Verified Live`).

3. **Backfill film-shaped 19 units.** Using the Phase 1 sweep definition (any unit carrying Shoot/Pre-Production/Edit Complete),
   set `publication_required: true` and configure satisfaction. The definition is the only non-name-based
   way to populate it. Write it now, while the sweep output is fresh.
   
   **Consequence:** When music-shaped deliverables are audited separately (Romance Riot and siblings), the edit
   is flipping existing false values to true rather than adding a field to rows that didn't have one — a
   much smaller and more visible edit.

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
- `COMPLETION_STATED_IN_MUTATIONS.md` § Fixture changes applied: "Release artifacts added: 14"
  — 13 are Release artifacts; the 14th is an `Upload Verified Live` for a gap that is not open.
  This row should be dropped, not re-added. (Resolves GH-3.)

---

## 6. Verdict

**The 13 is confirmed exact and Phase 6's row-count arithmetic (175 → 188) stands. Inventory
reconciles end-to-end: 19 film-shaped, 6 with Release, 13 without. The 6 split as 17 companions
(Max Clout, SoC, TIC, Desiree) plus 2 non-companions (D8 N8, BLACKMAN).**

**Phase 2a is blocked on GH-2.** GH-1 resolved (no companion edge, offset logic doesn't apply).
GH-3 resolved (row drops, already in recovery file). GH-2 is open and scoped: add `publication_required`
to all 63 Deliverables (film-shaped true, others false), separate the satisfaction mechanism from
name-matching, backfill film-shaped 19 from Phase 1 definition. Phase 2a cannot proceed until
GH-2 is implemented.
