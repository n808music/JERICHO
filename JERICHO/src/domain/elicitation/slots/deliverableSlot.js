// Deliverable Intake Slot
// Locked definition: Clause 1 (exactly one Project), Clause 2 (exactly one Entity),
// Clause 3 (carries own target_date; phase is computed), Clause 4 (decomposes into Artifacts),
// Clause 6 (scheduling grain: buffers and dependencies attach).
//
// Input: six fixture properties (parent_project, executing_entity, target_date, description,
// buffer_anchor, buffer_binding). Gates enforce required vs optional per fill rate (100%, 100%,
// 100%, 44%, 32%, 32%). Buffer pair constraint: both present or both absent.

export const DELIVERABLE_SLOT = {
  name: 'deliverable',
  title: 'Deliverable',
  description: 'A shippable unit of work within a Project, executed by one Entity, with own target date and optional buffers.',
  fields: [
    {
      name: 'name',
      title: 'Deliverable Name',
      type: 'text',
      required: true,
      placeholder: 'e.g., "MVP Intake Complete"',
      helpText: 'Non-empty name, unique within the Project.',
    },
    {
      name: 'parent_project',
      title: 'Parent Project',
      type: 'projectSelector',
      required: true,
      helpText: 'Exactly one Project. Deliverable grain is scheduling; phase derives from parent Project.',
    },
    {
      name: 'executing_entity',
      title: 'Executing Entity',
      type: 'entitySelector',
      required: true,
      helpText: 'Entity responsible for this Deliverable. May differ from Project owner and varies across Deliverables.',
    },
    {
      name: 'target_date',
      title: 'Target Date',
      type: 'date',
      format: 'YYYY-MM-DD',
      required: true,
      helpText: 'Deliverable\'s own date. Phase is computed from parent Project\'s terminal date, not this date.',
    },
    {
      name: 'description',
      title: 'Description (What Ships)',
      type: 'text',
      required: false,
      placeholder: 'e.g., "Intake form and validation logic complete"',
      helpText: 'Context-awareness tier, never a gate. Optional.',
    },
    {
      name: 'buffer_anchor',
      title: 'Buffer Anchor',
      type: 'text',
      required: false,
      helpText: 'Optional. If provided, buffer_binding must also be provided (paired constraint). Names the blocking dependency.',
      conditional: { show: true },
    },
    {
      name: 'buffer_binding',
      title: 'Buffer Binding',
      type: 'dropdown',
      options: [
        { value: 'hard', label: 'Hard (blocks)' },
        { value: 'advisory', label: 'Advisory (delays)' },
      ],
      required: false,
      helpText: 'Optional. Must be provided if buffer_anchor is set. Governs how the buffer affects scheduling.',
      conditional: { when: 'buffer_anchor', is: 'present' },
    },
  ],
  gate: [
    {
      code: 'NAME_REQUIRED',
      title: 'Name Required',
      fieldName: 'name',
      check: (captured) => Boolean(captured?.name && String(captured.name).trim()),
      failureMessage: 'Enter a non-empty Deliverable name.',
    },
    {
      code: 'PROJECT_REQUIRED',
      title: 'Parent Project Required',
      fieldName: 'parent_project',
      check: (captured) => Boolean(captured?.parent_project),
      failureMessage: 'Select a parent Project.',
    },
    {
      code: 'ENTITY_REQUIRED',
      title: 'Executing Entity Required',
      fieldName: 'executing_entity',
      check: (captured) => Boolean(captured?.executing_entity),
      failureMessage: 'Select an executing Entity.',
    },
    {
      code: 'DATE_REQUIRED',
      title: 'Target Date Required',
      fieldName: 'target_date',
      check: (captured) => Boolean(captured?.target_date),
      failureMessage: 'Enter a target date.',
    },
    {
      code: 'DATE_VALID',
      title: 'Target Date Valid',
      fieldName: 'target_date',
      check: (captured) => {
        const d = captured?.target_date;
        if (!d) return true; // handled by DATE_REQUIRED
        if (!/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
        const date = new Date(d + 'T00:00:00Z');
        // Reject calendar-impossible dates: Feb 29 in non-leap years, April 31, June 31, etc.
        const [y, m, day] = d.split('-').map(Number);
        const daysInMonth = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
        if (m === 2 && ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0)) {
          daysInMonth[1] = 29; // leap year
        }
        return day >= 1 && day <= daysInMonth[m - 1];
      },
      failureMessage: 'Enter a valid date in YYYY-MM-DD format (e.g., 2027-09-15).',
    },
    {
      code: 'BUFFER_PAIR_CONSTRAINT',
      title: 'Buffer Pair Constraint',
      fieldName: 'buffer_anchor',
      check: (captured) => {
        const anchor = captured?.buffer_anchor;
        const binding = captured?.buffer_binding;
        const hasAnchor = Boolean(anchor && String(anchor).trim());
        const hasBinding = Boolean(binding);
        // Both or neither: if one is set, the other must be too.
        return (hasAnchor && hasBinding) || (!hasAnchor && !hasBinding);
      },
      failureMessage: 'Buffer anchor and buffer binding must both be provided or both be empty (paired constraint).',
    },
  ],
};

// Map a gate failure code to the field the engine should ask about next.
export function fieldNameForCode(code) {
  const found = DELIVERABLE_SLOT.gate.find((g) => g.code === code);
  return found?.fieldName || null;
}

// Build the DECLARE_DELIVERABLE payload from captured fields.
export function buildDeliverableDeclarePayload(captured) {
  // Generate a deterministic id from the captured name.
  const idSlug = String(captured?.name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return {
    id: `deliverable-${idSlug}`,
    name: captured.name,
    parent_project: captured.parent_project,
    executing_entity: captured.executing_entity,
    target_date: captured.target_date,
    description: captured.description ? String(captured.description).trim() : null,
    buffer_anchor: captured.buffer_anchor ? String(captured.buffer_anchor).trim() : null,
    buffer_binding: captured.buffer_binding || null,
    // Phase: never stored; computed at read time from parent Project's terminal date (Clause 3).
    // Depends On: handled separately via edge builder (canonical_edges, not Deliverable fields).
  };
}
