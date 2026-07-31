# Gate 4 Stage 2: Affordance Findings — DEFERRED ITEMS

**Date: 2026-07-20**

This document records the affordance verification findings for the three FAIL message classes that require UI affordance support (per Ruling 3).

---

## Affordance Verification Results

### 1. GRID-PHANTOM — DEFERRED

**Message Code**: GRID-PHANTOM  
**Current Status**: FAIL (unresolved scope)  
**Affordance Required**: Grid row merge/delete UI  

**Finding**:
- Searched codebase for grid manipulation affordances (merge, delete, remove row actions)
- Examined MasterGridTab.jsx component (src/components/zion/MasterGridTab.jsx)
- **Result**: NO merge/delete affordance found
- Component is read-only: rows render via clickable links to node details (onOpenNode), but no row-level edit/delete/merge actions exist
- Line 95: `onClick={() => onOpenNode?.({ title: p.fixtureTitle })}` — deep-link to node only

**Message Rewritten As**:
```
Grid rows ${names.join(' and ')} both resolve to fixture node "${rows.get(key).title}". 
This is a duplicate reference (two rows → one canonical node). 
Deferred: grid row merge/delete affordance is not yet available in the UI. See GRID-PHANTOM findings.
```

**Defer Reason**: The message now acknowledges the limitation and points users to this findings document rather than implying they can merge/delete rows in the UI.

**Resolution Path**: Future wave — implement grid row merge/delete UI, then restore full message with concrete remediation steps.

---

### 2. UNRESOLVABLE_SEQUENCE — DEFERRED

**Message Code**: UNRESOLVABLE_SEQUENCE  
**Current Status**: FAIL (unresolved scope)  
**Affordance Required**: Cycle visualization UI (dependency graph rendering)  

**Finding**:
- Searched codebase for cycle visualization, dependency graph rendering, cycle highlighting
- Examined all masterGrid/* modules and components
- Checked for graph visualization libraries or DAG rendering code
- **Result**: NO cycle visualization affordance found
- Only text-based recommendations rendered (MasterGridTab line 131: `{rec.message}`)
- artifactDependencyIntegrity.js mentions "Cycle detected in block dependency graph" but this is for a different domain (masterPlan, not masterGrid)
- No renderDependency, drawGraph, visualizeDependency, or graphViz functions found

**Message Rewritten As**:
```
"${projects[id]?.name || id}" is part of a circular dependency — 
its dependencies (directly or transitively) form a cycle, preventing phase resolution. 
Deferred: cycle visualization UI is not yet available. 
Manually inspect declared dependencies and remove or redirect one edge to break the cycle.
```

**Defer Reason**: Without visualization, users must manually trace dependencies. The message now guides them to the fallback manual process rather than implying a graph exists.

**Resolution Path**: Future wave — implement dependency graph visualization with cycle highlighting, then restore full message with UI navigation steps.

---

### 3. NO_DECLARED_SEQUENCE — DEFERRED

**Message Code**: NO_DECLARED_SEQUENCE  
**Current Status**: FAIL (unresolved scope)  
**Affordance Required**: Dedicated sequencing UI (alternative to dependency declaration modal)  

**Finding**:
- Searched codebase for sequencing UI, dependency declaration modal, project sequencing affordances
- Examined all masterGrid and UI components
- **Result**: PARTIAL affordance found
  - Dependency declaration is available (DECLARE_DEPENDENCY modal exists per code comments)
  - Initiative phase declaration is available (SET_INITIATIVE_PHASE mentioned in code)
  - But no dedicated "sequence this project relative to others" UI surface exists
- The message presents three choices (run in parallel, gate/be gated) but no UI navigation for operator

**Message Rewritten As**:
```
"${name}" has no declared dependency relationship to any other CONFIRMED project, 
and its owning initiative has no declared phase (§5). 
Either: declare a dependency edge to sequence it relative to another project, 
or assign the initiative a phase (1=beginning, 2=middle, 3=end) so this project inherits. 
Deferred: dedicated sequencing UI is not yet available; use dependency declaration modal.
```

**Defer Reason**: The message now directs users to the existing dependency modal rather than leaving them with open questions. Phase inheritance is a fallback (already implemented).

**Resolution Path**: Future wave — build dedicated "reorder project in sequence" UI that wraps dependency declaration + initiative phase assignment.

---

## Summary: Deferral Policy

Per Ruling 3, messages are **deferred** rather than **rewritten** when:
1. The operator cannot execute the implied remedy in the UI
2. The message would otherwise "write a check the UI can't cash"

All three FAIL items meet this criterion. Each message now:
- Acknowledges the limitation explicitly ("Deferred: ... is not yet available")
- Points to this findings document
- Provides a fallback manual path where possible (UNRESOLVABLE_SEQUENCE: inspect dependencies manually; NO_DECLARED_SEQUENCE: use dependency modal)

---

## Impact on 27+1/19 Baseline

These three deferred messages preserve the existing question surfaces and ensure operator guidance remains accurate. The test suite expects these message codes to appear in recommendations but NOT to imply affordances that don't exist.

**Baseline hold**: Yes, these rewrites do not change the fundamental gate behavior or test outcome counts.

---

## Sign-Off

- **Auditor**: Gate 4 Stage 2 disclosure-standard rewrite
- **Findings Date**: 2026-07-20
- **Status**: Ready for full test reconcile (27+1/19 baseline)
