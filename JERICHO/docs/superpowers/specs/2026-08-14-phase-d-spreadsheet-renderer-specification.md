# Phase D: Matrix Spreadsheet Renderer — Design Specification

**Date:** 2026-08-14  
**Status:** Specification (awaiting approval before implementation)  
**Subject:** Enterprise planning matrix display — 7 node types, 175+ rows, 23+ fields per type

---

## Design Vision

**Single job:** Read the complete enterprise planning matrix from state.matrix and render it as a structured, scannable reference matching the reference sheet's own tab-based organization. The matrix is the authoritative source of truth for capacity planning and cross-functional coordination — this display makes it legible to a human at a glance.

**Subject matter:** This is operational data — projects, deliverables, system dependencies, convergence targets. Not sales dashboards or marketing analytics. The design should feel precise, businesslike, and structured. The visual priority is **scanability and depth** (many rows, many columns), not visual drama.

---

## Design Proposal

### 1. Tab Navigation Pattern

**Proposal:** Literal horizontal tab bar, matching the reference sheet's own organization.

**Rationale:** The reference sheet itself uses a tab bar (Entities | Initiatives | Projects | Deliverables | Artifacts | Systems | Convergence). Matching that mental model reduces cognitive load — the UI matches the operator's existing reference. No translation layer needed.

**Visual treatment:** 
- Simple horizontal tabs above the grid
- Active tab underlined or highlighted
- Inactive tabs muted (lower contrast)
- Tab names match reference sheet names exactly

---

### 2. Scale Handling — Virtualized Scrolling with Dynamic Collapse Support

**Proposal:** React-Window virtualized scrolling (or equivalent). Render only visible rows + buffer, with support for dynamic row-count changes from collapse/expand.

**Rationale:** 
- Artifacts: 119+ rows
- Initiatives: 29+ rows
- Real data sets will grow beyond these numbers

Rendering all rows at once (naive approach) causes jank and memory bloat. Virtualization solves this: O(visible rows) rendering, not O(total rows).

**Critical interaction: virtualization + collapse compatibility**

Collapsible groups (item 3) change the visible row count dynamically as users expand/collapse. Standard react-window assumes a fixed row count. **Implementation must account for:**

1. **Computed row visibility:** Before virtualization calculates indices, compute which rows are visible (non-collapsed) vs hidden
2. **Dynamic row count:** Track collapsed state per parent; recalculate visible row count when state changes
3. **Scroll offset preservation:** When a group collapses/expands, preserve scroll position (scroll to the parent row that changed state, not back to top)

**Implementation approach:**
- Filter the row dataset dynamically based on collapse state
- Pass the filtered list to react-window's FixedSizeList
- On collapse/expand, recompute the filtered list, update virtualization, preserve scroll position
- Alternative (simpler): Use VariableSizeList if row heights vary, but collapsible groups with fixed 40px rows don't require this

**Parameters:**
- `react-window` FixedSizeList or VariableSizeList
- Row height: 40px (compromise between density and readability; parents and children same height)
- Buffer: render ±10 rows off-screen to prevent flicker on scroll
- Smooth scroll behavior, keyboard navigation (arrow keys, Page Up/Down, Home/End)
- Collapse state stored in component state (not Redux/global, local UI state only)

---

### 3. Parent-Grouping Visual Rendering

**Proposal:** Collapsible group headers with indentation, **default-expanded**.

**Rationale:**
- The sort doctrine clusters related rows (e.g., a Project's Deliverables stay adjacent)
- Flat sorted list makes the clustering invisible — a human scanning doesn't know why rows are adjacent
- Collapsible groups make the hierarchy legible and reduce cognitive load on large datasets
- Operators can focus on one parent's children without scrolling past unrelated siblings

**Default state — CRITICAL:** Groups render **expanded by default**. Full detail is visible immediately. Collapse is a power-user option to reduce clutter when wanted, not the default hidden state. This preserves the cell-for-cell fidelity that was specifically required (item 3 original plan).

**Visual pattern:**
```
[Project] Phase 1 Backend (parent row, disclosure ▼ = expanded)
  │ └─ [Deliverable] Database schema design      (owningProjectId: p1, indented)
  │ └─ [Deliverable] API contract definition     (owningProjectId: p1, indented)
  │ └─ [Deliverable] Integration test suite      (owningProjectId: p1, indented)
[Project] Phase 1 Frontend (parent row, disclosure ▼ = expanded)
  │ └─ [Deliverable] Component library            (owningProjectId: p2, indented)
  ... (all groups expanded by default)
```

**Interaction:**
- Parent rows have disclosure triangle (▼ when expanded, ▶ when collapsed)
- Click triangle to toggle collapse/expand (collapse is optional, not default)
- Children rows indented +20px
- Collapsed state persists in sessionStorage (convenience, not persistence)
- All groups start expanded on page load

---

### 4. Computed-Selector Column Distinction

**Proposal:** Visual badge + tooltip on hover.

**Columns affected:**
- **Projects tab:** "Executing Entity" column (derived from Deliverables)
- **Convergence tab:** "Owning Initiatives" column (derived from fromNodeIds)

**Visual treatment:**
- Small **🔗 icon** before the value (linking symbol, indicates derived)
- Muted text color (70% opacity vs 100% for stored fields)
- Hover tooltip: "Derived from child rows (not editable)"
- Field is read-only (no edit affordance)

**Rationale:** Operators need to know this field is computed, not stored. The icon + muted styling + tooltip creates a clear signal without cluttering the row.

---

### 5. Empty/Null Field Handling

**Proposal:** Blank cells render as clean whitespace. No "null", "—", or placeholder text.

**Rationale:**
- Most rows won't have every field populated (e.g., Notes is optional, many rows won't have it)
- Showing placeholders clutters the view and makes it harder to scan
- Whitespace is the default; content appears when present
- Blank cell = field not populated for this row (clear, clean)

