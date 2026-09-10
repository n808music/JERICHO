# Publication Rule — Film & Episodic Deliverables

**Rule:** For any film-shaped or episodic deliverable with a public release requirement:

```
release_date = max(parent_release_date + lane_offset, own_production_terminal)
```

Where:
- `parent_release_date` is the public release date of the parent work (album, series, etc.)
- `lane_offset` is the per-lane buffer between parent and companion release (discovered per lane)
- `own_production_terminal` is the deliverable's final production terminal (delivered master, final cut locked, etc.)

**The floor rule:** A companion work cannot release before its parent is public. If `own_production_terminal` is later than the derived release, the production terminal governs and no Release artifact is constrained earlier than that date.

---

## Measured lane offsets

| Lane | Parent | Offset | n | Notes |
|---|---|---|---|---|
| Max Clout | Seeds of Destruction album releases | +14d | 3 | Uniform across all three films |
| State of Control | OFL tape album releases (UVL +3wk) | +6wk | 4 | Uniform across pt. 2–5 (pt. 1 control: 2027-01-24 + 63d = 2027-03-28 ✓) |
| The Imaginary CEO | Companion album releases | 4–6d | 7 | Range across S1–S7 (S1–S4 cluster at ~6d, S5–S7 at 4–6d variance) |

---

## Derivation of TIC offset (n=7)

Season → Companion album → Album release (UVL +3wk) → Season terminal → Offset:

| Season | Companion album | UVL | Album release | S terminal | Offset |
|---|---|---|---|---|---|
| 1 | Painkillers | 2027-05-20 | 2027-06-10 | 2027-06-16 | +6d |
| 2 | Coronation | 2027-09-03 | 2027-09-24 | 2027-09-30 | +6d |
| 3 | Savior | 2027-12-19 | 2028-01-09 | 2028-01-14 | +5d |
| 4 | Sacrifice | 2028-04-06 | 2028-04-27 | 2028-05-02 | +5d |
| 5 | SoD Entry 1 | 2028-09-06 | 2028-10-26 | 2028-11-01 | +6d |
| 6 | SoD Entry 2 | 2029-03-28 | 2029-04-28 | 2029-05-02 | +4d |
| 7 | SoD Entry 3 | 2029-09-06 | 2029-10-26 | 2029-11-01 | +6d |

**Range: 4–6 days. Pattern interpretation:** Every terminal lands shortly after parent release, never before, never wide. Coheres only if terminal IS the airing date. Supports reading (a): the uniform +7d gap between Edit/Post Complete and deliverable terminal represents a fixed cascade from the airing, not a new QC event after airing.

---

## Season 8 exception

Season 8 pairs with I Am The State (terminal album, UVL 2032-04-21, release 2032-05-12). 

Current deliverable terminal: 2032-03-15 (before parent release).

Violates floor rule: max(2032-05-12, 2032-03-15) = 2032-05-12.

Conditional fix (gates on `companion_content` edge S8 → IATS):
- **If edge exists:** S8 re-anchors to 2032-05-12 + 4–6d = **2032-05-17** (midpoint of TIC range)
- **If edge does not exist:** S8 is not companion content; stays at 2032-03-15 (own production terminal governs)

---

## Schema implementation

The rule is mechanical and should be enforced at load time once `publication_required` boolean field is added to Deliverable:

```pseudocode
if deliverable.publication_required
  parent_release = derive_parent_release(deliverable.parent_project.parent_initiative)
  offset = lane_offsets[derive_lane(deliverable)]
  
  derived_release = parent_release + offset
  actual_release = max(derived_release, deliverable.target_date)
  
  // Find publication artifact(s) marked publication_artifact: true
  pub_artifacts = [a for a in artifacts 
                   if a.publication_artifact 
                   and deliverable.name in a.parent_deliverable]
  
  if not pub_artifacts:
    raise PlanError(PUBLICATION_REQUIRED_MISSING, details)
  
  // Staged release: use earliest publication date (stable under later additions)
  if len(pub_artifacts) > 1:
    pub_date = min(a.target_date for a in pub_artifacts)
  else:
    pub_date = pub_artifacts[0].target_date
  
  // Load succeeds only if at or before actual_release
  if pub_date > actual_release:
    raise PlanError(PUBLICATION_DATE_VIOLATION, 
      f"{deliverable.name}: publication date {pub_date} exceeds max({derived_release}, {deliverable.target_date})")
```

**Date anchor for staged releases:** When a deliverable has multiple publication artifacts (currently hypothetical),
use **earliest**. Publication is when the thing becomes public, which is the first artifact. Earliest is stable
under later additions: add a second publication artifact after the fact and the anchor date does not move — the
property needed for other lanes to offset from it.

---

## Coverage audit

**Complete inventory by lane** (fixture reference_matrix_v3_1.json):

- **Max Clout (3):** All carry Release artifacts ✓
- **State of Control (5):** pt. 1 carries Release; pt. 2–5 require addition (added in Phase 2a)
- **The Imaginary CEO (8):** None carry Release; all require addition (added in Phase 2a)
- **Desiree (1):** No Release; addition required, dates via max() rule (added in Phase 2a)
- **Other film-shaped (if any):** Discovered in Phase 1 sweep

**Total publication gap in v3.0:** 13 deliverables without Release artifacts.

---

## Audit trail

- **2026-09-08:** Rule derived from Max Clout precedent and TIC/SoC measurements
- **2026-09-08:** Publication sweep phase designed
- **2026-09-08:** 13-unit gap identified (SoC pt. 2–5, TIC S1–S8, Desiree)
- **Planned 2026-09-08:** Fixture mutations (v3.1) add 13 Release artifacts, enforce via loader gate
