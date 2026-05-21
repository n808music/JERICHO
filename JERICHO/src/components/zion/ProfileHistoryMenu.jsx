import React, { useEffect, useMemo, useState } from 'react';

const DEFAULT_PROFILE_DISPLAY_NAME = 'Local Profile';

function formatDay(value) {
  const text = String(value || '').trim();
  if (!text) {
    return 'Unknown';
  }
  const normalized = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T12:00:00.000Z` : text;
  const date = new Date(normalized);
  if (!Number.isFinite(date.getTime())) {
    return text;
  }
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function formatCycleState(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return 'Unknown';
  }
  if (raw === 'active') return 'Active';
  if (raw === 'ended') return 'Ended';
  if (raw === 'archived') return 'Archived';
  if (raw === 'deleted') return 'Deleted';
  return raw.replace(/_/g, ' ');
}

function formatTitleStatus(value) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) {
    return 'Unspecified';
  }
  return raw
    .split('_')
    .map((token) => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

function resolveCycleSortKey(cycle) {
  return (
    cycle?.archivedAtISO ||
    cycle?.endedAtISO ||
    cycle?.startedAtISO ||
    cycle?.createdAtISO ||
    cycle?.startedAtDayKey ||
    cycle?.goalContract?.startDayKey ||
    ''
  );
}

function getGoalDisplayLabel(goal, cycle) {
  return (
    goal?.title ||
    cycle?.goalContract?.goalLabel ||
    cycle?.goalContract?.goalText ||
    cycle?.goalGovernanceContract?.goalText ||
    goal?.id ||
    cycle?.goalId ||
    'Untitled goal'
  );
}

function getCycleLabel(cycle, goal) {
  return (
    cycle?.title ||
    cycle?.definiteGoal?.outcome ||
    getGoalDisplayLabel(goal, cycle)
  );
}

function getProfileDisplayName(profile) {
  return String(profile?.displayName || profile?.label || DEFAULT_PROFILE_DISPLAY_NAME).trim() || DEFAULT_PROFILE_DISPLAY_NAME;
}

function SummaryPill({ label, value }) {
  return (
    <div className="rounded-lg border border-line/50 bg-white px-3 py-2">
      <p className="text-[10px] uppercase tracking-[0.12em] text-muted">{label}</p>
      <p className="text-sm font-semibold text-jericho-text">{value}</p>
    </div>
  );
}

function HistoryRow({ title, subtitle, meta, badge = null, action = null }) {
  return (
    <div className="rounded-xl border border-line/50 bg-white px-3 py-2">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-jericho-text">{title}</p>
          <p className="text-[11px] text-muted">{subtitle}</p>
          {meta ? <p className="mt-1 truncate text-[10px] text-muted/80">{meta}</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {badge}
          {action}
        </div>
      </div>
    </div>
  );
}

export default function ProfileHistoryMenu({
  profile = null,
  activeProfileId = null,
  activeGoalId = null,
  activeMasterPlanId = null,
  activeCycleId = null,
  goalsById = {},
  masterPlansById = {},
  cyclesById = {},
  onSelectCycle = null,
  onUpdateProfile = null,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [displayNameDraft, setDisplayNameDraft] = useState('');
  const [roleLabelDraft, setRoleLabelDraft] = useState('');

  const profileDisplayName = getProfileDisplayName(profile);
  const roleLabel = String(profile?.roleLabel || '').trim();
  const needsProfileSetup = !profile?.displayName || profileDisplayName === DEFAULT_PROFILE_DISPLAY_NAME;

  useEffect(() => {
    setDisplayNameDraft(profileDisplayName === DEFAULT_PROFILE_DISPLAY_NAME && !profile?.displayName ? '' : profileDisplayName);
    setRoleLabelDraft(roleLabel);
  }, [profileDisplayName, roleLabel, profile?.displayName]);

  useEffect(() => {
    if (isOpen && needsProfileSetup) {
      setIsEditingProfile(true);
    }
  }, [isOpen, needsProfileSetup]);

  const profileGoalIds = Array.isArray(profile?.goalIds) ? profile.goalIds.filter(Boolean) : [];
  const profileMasterPlanIds = Array.isArray(profile?.masterPlanIds) ? profile.masterPlanIds.filter(Boolean) : [];

  const goalRecords = useMemo(
    () =>
      profileGoalIds.map((goalId) => {
        const goal = goalsById?.[goalId] || null;
        const cycle = goal?.activeCycleId ? cyclesById?.[goal.activeCycleId] || null : null;
        return {
          id: goalId,
          goal,
          cycle,
          label: getGoalDisplayLabel(goal, cycle),
          isActive: goalId === activeGoalId || goalId === profile?.activeGoalId,
        };
      }),
    [profileGoalIds, goalsById, cyclesById, activeGoalId, profile?.activeGoalId]
  );

  const masterPlanRecords = useMemo(
    () =>
      profileMasterPlanIds.map((planId) => ({
        id: planId,
        plan: masterPlansById?.[planId] || null,
        isActive: planId === activeMasterPlanId || planId === profile?.activeMasterPlanId,
      })),
    [profileMasterPlanIds, masterPlansById, activeMasterPlanId, profile?.activeMasterPlanId]
  );

  const cycleRecords = useMemo(() => {
    const candidateIds = new Set();
    Object.values(cyclesById || {}).forEach((cycle) => {
      const belongsToProfile =
        cycle?.profileId === activeProfileId ||
        profileGoalIds.includes(cycle?.goalId) ||
        profileMasterPlanIds.includes(cycle?.masterPlanId);
      if (belongsToProfile && cycle?.id) {
        candidateIds.add(cycle.id);
      }
    });

    return Array.from(candidateIds)
      .map((cycleId) => {
        const cycle = cyclesById?.[cycleId] || null;
        const goal = cycle?.goalId ? goalsById?.[cycle.goalId] || null : null;
        return {
          id: cycleId,
          cycle,
          goal,
          label: getCycleLabel(cycle, goal),
          isActive: cycleId === activeCycleId,
          sortKey: resolveCycleSortKey(cycle),
        };
      })
      .sort((left, right) => String(right.sortKey || '').localeCompare(String(left.sortKey || '')));
  }, [cyclesById, goalsById, activeProfileId, profileGoalIds, profileMasterPlanIds, activeCycleId]);

  const activeGoalRecord = goalRecords.find((record) => record.isActive) || goalRecords[0] || null;
  const activePlanRecord = masterPlanRecords.find((record) => record.isActive) || masterPlanRecords[0] || null;
  const activeCycleRecord = cycleRecords.find((record) => record.isActive) || cycleRecords[0] || null;
  const visibleCycleCount = cycleRecords.length;

  const handleSaveProfile = () => {
    if (typeof onUpdateProfile !== 'function') {
      return;
    }
    const nextDisplayName = String(displayNameDraft || '').trim();
    if (!nextDisplayName) {
      return;
    }
    onUpdateProfile({
      profileId: activeProfileId || profile?.id || null,
      displayName: nextDisplayName,
      roleLabel: String(roleLabelDraft || '').trim(),
    });
    setIsEditingProfile(false);
  };

  return (
    <div className="relative" data-testid="profile-history-menu">
      <button
        type="button"
        onClick={() => setIsOpen((current) => !current)}
        className="min-w-[280px] rounded-xl border border-line/60 bg-white px-4 py-3 text-left shadow-sm hover:border-jericho-accent/50"
        aria-expanded={isOpen}
        aria-controls="profile-history-panel"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Profile Container</p>
            <p className="truncate text-sm font-semibold text-jericho-text">
              {needsProfileSetup ? 'Create profile' : profileDisplayName}
            </p>
            <p className="truncate text-[11px] text-muted">
              {roleLabel || activePlanRecord?.plan?.title || activeGoalRecord?.label || 'Profile owns goals, plans, and cycles'}
            </p>
          </div>
          <div className="text-right text-[11px] text-muted">
            <p>{goalRecords.length} goals</p>
            <p>{masterPlanRecords.length} plans</p>
            <p>{visibleCycleCount} cycles</p>
          </div>
        </div>
      </button>

      {isOpen ? (
        <div
          id="profile-history-panel"
          className="absolute right-0 z-30 mt-2 w-[min(94vw,36rem)] rounded-2xl border border-line/70 bg-jericho-surface/95 p-4 shadow-2xl backdrop-blur"
        >
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Active Profile</p>
                <p className="truncate text-lg font-semibold text-jericho-text">{profileDisplayName}</p>
                <p className="truncate text-[11px] text-muted">
                  {roleLabel || 'Local execution owner'}
                </p>
              </div>
              {typeof onUpdateProfile === 'function' ? (
                <button
                  type="button"
                  className="rounded-full border border-line/60 px-3 py-1 text-[11px] text-muted hover:border-jericho-accent hover:text-jericho-accent"
                  onClick={() => setIsEditingProfile((current) => !current)}
                >
                  {needsProfileSetup ? 'Create Profile' : isEditingProfile ? 'Close Editor' : 'Edit Profile'}
                </button>
              ) : null}
            </div>

            {isEditingProfile ? (
              <div className="rounded-2xl border border-jericho-accent/35 bg-white px-4 py-4">
                <p className="text-[10px] uppercase tracking-[0.16em] text-muted">
                  {needsProfileSetup ? 'Create Profile' : 'Edit Profile'}
                </p>
                <div className="mt-3 grid gap-3">
                  <label className="grid gap-1 text-sm text-jericho-text">
                    <span className="text-[11px] uppercase tracking-[0.12em] text-muted">Display name</span>
                    <input
                      type="text"
                      value={displayNameDraft}
                      onChange={(event) => setDisplayNameDraft(event.target.value)}
                      placeholder="James Dotson"
                      className="rounded-xl border border-line/60 px-3 py-2 text-sm outline-none focus:border-jericho-accent"
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-jericho-text">
                    <span className="text-[11px] uppercase tracking-[0.12em] text-muted">Profile label / role</span>
                    <input
                      type="text"
                      value={roleLabelDraft}
                      onChange={(event) => setRoleLabelDraft(event.target.value)}
                      placeholder="Founder / Operator"
                      className="rounded-xl border border-line/60 px-3 py-2 text-sm outline-none focus:border-jericho-accent"
                    />
                  </label>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      className="rounded-full border border-line/60 px-3 py-1 text-[11px] text-muted hover:text-jericho-accent"
                      onClick={() => {
                        setDisplayNameDraft(profileDisplayName === DEFAULT_PROFILE_DISPLAY_NAME && !profile?.displayName ? '' : profileDisplayName);
                        setRoleLabelDraft(roleLabel);
                        setIsEditingProfile(false);
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={!String(displayNameDraft || '').trim()}
                      className="rounded-full border border-jericho-accent px-3 py-1 text-[11px] font-semibold text-jericho-accent hover:bg-jericho-accent/10 disabled:opacity-50"
                      onClick={handleSaveProfile}
                    >
                      Save Profile
                    </button>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="grid gap-2 sm:grid-cols-4">
              <SummaryPill label="Profile" value={profileDisplayName} />
              <SummaryPill label="Active Goal" value={activeGoalRecord?.label || 'None'} />
              <SummaryPill label="Active Plan" value={activePlanRecord?.plan?.title || activePlanRecord?.plan?.coreMission || 'None'} />
              <SummaryPill label="Active Cycle" value={activeCycleRecord?.label || 'None'} />
            </div>

            <p className="text-[10px] text-muted">
              Profile id: {activeProfileId || profile?.id || 'unknown-profile'}
              {profile?.displayName ? '' : ' · Default local profile until named by the user'}
            </p>

            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Master Plans</p>
              <div className="mt-2 space-y-2">
                {masterPlanRecords.length > 0 ? (
                  masterPlanRecords.map(({ id, plan, isActive }) => (
                    <HistoryRow
                      key={id}
                      title={plan?.title || plan?.coreMission || 'Untitled master plan'}
                      subtitle={
                        plan?.horizonStart && (plan?.fullHorizonEndDayKey || plan?.horizonEnd)
                          ? `${formatDay(plan.horizonStart)} → ${formatDay(plan.fullHorizonEndDayKey || plan.horizonEnd)}`
                          : 'Horizon pending'
                      }
                      meta={`Status: ${formatTitleStatus(plan?.status || (isActive ? 'active' : 'stored'))}`}
                      badge={
                        isActive ? (
                          <span className="rounded-full border border-jericho-accent px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-jericho-accent">
                            Active
                          </span>
                        ) : null
                      }
                    />
                  ))
                ) : (
                  <p className="text-xs text-muted">No master-plan history stored under this profile yet.</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Goal History</p>
              <div className="mt-2 space-y-2">
                {goalRecords.length > 0 ? (
                  goalRecords.map(({ id, label, isActive, cycle, goal }) => (
                    <HistoryRow
                      key={id}
                      title={label}
                      subtitle={
                        cycle?.goalContract?.startDayKey || cycle?.startedAtDayKey
                          ? `${formatDay(cycle?.goalContract?.startDayKey || cycle?.startedAtDayKey)} → ${formatDay(
                              cycle?.goalContract?.endDayKey || cycle?.endedAtDayKey || cycle?.deadlineDayKey || ''
                            )}`
                          : 'No cycle window attached'
                      }
                      meta={`Status: ${formatTitleStatus(goal?.status || cycle?.status || (isActive ? 'active' : 'stored'))}`}
                      badge={
                        isActive ? (
                          <span className="rounded-full border border-jericho-accent px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-jericho-accent">
                            Active
                          </span>
                        ) : null
                      }
                    />
                  ))
                ) : (
                  <p className="text-xs text-muted">No goal records stored under this profile yet.</p>
                )}
              </div>
            </div>

            <div>
              <p className="text-[10px] uppercase tracking-[0.16em] text-muted">Cycle History</p>
              <div className="mt-2 space-y-2">
                {cycleRecords.length > 0 ? (
                  cycleRecords.map(({ id, cycle, label, isActive }) => (
                    <HistoryRow
                      key={id}
                      title={label}
                      subtitle={`${formatCycleState(cycle?.status)} · ${formatDay(
                        cycle?.startedAtDayKey || cycle?.goalContract?.startDayKey
                      )}${cycle?.endedAtDayKey || cycle?.goalContract?.endDayKey ? ` → ${formatDay(cycle?.endedAtDayKey || cycle?.goalContract?.endDayKey)}` : ''}`}
                      meta={cycle?.masterPlanId ? `Linked plan: ${cycle.masterPlanId}` : null}
                      badge={
                        isActive ? (
                          <span className="rounded-full border border-jericho-accent px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-jericho-accent">
                            Open
                          </span>
                        ) : null
                      }
                      action={
                        typeof onSelectCycle === 'function' ? (
                          <button
                            type="button"
                            onClick={() => onSelectCycle(id)}
                            className="rounded-full border border-line/60 px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-muted hover:border-jericho-accent hover:text-jericho-accent"
                          >
                            View Cycle
                          </button>
                        ) : null
                      }
                    />
                  ))
                ) : (
                  <p className="text-xs text-muted">No cycle history stored under this profile yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
