export type DeliverableLink = { deliverableId?: string | null; criterionId?: string | null };

export const DELIVERABLE_DOMAINS = ['BODY', 'RESOURCES', 'FOCUS', 'CREATION'] as const;

export function getDeliverableWorkspace(
  deliverablesByCycleId: Record<string, any> | undefined,
  cycleId: string | null | undefined
) {
  if (!cycleId || !deliverablesByCycleId) return null;
  return deliverablesByCycleId[cycleId] || null;
}

export function getDeliverablesForCycle(
  deliverablesByCycleId: Record<string, any> | undefined,
  cycleId: string | null | undefined
) {
  const workspace = getDeliverableWorkspace(deliverablesByCycleId, cycleId);
  return workspace?.deliverables || [];
}

export function getDeliverableById(deliverables: any[] = [], deliverableId?: string | null) {
  if (!deliverableId) return null;
  return deliverables.find((d) => d.id === deliverableId) || null;
}

export function getCriteriaForDeliverable(deliverables: any[] = [], deliverableId?: string | null) {
  const deliverable = getDeliverableById(deliverables, deliverableId);
  return deliverable?.criteria || [];
}

export function getSuggestionLinkForCycle(
  deliverablesByCycleId: Record<string, any> | undefined,
  cycleId: string | null | undefined,
  suggestionId: string | null | undefined
): DeliverableLink | null {
  if (!cycleId || !suggestionId) return null;
  const workspace = getDeliverableWorkspace(deliverablesByCycleId, cycleId);
  if (!workspace?.suggestionLinks) return null;
  return workspace.suggestionLinks[suggestionId] || null;
}
