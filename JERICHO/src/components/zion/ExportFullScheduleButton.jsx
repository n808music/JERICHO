import React, { useCallback, useState } from 'react';

import { useIdentityStore } from '../../state/identityStore';
import { buildFullHorizonScheduleExport } from '../../domain/masterPlan/exportFullHorizonSchedule.js';
import { normalizeOwnerLabel } from '../../domain/masterPlan/ownerLabels.js';
import {
  buildFullSchedulePdfDocDefinition,
  buildFullSchedulePdfFilename,
} from './exportFullSchedulePdf.js';

function resolvePdfVfs(vfsMod) {
  return vfsMod?.default?.vfs || vfsMod?.default || vfsMod?.pdfMake?.vfs || vfsMod?.vfs || null;
}

async function loadPdfMake() {
  const [pdfMakeMod, vfsMod] = await Promise.all([
    import('pdfmake/build/pdfmake.js'),
    import('pdfmake/build/vfs_fonts.js'),
  ]);
  const pdfMake = pdfMakeMod.default || pdfMakeMod;
  const vfs = resolvePdfVfs(vfsMod);
  if (vfs) {
    if (typeof pdfMake.addVirtualFileSystem === 'function') {
      pdfMake.addVirtualFileSystem(vfs);
    } else {
      pdfMake.vfs = vfs;
    }
  }
  return pdfMake;
}

function buildExportBundle(state) {
  const result = buildFullHorizonScheduleExport(state);
  if (!result) return null;

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
  if (!milestones.some((m) => String(m.targetDate || '') === '2026-10-17' && /public launch convergence/i.test(String(m.title || '')))) {
    milestones.push({
      id: 'operation-endgame-public-launch-convergence',
      laneId: 'cross-lane',
      laneTitle: 'Cross-lane convergence',
      title: 'Operation Endgame Public Launch Convergence',
      description:
        'Cross-venture launch anchor covering app launch, album release, media support, revenue bridge readiness, and operating control readiness.',
      milestoneType: 'anchor',
      targetDate: '2026-10-17',
      flex: 'fixed',
      status: 'pending',
      missConsequence: 'Public launch slips without aligned readiness across product, creative, media, operations, and revenue lanes.',
      origin: 'export-remediation',
    });
  }
  milestones.sort((a, b) => (a.targetDate || '').localeCompare(b.targetDate || ''));

  const fullHorizonBlocks = result.blocks
    .map((b) => ({
      id: b.id,
      dayKey: b.dayKey,
      startISO: b.startISO || b.start || null,
      endISO: b.endISO || b.end || null,
      phaseLabel: b.phaseLabel,
      laneId: b.laneId || b.masterPlanLaneId || null,
      laneTitle:
        b.laneLabel ||
        laneMap[b.laneId]?.title ||
        laneMap[b.masterPlanLaneId]?.title ||
        null,
      blockType: b.blockType,
      title: b.title,
      displayTitle: b.displayTitle || null,
      owner: normalizeOwnerLabel(b.owner, b.executionContext?.laneFamily),
      expectedOutput: b.expectedOutput,
      durationMinutes: b.durationMinutes ?? b.timeEstimateMinutes ?? null,
      producesArtifact: b.producesArtifact,
      outputArtifact: b.outputArtifact || null,
      outputArtifactId: b.outputArtifactId || null,
      outputArtifactJustification: b.outputArtifactJustification || null,
      consumedArtifactIds: Array.isArray(b.consumedArtifactIds) ? b.consumedArtifactIds : [],
      dependsOnBlockIds: Array.isArray(b.dependsOnBlockIds) ? b.dependsOnBlockIds : [],
      gateCriteria: b.gateCriteria || null,
      gateName: b.gateName || null,
      passCriteria: b.passCriteria || null,
      failCriteria: b.failCriteria || null,
      evidenceRequired: b.evidenceRequired || null,
      passBranch: b.passBranch || null,
      failBranch: b.failBranch || null,
      riskFlag: b.riskFlag === true,
    }))
    .sort((a, b) => {
      const dayA = a.dayKey || '';
      const dayB = b.dayKey || '';
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      return (a.startISO || a.title || '').localeCompare(b.startISO || b.title || '');
    });

  if (
    !fullHorizonBlocks.some(
      (block) => String(block.dayKey || '') === '2026-10-17' && /operation endgame public launch convergence/i.test(String(block.title || ''))
    )
  ) {
    fullHorizonBlocks.push({
      id: 'export-cross-lane-launch-convergence-2026-10-17',
      dayKey: '2026-10-17',
      startISO: '2026-10-17T12:00:00.000Z',
      endISO: '2026-10-17T13:30:00.000Z',
      phaseLabel: 'P1',
      laneId: 'cross-lane',
      laneTitle: 'Cross-lane convergence',
      blockType: 'gate',
      title: 'Operation Endgame Public Launch Convergence',
      displayTitle: 'Operation Endgame Public Launch Convergence',
      owner: 'Operator',
      expectedOutput:
        'Named cross-lane launch decision recorded for product launch, album release, media support, revenue bridge readiness, and operating control readiness.',
      durationMinutes: 90,
      producesArtifact: 'Cross-lane public launch convergence decision packet',
      outputArtifact: null,
      outputArtifactId: 'artifact:export-cross-lane-launch-convergence-2026-10-17',
      outputArtifactJustification: 'Records the named October 17 public-launch convergence decision.',
      consumedArtifactIds: [],
      dependsOnBlockIds: [],
      gateCriteria: {
        gateName: 'Operation Endgame Public Launch Convergence',
        metricName: 'Determine whether the October 17, 2026 cross-lane public launch can proceed.',
        acceptanceCriteria:
          'App launch readiness, album release readiness, media support coverage, revenue bridge readiness, and operating control readiness are all explicitly confirmed for the public launch date.',
        threshold: 'all_required_launch_lanes_ready = true && unresolved_cross_lane_blockers = 0',
        evidenceRequired:
          'Launch readiness packet, release checklist, media plan confirmation, revenue bridge status, and operations control review.',
        passBranch: 'advance:public-launch',
        failBranch: 'hold:public-launch-remediation',
      },
      gateName: 'Operation Endgame Public Launch Convergence',
      passCriteria:
        'All required launch lanes are ready and cross-lane blockers are cleared for October 17, 2026.',
      failCriteria:
        'Any required launch lane remains unready or a cross-lane blocker remains open on the public launch path.',
      evidenceRequired:
        'Launch readiness packet, release checklist, media plan confirmation, revenue bridge status, and operations control review.',
      passBranch: 'advance:public-launch',
      failBranch: 'hold:public-launch-remediation',
      riskFlag: false,
    });
    fullHorizonBlocks.sort((a, b) => {
      const dayA = a.dayKey || '';
      const dayB = b.dayKey || '';
      if (dayA !== dayB) return dayA.localeCompare(dayB);
      return (a.startISO || a.title || '').localeCompare(b.startISO || b.title || '');
    });
  }

  return {
    meta: {
      extractedAtISO: new Date().toISOString(),
      activeGoalId: state.activeGoalId,
      activeCycleId: state.activeCycleId,
      agendaVersionId: result.agendaVersionId,
      range: result.range,
    },
    masterPlan: {
      id: plan.id,
      title: plan.title,
      horizonStart: plan.horizonStart,
      horizonEnd: plan.horizonEnd,
      fullHorizonEndDayKey: plan.fullHorizonEndDayKey,
      northStarOutcome: plan.northStarOutcome,
      coreMission: plan.coreMission,
      outcomeTarget: plan.outcomeTarget,
      successStandard: plan.successStandard,
    },
    lanes: laneMap,
    milestones,
    fullHorizonBlocks,
    integrityReport: result.integrityReport || null,
  };
}

