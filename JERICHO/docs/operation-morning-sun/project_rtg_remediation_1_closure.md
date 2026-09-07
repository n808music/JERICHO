---
name: project-rtg-remediation-1-closure
description: RTG Remediation
metadata: 
  node_type: memory
  type: project
  originSessionId: 9223bd0b-baf9-4b78-9e21-291040062b87
---

RTG Remediation #1 closed **RTG_PASSED** on 2026-06-04 for the Artifact Dependency + Phase Gate Integrity work.

**Stamped IMPLEMENTED in this pass:**
- Stable block-ID dependency substrate — block IDs are canonical producer references, not incidental labels
- Artifact registry foundation — `outputArtifact`, `outputArtifactId`, `consumedArtifactIds`, `dependsOnBlockIds`
- Produce-before-consume enforcement — 0 unresolved consumed artifacts, 0 missing required outputArtifact, 1064 consuming blocks with resolved upstream links, 922 artifacts in the live Operation Endgame fixture
- Measurable gate criteria — metric name, threshold, evidence artifact, owner, pass branch, fail branch, acceptance criteria
- Phase exit criteria coverage — P1/P2/P3 no longer generic locks; aggregation exists
- Formal export contract upgrade — chart/export exposes Block ID, Output artifact, Consumed artifacts, Gate criteria while preserving owner/type/lineage/scheduled time

**Quality stack now passing all six levels:** plan substrate, owner/type/lineage projection, work-window schedule validity, first-cycle start activation, artifact dependency truth, phase gate integrity.

**Why:** This closed the distinction the initiative was protecting — *"Formal polish is not execution truth. Execution truth requires IDs, artifacts, producer/consumer links, measurable gates, and dependency enforcement."* That layer now exists at the data level.

**How to apply:** Treat the artifact substrate as authoritative going forward. If a downstream layer (UI, scoring, export) appears to show duplicate or decorative dependencies, the bug is in the projection/render path, not in upstream artifact data — investigate projection, not substrate. See [[feedback-rtg-run-the-goal]] for the verification convention.

**Boundary — explicitly NOT closed in this pass:**
- Deeper SDLC/commercial pathway richness
- Duplicate calendar rendering issue (visible-surface only; substrate is correct)

**Next initiative options:**
- **A. RTG Calendar UI Duplicate Rendering Remediation #1** — visible-surface fix; user trust breaks at the calendar even though substrate is clean
- **B. RTG SDLC + Commercial Decomposition Remediation #1** — deepen product/software and capital/BD lanes now that artifact truth exists

Recommended order: A before B. Duplicate render would otherwise mask whether B's decomposition is correct.

**Adjacent unresolved concern (separate initiative, not RTG):** auth containment — user was kicked out mid-cycle and could neither log in nor create account; tracked as a stabilization issue distinct from artifact integrity.
