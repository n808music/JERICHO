---
name: item-6-dual-parent-validation-result
description: Spot-check validation of Deliverable dual-parent ownership paths—decision point for aggregation operator design.
metadata: 
  node_type: memory
  type: project
  originSessionId: 3f4fbcb8-fe43-45d0-8046-2afa4ee9464a
  modified: 2026-08-21T01:18:32.871Z
---

## Spot-Check Results (2026-08-20)

**Query:** For each Deliverable, do paths via Initiative → Entity and Project → Entity converge to the same Entity?

**Dataset:** reference_matrix_v1_4.json (12 Deliverables, 11 Initiatives, 17 Projects, 7 Entities)

### Finding
- **Consistent paths:** 7 Deliverables (both parent paths → same Entity)
- **Disagreements:** 5 Deliverables (paths → different Entities)
- **Unresolved:** 0

### Mismatches (All Identical Pattern)
All 5 mismatches follow the **State of Control** pattern:
- **Deliverables:** State of Control pts. 1–5
- **Project owner:** Global State Productions
- **Initiative owner:** Global State Corp.
- **Root cause (semantic):** Productions *produces* the films for Corp's album initiative; film ownership ≠ music-label ownership.

This is **intentional design**, not data error. Per the reference matrix notes:
> "Owner ≠ producer: GS Corp owns [the music initiative]; GS Productions produces the films."

### Decision
**Option C (Defensive Aggregation) is REQUIRED.**

The dual-parent chain is not guaranteed to converge. Item 6's Q5 aggregation operator must handle Deliverables whose Initiative and Project belong to different Entities.

**Implication for design:** Aggregation buckets cannot assume a single Entity anchor per Deliverable. Must either:
1. Handle the cross-org case explicitly (bucket separately? reject? merge with priority rules?)
2. Define which parent (Initiative vs Project) is authoritative for Entity assignment
3. Require a tie-breaker rule in the deliverable itself

### Tiebreaker Rule (CONFIRMED 2026-08-20)

**Initiative's `owningEntityId` is authoritative for aggregation.**

When Initiative-path and Project-path Entities disagree, the Initiative path wins. Project's `owningEntityId` is available for Executing-Entity-specific views/reporting but does not compete with aggregation rollup.

**Rationale:** Existing Owning vs. Executing Entity doctrine — Owning Entity (via Initiative) holds Completion Value and strategic identity; Project's Entity represents execution only (non-gating). All 5 real disagreements follow the "Owner ≠ Producer" pattern (GS Productions executes for GS Corp's initiative), confirming the rule is sound and disagreements are intentional design, not data errors.

### Next Actions
1. ✓ Q5 & Q6 foundations resolved (no more open design questions before implementation)
2. → Item 2 scope-parameter PR (independent; proceed anytime)
3. → Item 6 design pass (now unblocked; all assumptions confirmed or operationalized)