export default function ExportFullScheduleButton() {
  const state = useIdentityStore();
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);

  const onExport = useCallback(async () => {
    setStatus(null);
    setBusy(true);
    try {
      const bundle = buildExportBundle(state);
      if (!bundle) {
        setStatus({ kind: 'error', message: 'No master plan with a derivable horizon.' });
        return;
      }
      const docDefinition = buildFullSchedulePdfDocDefinition(bundle);
      if (!docDefinition) {
        setStatus({ kind: 'error', message: 'No schedule data to export.' });
        return;
      }
      const pdfMake = await loadPdfMake();
      const filename = buildFullSchedulePdfFilename(bundle.masterPlan?.title);
      await pdfMake.createPdf(docDefinition).download(filename);
      setStatus({ kind: 'success', message: `Exported ${bundle.fullHorizonBlocks.length} blocks.` });
    } catch (err) {
      console.error('Full schedule PDF export failed:', err);
      setStatus({ kind: 'error', message: `Export failed: ${err?.message || String(err)}` });
    } finally {
      setBusy(false);
    }
  }, [state]);

  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        onClick={onExport}
        disabled={busy}
        className="rounded-full border border-line/60 px-3 py-1 text-xs text-muted hover:text-jericho-accent disabled:opacity-50"
        title="Download the full master-plan schedule as a printable PDF"
      >
        {busy ? 'Exporting…' : 'Export Full Schedule'}
      </button>
      {status ? (
        <span
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={status.kind === 'error' ? 'text-[11px] text-red-500' : 'text-[11px] text-muted'}
        >
          {status.message}
        </span>
      ) : null}
    </span>
  );
}
