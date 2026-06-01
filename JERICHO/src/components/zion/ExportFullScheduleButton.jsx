import React, { useCallback, useState } from 'react';

import { useIdentityStore } from '../../state/identityStore';
import { buildFullHorizonScheduleExport } from '../../domain/masterPlan/exportFullHorizonSchedule.js';

function downloadJson(filename, payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

export default function ExportFullScheduleButton() {
  const state = useIdentityStore();
  const [status, setStatus] = useState(null);

  const onExport = useCallback(() => {
    setStatus(null);
    try {
      const result = buildFullHorizonScheduleExport(state);
      if (!result) {
        setStatus('No master plan with a derivable horizon.');
        return;
      }

      const plan = result.plan;
      const laneMap = {};
      for (const lane of result.lanes) {
        laneMap[lane.id] = {
          title: lane.title,
          domain: lane.domain,
          role: lane.role,
          activationState: lane.activationState,
          assessedStage: lane.assessedStage,
          userDescription: lane.userDescription,
          priorityScore: lane.priorityScore,
          milestoneCount: (lane.milestoneIds || []).length,
        };
      }

      const milestones = result.milestones
        .map((m) => ({
          id: m.id,
          laneId: m.laneId,
          laneTitle: laneMap[m.laneId]?.title || '(unknown)',
          title: m.title,
          description: m.description,
          milestoneType: m.milestoneType,
          targetDate: m.targetDate,
          flex: m.flex,
          status: m.status,
          missConsequence: m.missConsequence,
          origin: m.origin,
        }))
        .sort((a, b) => (a.targetDate || '').localeCompare(b.targetDate || ''));

      const cycleBlocks = (state.proposedBlocks || []).map((b) => ({
        id: b.id,
        dayKey: b.dayKey,
        startISO: b.startISO,
        endISO: b.endISO,
        durationMinutes: b.durationMinutes,
        title: b.title || b.label,
        expectedOutput: b.expectedOutput,
        domain: b.domain,
        blockType: b.blockType,
        flex: b.flex,
        missConsequence: b.missConsequence,
        laneTitle: laneMap[b.masterPlanLaneId]?.title || null,
        source: b.source,
      }));

      const fullHorizonBlocks = result.blocks
        .map((b) => ({
          id: b.id,
          dayKey: b.dayKey,
          phaseLabel: b.phaseLabel,
          laneId: b.laneId || b.masterPlanLaneId || null,
          laneTitle:
            b.laneLabel ||
            laneMap[b.laneId]?.title ||
            laneMap[b.masterPlanLaneId]?.title ||
            null,
          blockType: b.blockType,
          title: b.title,
          expectedOutput: b.expectedOutput,
          durationMinutes: b.durationMinutes ?? b.timeEstimateMinutes ?? null,
          producesArtifact: b.producesArtifact,
          consumedBy: b.consumedBy,
          owner: b.owner,
          passEvidence: b.passEvidence,
          dependsOn: b.dependsOn,
          unlocks: b.unlocks,
          commitmentState: b.commitmentState,
          executionEligibility: b.executionEligibility,
          source: b.source,
          titleFamily: b.titleFamily,
        }))
        .sort((a, b) => {
          const dayA = a.dayKey || '';
          const dayB = b.dayKey || '';
          if (dayA !== dayB) {return dayA.localeCompare(dayB);}
          return (a.title || '').localeCompare(b.title || '');
        });

      const bundle = {
        meta: {
          extractedAtISO: new Date().toISOString(),
          viewDate: state.viewDate,
          activeGoalId: state.activeGoalId,
          activeCycleId: state.activeCycleId,
          goalLifecycleState: state.goalLifecycleState,
          scheduleLifecycle: state.scheduleLifecycle,
          selectedHorizonMode: state.selectedHorizonMode,
          strategicHorizonEndDayKey: state.strategicHorizonEndDayKey,
          qualityPolicyIdApplied: state.qualityPolicyIdApplied,
          qualityScoreApplied: state.qualityScoreApplied,
          qualityScoreAppliedByComponent: state.qualityScoreAppliedByComponent,
          agendaVersionId: result.agendaVersionId,
          range: result.range,
        },
        masterPlan: {
          id: plan.id,
          title: plan.title,
          status: plan.status,
          horizonStart: plan.horizonStart,
          horizonEnd: plan.horizonEnd,
          fullHorizonEndDayKey: plan.fullHorizonEndDayKey,
          declaredHorizonMonths: plan.declaredHorizonMonths,
          northStarOutcome: plan.northStarOutcome,
          coreMission: plan.coreMission,
          outcomeTarget: plan.outcomeTarget,
          successStandard: plan.successStandard,
          masterPlanSummary: plan.masterPlanSummary,
          controllabilityClass: plan.controllabilityClass,
          terminalTargetClass: plan.terminalTargetClass,
          controllableSuccessSignals: plan.controllableSuccessSignals,
          externallyMediatedTargets: plan.externallyMediatedTargets,
          goalArchitecture: plan.goalArchitecture,
          executionModel: plan.executionModel,
          primaryLane: plan.primaryLane,
          supportingLanes: plan.supportingLanes,
          officialStartDate: plan.officialStartDate,
          scheduleAppliedDate: plan.scheduleAppliedDate,
          nonNegotiables: plan.nonNegotiables,
          anchors: plan.anchors,
        },
        summary: result.summary,
        lanes: laneMap,
        milestones,
        cycleBlocks,
        fullHorizonBlocks,
        cycleSummary: state.cycle || [],
      };

      const slug = (plan.title || 'master-plan')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
      const today = new Date().toISOString().slice(0, 10);
      downloadJson(`jericho-${slug}-full-schedule-${today}.json`, bundle);

      setStatus(`Exported ${fullHorizonBlocks.length} blocks.`);
    } catch (err) {
      setStatus(`Export failed: ${err?.message || String(err)}`);
    }
  }, [state]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onExport}
        className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent"
        title="Download the full master-plan schedule as JSON"
      >
        Export Full Schedule
      </button>
      {status ? <span className="text-[11px] text-muted">{status}</span> : null}
    </span>
  );
}
