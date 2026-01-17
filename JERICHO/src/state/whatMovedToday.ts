type WhatMovedInput = {
  deliverableWorkspace?: {
    deliverables?: Array<{
      id: string;
      title: string;
      criteria?: Array<{
        id: string;
        text: string;
        isDone: boolean;
        doneAtDayKey?: string | null;
      }>;
    }>;
  } | null;
  dayKey: string;
};

export function deriveWhatMovedToday({ deliverableWorkspace, dayKey }: WhatMovedInput) {
  const deliverables = deliverableWorkspace?.deliverables || [];
  const criteriaClosed: Array<{ deliverableId: string; deliverableTitle: string; criterionId: string; text: string }> = [];
  const deliverablesAdvanced: Array<{ deliverableId: string; deliverableTitle: string; delta: number; total: number; done: number }> = [];
  const nextCriteria: Array<{ deliverableId: string; deliverableTitle: string; criterionId: string; text: string }> = [];

  deliverables.forEach((deliverable) => {
    const criteria = deliverable.criteria || [];
    const doneToday = criteria.filter((c) => c.isDone && c.doneAtDayKey === dayKey);
    const remaining = criteria.filter((c) => !c.isDone);
    if (doneToday.length) {
      doneToday.forEach((c) => {
        criteriaClosed.push({
          deliverableId: deliverable.id,
          deliverableTitle: deliverable.title || deliverable.id,
          criterionId: c.id,
          text: c.text || 'Criterion'
        });
      });
      const doneCount = criteria.filter((c) => c.isDone).length;
      deliverablesAdvanced.push({
        deliverableId: deliverable.id,
        deliverableTitle: deliverable.title || deliverable.id,
        delta: doneToday.length,
        total: criteria.length,
        done: doneCount
      });
    }
    if (remaining.length) {
      remaining.slice(0, 2).forEach((c) => {
        nextCriteria.push({
          deliverableId: deliverable.id,
          deliverableTitle: deliverable.title || deliverable.id,
          criterionId: c.id,
          text: c.text || 'Criterion'
        });
      });
    }
  });

  return { criteriaClosed, deliverablesAdvanced, nextCriteria: nextCriteria.slice(0, 3) };
}