**Implementation:**
- Empty string rendered as nothing (whitespace only)
- Optional boolean fields (e.g., requiresLegalFormation): show as checkbox (checked/unchecked/null) or badge ("Legal formation required") when true, blank when false/null
- Null fields and empty strings both render blank — no distinction needed

---

## Column Layout Reference

**All tabs include:**
- Index column (row #, for reference; always visible on scroll)
- Name column (primary key identifier)
- Ownership/Parent column (varies per type; see below)
- Phase, Date, Status columns (varies per type)
- Notes column (universal, optional)
- Computed columns where applicable

**Per-type column order (left to right):**

| Type | Columns |
|------|---------|
| **Entity** | # | Name | Legal Status | Formation State | Status | Phase | Description | Notes |
| **Initiative** | # | Name | Owning Entity | Function | Purpose | Completion Value | Ongoing Output | Terminal Deadline | Next Milestone | Phase | Notes |
| **Project** | # | Name | Owning Entity | Parent Initiative | Terminal Date | Description | Phase | **Executing Entity** (derived) | Notes |
| **Deliverable** | # | Name | Parent Project | Parent Initiative | Work State | Target Date | Phase | Status | Notes |
| **Artifact** | # | Name | Parent Deliverable(s) | Satisfaction Mode | Target Date | Status | Notes |
| **System** | # | Name | Owning Entity | Mechanism | Feeds Into | Phase | Status | Notes |
| **Convergence** | # | Name | Source IDs | **Owning Initiatives** (derived) | Target Date | Status | Notes |

---

## Responsive Behavior

**Desktop (≥1200px):** Full grid, all columns visible, horizontal scroll for overflow

**Tablet (768–1199px):** Priority columns visible; secondary columns (Description, Notes, Function) hidden by default, expandable via row click

**Mobile (<768px):** Card view per row; tabs become vertical list or dropdown selector

---

## Interactions Summary

| Action | Behavior |
|--------|----------|
| Click parent row | Toggle collapse/expand children (if applicable) |
| Click disclosure triangle | Collapse/expand child rows |
| Hover computed column | Tooltip: "Derived from child rows (not editable)" |
| Scroll within virtualized list | Buffer rows load/unload smoothly |
| Keyboard: Arrow up/down | Navigate rows |
| Keyboard: Home/End | Jump to first/last row |
| Keyboard: Page Up/Down | Scroll 1 viewport up/down |

---

## Signature Design Choice

**The unique element this UI will be remembered by:**

The **collapsible parent-grouping** structure makes the enterprise hierarchy visible in the data itself. Rather than presenting a flat sorted list (which could look like any data table), the tree-like disclosure interaction embodies the "cascading dependencies" nature of this matrix — you can see at a glance that Deliverables belong to Projects, Projects belong to Initiatives, etc. The collapse/expand affordance is the signature: it's not decoration, it's the structural embodiment of the data's own organization.

---

## Critical Clarifications (Added)

**Default-expanded groups:** Groups render expanded by default on page load, preserving full cell-for-cell detail (per item 3 original requirement). Collapse is a power-user option to reduce clutter when wanted, not the hidden default.

**Virtualization + collapse interaction:** React-window must account for dynamic row counts as groups expand/collapse. Implementation requires:
- Computed row visibility (filter based on collapse state before virtualization)
- Dynamic row count recalculation on state change
- Scroll position preservation when groups collapse/expand

---

## Questions for Approval

1. ✅ **Tab navigation:** Literal horizontal tab bar — approved
2. ✅ **Virtualization:** React-Window, 40px row height, **dynamic collapse support** — approved?
3. ✅ **Grouping:** Collapsible parents with indentation, **default-expanded** — approved?
4. ✅ **Computed columns:** 🔗 icon + muted styling + tooltip — approved
5. ✅ **Null handling:** Blank cells as whitespace only — approved

---

**Next step:** Final approval on items 2 & 3 (with clarifications above), then implementation begins with component architecture (ReactTable + react-window integration, collapse state management, selector layer for derived columns, sort/filter logic).
