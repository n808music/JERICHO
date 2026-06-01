import { useEffect, useRef, useState } from 'react';
import PropTypes from 'prop-types';

const BAND_CONFIG = {
  GREEN: {
    label: 'Achievable',
    proceedLabel: 'Looks good — proceed to scheduling',
    colorClass: 'band-green',
    showAcknowledgeRisk: false
  },
  YELLOW: {
    label: 'Achievable with care',
    proceedLabel: 'Proceed to scheduling',
    colorClass: 'band-yellow',
    showAcknowledgeRisk: false
  },
  ORANGE: {
    label: 'At risk',
    proceedLabel: 'Proceed anyway (not recommended)',
    colorClass: 'band-orange',
    showAcknowledgeRisk: true
  },
  RED: {
    label: 'Not recommended',
    proceedLabel: 'Proceed anyway (not recommended)',
    colorClass: 'band-red',
    showAcknowledgeRisk: true
  }
};

export default function FeasibilityDisplay({ goalPayload, onConfirmed, onAdjustGoal }) {
  const mountedRef = useRef(true);
  const [currentState, setCurrentState] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [hoursPerWeek, setHoursPerWeek] = useState('');
  const [availableDays, setAvailableDays] = useState([]);
  const [sessionLength, setSessionLength] = useState(null);
  const [currentLoad, setCurrentLoad] = useState(null);
  const [experienceLevel, setExperienceLevel] = useState(null);
  const [externalDependencies, setExternalDependencies] = useState(null);
  const [familySpecificInput, setFamilySpecificInput] = useState(null);

  const [feasibilityScore, setFeasibilityScore] = useState(null);
  const [feasibilityBand, setFeasibilityBand] = useState(null);
  const [factorBreakdown, setFactorBreakdown] = useState([]);
  const [limitingFactors, setLimitingFactors] = useState([]);
  const [recommendedAdjustments, setRecommendedAdjustments] = useState([]);
  const [plainLanguageSummary, setPlainLanguageSummary] = useState(null);

  const [acknowledgedRisk, setAcknowledgedRisk] = useState(false);

  const [showDeadlineAdjust, setShowDeadlineAdjust] = useState(false);
  const [adjustedDeadline, setAdjustedDeadline] = useState(null);
  const [adjustedDeadlineType, setAdjustedDeadlineType] = useState('TARGET');

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const shellState = {
    loading,
    setLoading,
    error,
    setError,
    hoursPerWeek,
    setHoursPerWeek,
    availableDays,
    setAvailableDays,
    sessionLength,
    setSessionLength,
    currentLoad,
    setCurrentLoad,
    experienceLevel,
    setExperienceLevel,
    externalDependencies,
    setExternalDependencies,
    familySpecificInput,
    setFamilySpecificInput,
    feasibilityScore,
    setFeasibilityScore,
    feasibilityBand,
    setFeasibilityBand,
    factorBreakdown,
    setFactorBreakdown,
    limitingFactors,
    setLimitingFactors,
    recommendedAdjustments,
    setRecommendedAdjustments,
    plainLanguageSummary,
    setPlainLanguageSummary,
    acknowledgedRisk,
    setAcknowledgedRisk,
    showDeadlineAdjust,
    setShowDeadlineAdjust,
    adjustedDeadline,
    setAdjustedDeadline,
    adjustedDeadlineType,
    setAdjustedDeadlineType
  };
  void shellState;
  const canCalculate =
    !loading &&
    Number(hoursPerWeek) >= 1 &&
    Number(hoursPerWeek) <= 168 &&
    availableDays.length >= 1 &&
    sessionLength !== null &&
    currentLoad !== null &&
    experienceLevel !== null &&
    externalDependencies !== null &&
    familySpecificInput !== null;

  function clearErrorIfNeeded() {
    if (error) {
      setError(null);
    }
  }

  function updateHoursPerWeek(value) {
    clearErrorIfNeeded();
    setHoursPerWeek(value);
  }

  function updateAvailableDays(updater) {
    clearErrorIfNeeded();
    setAvailableDays(updater);
  }

  function updateSessionLength(value) {
    clearErrorIfNeeded();
    setSessionLength(value);
  }

  function updateCurrentLoad(value) {
    clearErrorIfNeeded();
    setCurrentLoad(value);
  }

  function updateExperienceLevel(value) {
    clearErrorIfNeeded();
    setExperienceLevel(value);
  }

  function updateExternalDependencies(value) {
    clearErrorIfNeeded();
    setExternalDependencies(value);
  }

  function updateFamilySpecificInput(value) {
    clearErrorIfNeeded();
    setFamilySpecificInput(value);
  }

  function updateAdjustedDeadline(value) {
    clearErrorIfNeeded();
    setAdjustedDeadline(value);
  }

  function updateAdjustedDeadlineType(value) {
    clearErrorIfNeeded();
    setAdjustedDeadlineType(value);
  }

  function handleCalculate() {
    callFeasibilityAPI();
  }

  function handleConfirmProceed() {
    const confirmedFeasibilityPayload = {
      goalId: goalPayload?.goalId,
      cycleId: goalPayload?.cycleId,
      traceId: goalPayload?.traceId,
      goalFamily: goalPayload?.goalFamily,
      goalSubtype: goalPayload?.goalSubtype,
      normalizedGoalStatement: goalPayload?.normalizedGoalStatement,
      priorityLevel: goalPayload?.priorityLevel,
      currentStatus: goalPayload?.currentStatus,
      targetDeadline: adjustedDeadline || goalPayload?.targetDeadline,
      deadlineType: adjustedDeadline ? adjustedDeadlineType : goalPayload?.deadlineType,
      feasibilityScore,
      feasibilityBand,
      feasibilityConfirmed: true,
      acknowledgedRisk: acknowledgedRisk || false,
      capacityInputs: {
        hoursPerWeek: Number(hoursPerWeek),
        availableDays,
        sessionLengthMinutes: sessionLength,
        currentLoad,
        experienceLevel,
        externalDependencies,
        familySpecificInput
      }
    };

    onConfirmed(confirmedFeasibilityPayload);
  }

  function toggleAvailableDay(day) {
    updateAvailableDays((prev) =>
      prev.includes(day) ? prev.filter((value) => value !== day) : [...prev, day]
    );
  }

  function buildFamilySpecificInputs() {
    const family = goalPayload?.goalFamily;
    const fieldMap = {
      VentureLaunch: 'budgetAllocated',
      SkillAcquisition: 'skillBaseline',
      ProfessionalQualification: 'examDateFixed',
      PhysicalTraining: 'hasConstraints',
      JobSearchPipeline: 'currentlyEmployed',
      CreativeProduction: 'hasExistingWork',
      BrandLaunch: 'hasExistingAudience',
      SalesPipeline: 'hasExistingPipeline',
      Fundraising: 'hasInvestorRelationships'
    };

    const fieldName = fieldMap[family];
    if (!fieldName) {
      return {};
    }
    return { [fieldName]: familySpecificInput };
  }

  async function callFeasibilityAPI(deadlineOverride = null) {
    setLoading(true);
    setError(null);
    setCurrentState(2);

    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) return;
      setLoading(false);
      setError('timeout');
      setCurrentState(1);
    }, 10000);

    try {
      const response = await fetch('/api/agent/feasibility', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalId: goalPayload.goalId,
          goalFamily: goalPayload.goalFamily,
          goalSubtype: goalPayload.goalSubtype,
          targetDeadline: deadlineOverride || adjustedDeadline || goalPayload.targetDeadline,
          deadlineType: deadlineOverride
            ? adjustedDeadlineType
            : adjustedDeadline
              ? adjustedDeadlineType
              : goalPayload.deadlineType,
          capacityInputs: {
            hoursPerWeek: Number(hoursPerWeek),
            availableDays,
            sessionLengthMinutes: sessionLength,
            currentLoad,
            experienceLevel,
            externalDependencies
          },
          familySpecificInputs: buildFamilySpecificInputs()
        })
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();

      if (!data.ok || data.errorCode) {
        throw new Error(data.errorCode || 'SERVER_ERROR');
      }

      if (!mountedRef.current) {
        return;
      }

      setFeasibilityScore(data.feasibilityScore);
      setFeasibilityBand(data.feasibilityBand);
      setFactorBreakdown(data.factorBreakdown);
      setLimitingFactors(data.limitingFactors);
      setRecommendedAdjustments(data.recommendedAdjustments);
      setPlainLanguageSummary(data.plainLanguageSummary);
      setAcknowledgedRisk(false);
      setLoading(false);
      setCurrentState(3);
    } catch (err) {
      clearTimeout(timeoutId);

      if (!mountedRef.current) {
        return;
      }

      setLoading(false);

      const errorCode =
        err.message === 'timeout'
          ? 'timeout'
          : ['BASELINE_FEASIBILITY_INPUT_MISSING', 'SERVER_ERROR'].includes(err.message)
            ? err.message
            : 'network';

      setError(errorCode);
      setCurrentState(1);
    }
  }

  function renderError(errorCode) {
    const messages = {
      BASELINE_FEASIBILITY_INPUT_MISSING:
        'Some required inputs are missing. Please check your capacity fields and try again.',
      SERVER_ERROR: 'Something went wrong calculating your score. Please try again.',
      network: 'Could not reach the server. Please check your connection and try again.',
      timeout: 'This is taking longer than expected. Please try again.'
    };

    return (
      <div className="error-message" role="alert">
        <p>{messages[errorCode] || messages.SERVER_ERROR}</p>
        <button
          className="retry-btn"
          onClick={() => {
            setError(null);
            callFeasibilityAPI();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  function renderFamilySpecificInput() {
    const family = goalPayload?.goalFamily;
    const questions = {
      VentureLaunch: {
        question: 'Do you have a budget allocated for this launch?',
        options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false }
        ]
      },
      SkillAcquisition: {
        question: 'What is your current skill baseline?',
        options: [
          { label: 'Zero — starting from scratch', value: 'ZERO' },
          { label: 'Beginner — some exposure', value: 'BEGINNER' },
          { label: 'Intermediate — working knowledge', value: 'INTERMEDIATE' }
        ]
      },
      ProfessionalQualification: {
        question: 'Is your exam or qualification date already fixed?',
        options: [
          { label: 'Yes — date is set', value: true },
          { label: 'No — date is flexible', value: false }
        ]
      },
      PhysicalTraining: {
        question: 'Do you have any current injuries or medical constraints?',
        options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false }
        ]
      },
      JobSearchPipeline: {
        question: 'Are you currently employed?',
        options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false }
        ]
      },
      CreativeProduction: {
        question: 'Do you have a concept or draft already started?',
        options: [
          { label: 'Yes', value: true },
          { label: 'No — starting from zero', value: false }
        ]
      },
      BrandLaunch: {
        question: 'Do you have an existing audience?',
        options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false }
        ]
      },
      SalesPipeline: {
        question: 'Do you have an existing pipeline or starting from zero?',
        options: [
          { label: 'Existing pipeline', value: true },
          { label: 'Starting from zero', value: false }
        ]
      },
      Fundraising: {
        question: 'Do you have existing relationships with investors or donors?',
        options: [
          { label: 'Yes', value: true },
          { label: 'No', value: false }
        ]
      }
    };

    const config = questions[family];
    if (!config) {
      return null;
    }

    return (
      <div className="capacity-field">
        <label className="capacity-label">{config.question}</label>
        <div className="radio-group">
          {config.options.map((opt, index) => (
            <label key={`${family}-${index}`} className="radio-option">
              <input
                type="radio"
                name="familySpecific"
                checked={familySpecificInput === opt.value}
                onChange={() => updateFamilySpecificInput(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </div>
    );
  }

  function renderCapacityFields(nameSuffix = '') {
    return (
      <>
        <div className="capacity-field">
          <label className="capacity-label" htmlFor={`hours-per-week${nameSuffix}`}>
            {nameSuffix ? 'Hours per week available for this goal' : 'How many hours per week can you dedicate to this goal?'}
          </label>
          <input
            id={`hours-per-week${nameSuffix}`}
            type="number"
            className="hours-input"
            min="1"
            max="168"
            placeholder="e.g. 5"
            value={hoursPerWeek}
            onChange={(e) => updateHoursPerWeek(e.target.value)}
          />
        </div>

        <div className="capacity-field">
          <label className="capacity-label">Which days are available?</label>
          <div className="days-grid">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
              <label key={`${day}-${nameSuffix || 'base'}`} className="day-checkbox">
                <input
                  type="checkbox"
                  checked={availableDays.includes(day)}
                  onChange={() => toggleAvailableDay(day)}
                />
                {day.slice(0, 3)}
              </label>
            ))}
          </div>
        </div>

        <div className="capacity-field">
          <label className="capacity-label">Preferred session length</label>
          <div className="radio-group">
            {[
              { label: '30 min', value: 30 },
              { label: '1 hour', value: 60 },
              { label: '2 hours', value: 120 }
            ].map((opt) => (
              <label key={`${opt.value}-${nameSuffix || 'base'}`} className="radio-option">
                <input
                  type="radio"
                  name={`sessionLength${nameSuffix}`}
                  value={opt.value}
                  checked={sessionLength === opt.value}
                  onChange={() => updateSessionLength(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="capacity-field">
          <label className="capacity-label">Current workload</label>
          <div className="radio-group">
            {[
              { label: 'Light', value: 'LIGHT' },
              { label: 'Moderate', value: 'MODERATE' },
              { label: 'Heavy', value: 'HEAVY' },
              { label: 'Overloaded', value: 'OVERLOADED' }
            ].map((opt) => (
              <label key={`${opt.value}-${nameSuffix || 'base'}`} className="radio-option">
                <input
                  type="radio"
                  name={`currentLoad${nameSuffix}`}
                  value={opt.value}
                  checked={currentLoad === opt.value}
                  onChange={() => updateCurrentLoad(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="capacity-field">
          <label className="capacity-label">Prior experience with this goal type</label>
          <div className="radio-group">
            {[
              { label: 'Novice', value: 'NOVICE' },
              { label: 'Some experience', value: 'SOME' },
              { label: 'Done this before', value: 'DONE_BEFORE' }
            ].map((opt) => (
              <label key={`${opt.value}-${nameSuffix || 'base'}`} className="radio-option">
                <input
                  type="radio"
                  name={`experienceLevel${nameSuffix}`}
                  value={opt.value}
                  checked={experienceLevel === opt.value}
                  onChange={() => updateExperienceLevel(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        <div className="capacity-field">
          <label className="capacity-label">
            {nameSuffix ? 'External dependencies' : 'How many things outside your control does this goal depend on?'}
          </label>
          <div className="radio-group">
            {[
              { label: 'None', value: 'NONE' },
              { label: '1–2', value: 'ONE_TWO' },
              { label: '3–4', value: 'THREE_FOUR' },
              { label: '5 or more', value: 'FIVE_PLUS' }
            ].map((opt) => (
              <label key={`${opt.value}-${nameSuffix || 'base'}-deps`} className="radio-option">
                <input
                  type="radio"
                  name={`externalDependencies${nameSuffix}`}
                  value={opt.value}
                  checked={externalDependencies === opt.value}
                  onChange={() => updateExternalDependencies(opt.value)}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>

        {renderFamilySpecificInput()}
      </>
    );
  }

  function renderDeadlineAdjust() {
    return (
      <div className="correction-panel">
        <h3>Update your deadline</h3>

        <div className="correction-field">
          <label htmlFor="feasibility-deadline-adjust">Select a new date</label>
          <input
            id="feasibility-deadline-adjust"
            type="date"
            className="date-input"
            value={adjustedDeadline ? new Date(adjustedDeadline).toISOString().split('T')[0] : ''}
            min={new Date().toISOString().split('T')[0]}
            onChange={(e) => updateAdjustedDeadline(e.target.value ? new Date(e.target.value).toISOString() : '')}
          />
        </div>

        <div className="correction-field">
          <label>Is this a hard deadline?</label>
          <label className="correction-radio-row">
            <input
              type="radio"
              name="adjustDeadlineType"
              value="HARD"
              checked={adjustedDeadlineType === 'HARD'}
              onChange={() => updateAdjustedDeadlineType('HARD')}
            />
            Yes — this date cannot move
          </label>
          <label className="correction-radio-row">
            <input
              type="radio"
              name="adjustDeadlineType"
              value="TARGET"
              checked={adjustedDeadlineType === 'TARGET'}
              onChange={() => updateAdjustedDeadlineType('TARGET')}
            />
            No — this is a target
          </label>
        </div>

        <div className="correction-actions">
          <button
            className="btn-primary"
            disabled={!adjustedDeadline}
            onClick={() => {
              if (!adjustedDeadline) return;
              setShowDeadlineAdjust(false);
              callFeasibilityAPI(adjustedDeadline);
            }}
          >
            Recalculate with new deadline
          </button>
          <button
            className="btn-secondary"
            onClick={() => {
              setAdjustedDeadline(null);
              setAdjustedDeadlineType('TARGET');
              setShowDeadlineAdjust(false);
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  if (currentState === 1) {
    const deadlineLabel = goalPayload?.targetDeadline
      ? new Date(goalPayload.targetDeadline).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })
      : 'No deadline set';

    return (
      <div className="feasibility-container">
        <div className="feasibility-header">
          <h2>Let&apos;s check if this goal is achievable for you.</h2>
          <p className="feasibility-goal-context">
            <span className="goal-label">{goalPayload?.goalSubtype}</span>
            <span className="goal-deadline">Due {deadlineLabel}</span>
          </p>
        </div>

        {renderCapacityFields()}

        <button className="btn-primary" disabled={!canCalculate} onClick={handleCalculate}>
          Calculate feasibility
        </button>

        {error && renderError(error)}

        {error && feasibilityScore !== null && (
          <button className="btn-secondary" onClick={() => setCurrentState(3)}>
            ← Back to my score
          </button>
        )}

        <button onClick={onAdjustGoal}>← Adjust goal</button>
      </div>
    );
  }

  if (currentState === 2) {
    return (
      <div className="feasibility-container">
        <div className="feasibility-loading">
          <p>Calculating your feasibility score...</p>
          <div className="loading-bar">
            <div className="loading-bar-fill" />
          </div>
        </div>
      </div>
    );
  }

  if (currentState === 3) {
    const band = BAND_CONFIG[feasibilityBand] || BAND_CONFIG.YELLOW;
    const canProceed = band.showAcknowledgeRisk ? acknowledgedRisk : true;

    return (
      <div className="feasibility-container">
        <div className="score-display">
          <div className={`score-circle ${band.colorClass}`}>
            <span className="score-number">{feasibilityScore}</span>
            <span className="score-denom">/ 100</span>
          </div>
          <div className="score-band-label">
            <span className={`band-badge ${band.colorClass}`}>{band.label}</span>
          </div>
        </div>

        <p className="score-summary">{plainLanguageSummary}</p>

        <div className="factor-breakdown">
          <h3 className="section-label">Factor breakdown</h3>
          {factorBreakdown.map((item, index) => (
            <div key={`${item.factor}-${index}`} className="factor-row">
              <span className="factor-name">{item.factor}</span>
              <div className="factor-bar-track">
                <div className={`factor-bar-fill ${band.colorClass}`} style={{ width: `${item.score}%` }} />
              </div>
              <span className="factor-score">{item.score}%</span>
            </div>
          ))}
        </div>

        {limitingFactors.length > 0 && (
          <div className="limiting-factors">
            <h3 className="section-label">What&apos;s limiting you most</h3>
            <ul>
              {limitingFactors.map((factor, index) => (
                <li key={`${factor}-${index}`}>{factor}</li>
              ))}
            </ul>
          </div>
        )}

        {recommendedAdjustments.length > 0 && (
          <div className="recommended-adjustments">
            <h3 className="section-label">How to improve this score</h3>
            <ul>
              {recommendedAdjustments.map((adjustment, index) => (
                <li key={`${adjustment}-${index}`}>{adjustment}</li>
              ))}
            </ul>
          </div>
        )}

        {band.showAcknowledgeRisk && (
          <label className="acknowledge-risk">
            <input
              type="checkbox"
              checked={acknowledgedRisk}
              onChange={(e) => setAcknowledgedRisk(e.target.checked)}
            />
            I understand the risks and want to proceed anyway
          </label>
        )}

        <div className="confirmation-options">
          <button className="btn-primary" disabled={!canProceed} onClick={handleConfirmProceed}>
            {band.proceedLabel}
          </button>

          <button className="btn-secondary" onClick={() => setCurrentState(4)}>
            Adjust my available hours
          </button>

          <button className="btn-secondary" onClick={() => setShowDeadlineAdjust(true)}>
            Change my deadline
          </button>

          <button className="btn-ghost" onClick={onAdjustGoal}>
            ← Change my goal
          </button>
        </div>

        {showDeadlineAdjust && renderDeadlineAdjust()}
      </div>
    );
  }

  if (currentState === 4) {
    return (
      <div className="feasibility-container">
        <div className="feasibility-header">
          <h2>Adjust your capacity inputs</h2>
          <p className="feasibility-goal-context">
            <span className="goal-label">{goalPayload?.goalSubtype}</span>
          </p>
        </div>

        {renderCapacityFields('Adj')}

        <div className="confirmation-options">
          <button
            className="btn-primary"
            disabled={!canCalculate}
            onClick={() => {
              callFeasibilityAPI();
            }}
          >
            Recalculate feasibility
          </button>

          <button className="btn-secondary" onClick={() => setCurrentState(3)}>
            ← Back to my score
          </button>
        </div>
      </div>
    );
  }

  return null;
}

FeasibilityDisplay.propTypes = {
  goalPayload: PropTypes.shape({
    goalId: PropTypes.string,
    cycleId: PropTypes.string,
    traceId: PropTypes.string,
    goalFamily: PropTypes.string,
    goalSubtype: PropTypes.string,
    normalizedGoalStatement: PropTypes.string,
    targetDeadline: PropTypes.string,
    deadlineType: PropTypes.string,
    priorityLevel: PropTypes.string,
    currentStatus: PropTypes.string
  }),
  onConfirmed: PropTypes.func.isRequired,
  onAdjustGoal: PropTypes.func.isRequired
};
