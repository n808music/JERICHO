import { useEffect, useRef, useState } from 'react';
import '../../../JERICHO/src/index.css';

/**
 * GoalIntakeUI — Surface 1
 * Three-state component for goal intake:
 * 1. State 1 (Input) — collect goal description, priority, timeframe, status
 * 2. State 2 (Clarification) — ask clarification questions if needed (max 2)
 * 3. State 3 (Confirmation) — confirm resolved family, subtype, deadline with correction flows
 */

const GOAL_TAXONOMY = {
  VentureLaunch: [
    'SaaS Product Launch',
    'Consumer Product Launch',
    'Service Business Launch',
    'Marketplace Launch',
    'Local Business Launch'
  ],
  SkillAcquisition: [
    'Software Skill Acquisition',
    'Design Skill Acquisition',
    'Communication Skill Acquisition',
    'Technical Trade Skill Acquisition',
    'Creative Skill Acquisition'
  ],
  ProfessionalQualification: [
    'Certification Exam',
    'Licensure Exam',
    'Compliance Training Completion',
    'Portfolio-Based Qualification',
    'Interview-Based Qualification'
  ],
  PhysicalTraining: [
    'Strength Program',
    'Endurance Performance',
    'Weight Loss / Body Composition',
    'Rehab Return to Training',
    'General Conditioning'
  ],
  JobSearchPipeline: [
    'Corporate Role Search',
    'Remote Knowledge Work Search',
    'Creative Role Search',
    'Skilled Trade Role Search',
    'Career Transition Search'
  ],
  CreativeProduction: [
    'TV / Series Writing',
    'Podcast Production',
    'Music Project Production',
    'Video Production',
    'Book / Longform Writing'
  ],
  BrandLaunch: [
    'Personal Brand Launch',
    'Business Brand Launch',
    'Product Brand Launch',
    'Artist / Creator Brand Launch',
    'Campaign Brand Launch'
  ],
  SalesPipeline: [
    'B2B Service Sales',
    'B2C Product Sales',
    'High-Ticket Consultative Sales',
    'Retail / Local Offer Sales',
    'Subscription / Recurring Revenue Sales'
  ],
  Fundraising: [
    'Friends and Family Raise',
    'Angel Raise',
    'Seed Round Raise',
    'Grant / Non-Dilutive Funding',
    'Sponsorship / Partnership Raise'
  ]
};

export default function GoalIntakeUI({ onConfirmed: _onConfirmed }) {
  // Test helper to verify Zion theme is applied
  if (typeof window !== 'undefined' && window.location?.pathname === '/intake-dev') {
    const testZionTheme = () => {
      const rootStyles = getComputedStyle(document.documentElement);
      const bgColor = rootStyles.getPropertyValue('--bg').trim();
      const textColor = rootStyles.getPropertyValue('--text').trim();

      if (bgColor === '#ffffff' && textColor === '#0a0a0a') {
        console.log('✅ GoalIntakeUI: Zion light theme confirmed');
      } else {
        console.error('❌ GoalIntakeUI: Dark theme still detected', { bgColor, textColor });
      }
    };

    // Run test after component mounts
    setTimeout(testZionTheme, 100);
  }

  // State 1: Input form
  const [goalDescription, setGoalDescription] = useState('');
  const [priorityLevel, setPriorityLevel] = useState('MEDIUM');
  const [timeframe, setTimeframe] = useState('');
  const [currentStatus, setCurrentStatus] = useState('NOT_STARTED');

  // Validation state
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  // State 2: Clarification
  const [clarificationLog, setClarificationLog] = useState([]);
  const [clarificationQuestion, setClarificationQuestion] = useState(null);
  const [clarificationOptions, setClarificationOptions] = useState([]);
  const [clarificationCount, setClarificationCount] = useState(0);
  const [clarificationLoading, setClarificationLoading] = useState(false);

  // State 3: Confirmation gate
  const [resolvedFamily, setResolvedFamily] = useState(null);
  const [resolvedSubtype, setResolvedSubtype] = useState(null);
  const [resolvedStatement, setResolvedStatement] = useState(null);
  const [resolvedDeadline, setResolvedDeadline] = useState(null);
  const [deadlineConfidence, setDeadlineConfidence] = useState(null);
  const [deadlineType, setDeadlineType] = useState('TARGET');

  // Inline correction flow state
  const [showGoalTypeCorrection, setShowGoalTypeCorrection] = useState(false);
  const [showDeadlineCorrection, setShowDeadlineCorrection] = useState(false);
  const [correctionFamily, setCorrectionFamily] = useState(null);
  const [correctionSubtype, setCorrectionSubtype] = useState(null);
  const [correctionDeadline, setCorrectionDeadline] = useState('');
  const [correctionDeadlineType, setCorrectionDeadlineType] = useState('TARGET');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [proceedLoading, setProceedLoading] = useState(false);
  const [proceedError, setProceedError] = useState(null);
  const retryActionRef = useRef(null);
  const mountedRef = useRef(true);

  // UI state
  const [currentState, setCurrentState] = useState(1); // 1 = Input, 2 = Clarification, 3 = Confirmation

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  function getTodayInputValue() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function getDateInputValue(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  function toStoredDeadline(dateInputValue) {
    if (!dateInputValue) return '';
    return new Date(`${dateInputValue}T12:00:00`).toISOString();
  }

  /**
   * Validation functions
   */
  function validateField(name, value) {
    switch (name) {
      case 'goalDescription':
        if (value.trim().length < 10)
          return 'Please describe your goal in a bit more detail.';
        if (value.trim().length > 500)
          return `Please keep your goal description under 500 characters.`;
        return null;
      case 'timeframe':
        if (value.trim().length < 3)
          return "Please tell us when you need this done — for example, 'by June' or 'in 3 months'.";
        return null;
      default:
        return null;
    }
  }

  function handleBlur(name, value) {
    setTouched(prev => ({ ...prev, [name]: true }));
    const error = validateField(name, value);
    setErrors(prev => ({ ...prev, [name]: error }));
  }

  function setResolvedStatesFromData(data) {
    if (!data) return;
    setResolvedFamily(data.goalFamily);
    setResolvedSubtype(data.goalSubtype);
    setResolvedStatement(data.normalizedGoalStatement);
    setResolvedDeadline(data.targetDeadline);
    setDeadlineConfidence(data.deadlineConfidence);
    setDeadlineType(data.deadlineType || 'TARGET');
    setShowGoalTypeCorrection(false);
    setShowDeadlineCorrection(false);
  }

  function handleChange(name, value) {
    if (name === 'goalDescription') setGoalDescription(value);
    if (name === 'timeframe') setTimeframe(value);
    if (name === 'priorityLevel') setPriorityLevel(value);
    if (name === 'currentStatus') setCurrentStatus(value);
    if (error) {
      setError(null);
    }
    // Clear error when user starts typing again
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: null }));
    }
  }

  // Submit enable rule
  const canSubmit =
    goalDescription.trim().length >= 10 &&
    goalDescription.trim().length <= 500 &&
    timeframe.trim().length >= 3;

  function handleAgentResponse(data) {
    if (!mountedRef.current) return;
    setIsLoading(false);
    setClarificationLoading(false);

    if (data.errorCode === 'SUBTYPE_UNRESOLVABLE' && data.goalFamily) {
      setClarificationQuestion('Which of these best describes your goal?');
      setClarificationOptions(GOAL_TAXONOMY[data.goalFamily] || []);
      setError('SUBTYPE_UNRESOLVABLE');
      setCurrentState(2);
      return;
    }

    if (data.errorCode) {
      setError(data.errorCode);
      return;
    }

    if (data.needsClarification) {
      setClarificationQuestion(data.clarificationQuestion);
      setClarificationOptions(data.clarificationOptions || []);
      setCurrentState(2);
      return;
    }

    if (data.resolved) {
      setResolvedStatesFromData(data);
      setCurrentState(3);
      return;
    }

    setError('SERVER_ERROR');
  }

  async function postGoalStructure(clarificationLogPayload, forceResolution, signal) {
    const response = await fetch('/api/agent/goal-structure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        rawGoalStatement: goalDescription.trim(),
        timeframe: timeframe.trim(),
        priorityLevel,
        currentStatus,
        clarificationLog: clarificationLogPayload,
        forceResolution
      })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return response.json();
  }

  async function handleStateOneSubmit(e) {
    if (e?.preventDefault) {
      e.preventDefault();
    }
    if (!canSubmit) {
      const descError = validateField('goalDescription', goalDescription);
      const timeError = validateField('timeframe', timeframe);
      setErrors({
        goalDescription: descError,
        timeframe: timeError
      });
      setTouched({
        goalDescription: true,
        timeframe: true
      });
      return;
    }

    retryActionRef.current = {
      type: 'submit',
      clarificationLogPayload: [],
      forceResolution: false
    };
    setIsLoading(true);
    setError(null);
    setClarificationQuestion(null);
    setClarificationOptions([]);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) return;
      controller.abort('timeout');
      setIsLoading(false);
      setError('timeout');
    }, 10000);

    try {
      const data = await postGoalStructure([], false, controller.signal);
      clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      handleAgentResponse(data);
    } catch (err) {
      clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      setIsLoading(false);
      if (err.name !== 'AbortError') {
        setError('network');
      }
    }
  }

  async function handleClarificationAnswer(selectedOption) {
    const updatedLog = [
      ...clarificationLog,
      {
        question: clarificationQuestion,
        userResponse: selectedOption,
        resolutionApplied: null
      }
    ];

    setClarificationLog(updatedLog);
    setClarificationCount((prev) => prev + 1);
    setClarificationLoading(true);
    setError(null);
    const isForced = clarificationCount + 1 >= 2;
    retryActionRef.current = {
      type: 'clarification',
      clarificationLogPayload: updatedLog,
      forceResolution: isForced
    };
    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) return;
      controller.abort('timeout');
      setClarificationLoading(false);
      setError('timeout');
    }, 10000);

    try {
      const data = await postGoalStructure(updatedLog, isForced, controller.signal);
      clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      setClarificationLoading(false);
      handleAgentResponse(data);
    } catch (err) {
      clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      setClarificationLoading(false);
      if (err.name !== 'AbortError') {
        setError('network');
      }
    }
  }

  function handleRetry() {
    setError(null);

    if (retryActionRef.current?.type === 'clarification') {
      retryClarificationRequest(
        retryActionRef.current.clarificationLogPayload || [],
        Boolean(retryActionRef.current.forceResolution)
      );
      return;
    }

    handleStateOneSubmit();
  }

  async function retryClarificationRequest(clarificationLogPayload, forceResolution) {
    setClarificationLoading(true);
    setError(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      if (!mountedRef.current) return;
      controller.abort('timeout');
      setClarificationLoading(false);
      setError('timeout');
    }, 10000);

    try {
      const data = await postGoalStructure(clarificationLogPayload, forceResolution, controller.signal);
      clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      setClarificationLoading(false);
      handleAgentResponse(data);
    } catch (err) {
      clearTimeout(timeoutId);
      if (!mountedRef.current) return;
      setClarificationLoading(false);
      if (err.name !== 'AbortError') {
        setError('network');
      }
    }
  }

  function renderError(errorCode) {
    const messages = {
      INVALID_GOAL_INPUT:
        'Your goal description is too vague for us to classify. Can you add more detail about what you want to achieve?',
      SUBTYPE_UNRESOLVABLE:
        'We could not determine the specific type. Please select from the options below.',
      INVALID_GOAL_TYPE:
        'We could not match this to one of our goal types. Please try describing it differently.',
      DEADLINE_UNRESOLVABLE:
        'We could not determine your deadline. Please use the date selector to set it.',
      SERVER_ERROR:
        'Something went wrong on our end. Please try again.',
      network:
        'Something went wrong. Your goal description is saved — tap retry to try again.',
      timeout:
        'This is taking longer than expected. Your goal description is saved — tap retry to try again.'
    };

    const message = messages[errorCode] || messages.SERVER_ERROR;

    return (
      <div className="error-message" role="alert">
        <p>{message}</p>
        {(errorCode === 'network' || errorCode === 'timeout' || errorCode === 'SERVER_ERROR') && (
          <button className="retry-btn" onClick={handleRetry}>
            Retry
          </button>
        )}
      </div>
    );
  }

  
  /**
   * Back button from State 2 to State 1
   */
  function handleBackToInput() {
    setCurrentState(1);
    setClarificationQuestion(null);
    setClarificationOptions([]);
    setClarificationLog([]);
    setClarificationCount(0);
    setClarificationLoading(false);
    setError(null);
  }

  /**
   * Start over - clear everything and return to State 1
   */
  function handleStartOver() {
    setGoalDescription('');
    setPriorityLevel('MEDIUM');
    setTimeframe('');
    setCurrentStatus('NOT_STARTED');
    setErrors({});
    setTouched({});
    setClarificationLog([]);
    setClarificationQuestion(null);
    setClarificationOptions([]);
    setClarificationCount(0);
    setClarificationLoading(false);
    setResolvedFamily(null);
    setResolvedSubtype(null);
    setResolvedStatement(null);
    setResolvedDeadline(null);
    setDeadlineConfidence(null);
    setDeadlineType('TARGET');
    setShowGoalTypeCorrection(false);
    setShowDeadlineCorrection(false);
    setCorrectionFamily(null);
    setCorrectionSubtype(null);
    setCorrectionDeadline('');
    setCorrectionDeadlineType('TARGET');
    setError(null);
    setProceedLoading(false);
    setProceedError(null);
    setCurrentState(1);
  }

  /**
   * Helpers for State 3 confirmation/correction flows
   */
  function openGoalTypeCorrection() {
    setProceedError(null);
    setCorrectionFamily(resolvedFamily);
    setCorrectionSubtype(resolvedSubtype);
    setShowGoalTypeCorrection(true);
    setShowDeadlineCorrection(false);
  }

  function openDeadlineCorrection() {
    setProceedError(null);
    setCorrectionDeadline(resolvedDeadline || '');
    setCorrectionDeadlineType(deadlineType);
    setShowDeadlineCorrection(true);
    setShowGoalTypeCorrection(false);
  }

  function cancelCorrections() {
    setProceedError(null);
    setShowGoalTypeCorrection(false);
    setShowDeadlineCorrection(false);
  }

  function applyGoalTypeCorrection() {
    if (!correctionFamily || !correctionSubtype) return;
    setResolvedFamily(correctionFamily);
    setResolvedSubtype(correctionSubtype);
    setShowGoalTypeCorrection(false);
  }

  function applyDeadlineCorrection() {
    if (!correctionDeadline) return;
    if (getDateInputValue(correctionDeadline) < getTodayInputValue()) return;
    setResolvedDeadline(correctionDeadline);
    setDeadlineConfidence('HIGH');
    setDeadlineType(correctionDeadlineType);
    setShowDeadlineCorrection(false);
  }

  async function handleProceed() {
    setProceedLoading(true);
    setProceedError(null);

    const confirmedPayload = {
      rawGoalStatement: goalDescription.trim(),
      normalizedGoalStatement: resolvedStatement,
      goalFamily: resolvedFamily,
      goalSubtype: resolvedSubtype,
      priorityLevel,
      currentStatus,
      targetDeadline: resolvedDeadline,
      deadlineType,
      deadlineConfidence,
      confirmationStatus: 'CONFIRMED',
      clarificationLog
    };

    try {
      const goalsResponse = await fetch('/goals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(confirmedPayload)
      });

      if (!goalsResponse.ok) {
        throw new Error('GOALS_PERSIST_FAILED');
      }

      const goalsData = await goalsResponse.json();
      if (!goalsData.ok) {
        throw new Error('GOALS_PERSIST_FAILED');
      }

      const pipelineResponse = await fetch('/api/pipeline/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...confirmedPayload,
          goalId: goalsData.goalId
        })
      });

      if (!pipelineResponse.ok) {
        throw new Error('PIPELINE_START_FAILED');
      }

      const pipelineData = await pipelineResponse.json();
      if (!pipelineData.ok) {
        throw new Error('PIPELINE_START_FAILED');
      }

      if (!mountedRef.current) return;
      setProceedLoading(false);

      if (typeof onConfirmed === 'function') {
        onConfirmed({
          ...confirmedPayload,
          goalId: pipelineData.goalId,
          cycleId: pipelineData.cycleId,
          traceId: pipelineData.traceId
        });
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setProceedLoading(false);

      if (err.message === 'GOALS_PERSIST_FAILED') {
        setProceedError('GOALS_PERSIST_FAILED');
        return;
      }

      if (err.message === 'PIPELINE_START_FAILED') {
        setProceedError('PIPELINE_START_FAILED');
        return;
      }

      setProceedError('network');
    }
  }

  function renderProceedError(errorCode) {
    const messages = {
      GOALS_PERSIST_FAILED:
        'Your goal could not be saved. Please try again.',
      PIPELINE_START_FAILED:
        'Your goal was saved but the pipeline did not start. Tap retry to try again.',
      network:
        'Something went wrong. Please check your connection and try again.'
    };

    const message = messages[errorCode] || messages.network;

    return (
      <div className="error-message proceed-error" role="alert">
        <p>{message}</p>
        <button
          className="retry-btn"
          onClick={() => {
            setProceedError(null);
            handleProceed();
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  // ============================================================
  // RENDER: Loading state
  // ============================================================
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-4">Analyzing your goal...</h2>
          <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-blue-500 rounded-full animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: State 1 — Input
  // ============================================================
  if (currentState === 1) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-8 border border-gray-200">
          <h1 className="text-3xl font-bold mb-8 text-center">What do you want to achieve?</h1>

          <form onSubmit={handleStateOneSubmit} className="space-y-6">
            <div className="space-y-2">
              <label htmlFor="goal-description" className="block text-sm font-semibold uppercase tracking-wide text-gray-700">
                Describe your goal...
              </label>
              <textarea
                id="goal-description"
                value={goalDescription}
                onChange={(e) => handleChange('goalDescription', e.target.value)}
                onBlur={(e) => handleBlur('goalDescription', e.target.value)}
                placeholder="I want to..."
                rows={4}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
              />
              {(goalDescription.length > 0 || touched.goalDescription) && (
                <span className={`text-sm text-right block ${goalDescription.length > 450 ? (goalDescription.length > 490 ? 'text-red-600' : 'text-yellow-600') : 'text-gray-500'}`}>
                  {goalDescription.length} / 500
                </span>
              )}
              {touched.goalDescription && errors.goalDescription && (
                <div className="text-red-600 text-sm mt-1">{errors.goalDescription}</div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold uppercase tracking-wide text-gray-700">
                How urgent is this goal?
              </label>
              <div className="space-y-2">
                {['HIGH', 'MEDIUM', 'LOW'].map((level) => (
                  <label key={level} className="flex items-center space-x-3 cursor-pointer">
                    <input
                      type="radio"
                      name="priorityLevel"
                      value={level}
                      checked={priorityLevel === level}
                      onChange={(e) => handleChange('priorityLevel', e.target.value)}
                      className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-gray-900">{level}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="timeframe" className="block text-sm font-semibold uppercase tracking-wide text-gray-700">
                When do you need it done?
              </label>
              <input
                id="timeframe"
                type="text"
                value={timeframe}
                onChange={(e) => handleChange('timeframe', e.target.value)}
                onBlur={(e) => handleBlur('timeframe', e.target.value)}
                placeholder="e.g. by June, in 3 months, this year"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              {touched.timeframe && errors.timeframe && (
                <div className="text-red-600 text-sm mt-1">{errors.timeframe}</div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-sm font-semibold uppercase tracking-wide text-gray-700">
                Where are you starting from?
              </label>
              <div className="space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="currentStatus"
                    value="NOT_STARTED"
                    checked={currentStatus === 'NOT_STARTED'}
                    onChange={(e) => handleChange('currentStatus', e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-900">Starting from zero</span>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="currentStatus"
                    value="IN_PROGRESS"
                    checked={currentStatus === 'IN_PROGRESS'}
                    onChange={(e) => handleChange('currentStatus', e.target.value)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-900">Already in progress</span>
                </label>
              </div>
            </div>

            {error && renderError(error)}

            <button
              type="submit"
              disabled={!canSubmit || isLoading}
              className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isLoading ? 'Analyzing...' : 'Analyze my goal'}
            </button>
          </form>

        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: State 2 — Clarification
  // ============================================================
  if (currentState === 2) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-2xl bg-white rounded-lg shadow-lg p-8 border border-gray-200">
          {clarificationLoading ? (
            <div className="text-center py-8">
              <div className="text-lg font-semibold text-gray-700">Analyzing your answer...</div>
            </div>
          ) : (
            <>
              <h2 className="text-2xl font-bold mb-4">Got it. One quick question:</h2>
              <p className="text-lg text-gray-800 mb-6">{clarificationQuestion}</p>

              <div className="space-y-3 mb-6">
                {clarificationOptions.map((option, index) => (
                  <button
                    key={index}
                    className="w-full text-left p-4 border border-gray-300 rounded-lg hover:bg-gray-50 hover:border-blue-300 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors"
                    onClick={() => handleClarificationAnswer(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>

              {error && renderError(error)}

              <button
                onClick={handleBackToInput}
                className="text-blue-600 hover:text-blue-800 font-semibold flex items-center space-x-2"
              >
                <span>←</span>
                <span>Back to my goal description</span>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================================
  // RENDER: State 3 — Confirmation Gate
  // ============================================================
  if (currentState === 3) {
    const canProceed = Boolean(
      resolvedFamily &&
        resolvedSubtype &&
        resolvedStatement &&
        resolvedDeadline &&
        deadlineConfidence &&
        deadlineConfidence !== 'LOW'
    );
    const deadlineStr = resolvedDeadline
      ? new Date(resolvedDeadline).toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric'
        })
      : 'Not set';

    const confidenceLabel = {
      HIGH: 'Confirmed date',
      MED: 'Medium confidence',
      LOW: 'Needs clarification'
    }[deadlineConfidence] || 'Unknown';

    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-lg p-8 border border-gray-200">
          {!showGoalTypeCorrection && !showDeadlineCorrection && (
            <div className="space-y-6">
              <h2 className="text-2xl font-bold text-center mb-8">Here's what I understood:</h2>

              <div className="bg-gray-50 p-4 rounded-lg border-l-4 border-blue-500">
                <p className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-2">Your goal</p>
                <p className="text-lg font-medium text-gray-900 italic">"{resolvedStatement}"</p>
              </div>

              <div className="flex justify-between items-start py-4 border-b border-gray-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-1">Goal type</p>
                  <p className="text-base font-medium text-gray-900">{resolvedFamily}</p>
                  <p className="text-sm text-gray-600">{resolvedSubtype}</p>
                </div>
                <button
                  className="text-blue-600 hover:text-blue-800 font-semibold underline"
                  onClick={openGoalTypeCorrection}
                >
                  Change
                </button>
              </div>

              <div className="flex justify-between items-start py-4 border-b border-gray-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-1">Target deadline</p>
                  <p className="text-base font-medium text-gray-900">{deadlineStr}</p>
                  <p className="text-sm text-gray-600">
                    {deadlineType === 'HARD' ? 'Hard deadline' : 'Target date'}
                  </p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold uppercase tracking-wide ${
                    deadlineConfidence === 'HIGH' ? 'bg-green-100 text-green-800' :
                    deadlineConfidence === 'MED' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {confidenceLabel}
                  </span>
                  {deadlineConfidence === 'LOW' && (
                    <p className="text-red-600 text-sm mt-2 font-medium">
                      We weren't sure about this date — please confirm or correct it before proceeding.
                    </p>
                  )}
                </div>
                <button
                  className={`font-semibold underline ${
                    deadlineConfidence === 'LOW' ? 'text-red-600 hover:text-red-800' : 'text-blue-600 hover:text-blue-800'
                  }`}
                  onClick={openDeadlineCorrection}
                >
                  {deadlineConfidence === 'LOW' ? 'Set date (required)' : 'Change'}
                </button>
              </div>

              <div className="flex justify-between items-start py-4 border-b border-gray-200">
                <div className="flex-1">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-1">Priority</p>
                  <p className="text-base font-medium text-gray-900">{priorityLevel}</p>
                </div>
              </div>

              <div className="flex justify-between items-start py-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold uppercase tracking-wide text-gray-700 mb-1">Starting from</p>
                  <p className="text-base font-medium text-gray-900">
                    {currentStatus === 'NOT_STARTED' ? 'Zero' : 'Already in progress'}
                  </p>
                </div>
              </div>

              <button
                className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors mt-8"
                disabled={!canProceed || proceedLoading}
                onClick={handleProceed}
              >
                {proceedLoading ? 'Starting your plan...' : 'This is correct — proceed'}
              </button>

              {proceedError && renderProceedError(proceedError)}

              <button
                className="text-blue-600 hover:text-blue-800 font-semibold flex items-center justify-center space-x-2 mt-4"
                onClick={handleStartOver}
              >
                <span>Start over with a different goal</span>
              </button>
            </div>
          )}

          {showGoalTypeCorrection && renderGoalTypeCorrection()}
          {showDeadlineCorrection && renderDeadlineCorrection()}
        </div>
      </div>
    );
  }

  function renderGoalTypeCorrection() {
    return (
      <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Select the closest match:</h3>

        <div className="space-y-3 mb-6">
          {Object.keys(GOAL_TAXONOMY).map((family) => (
            <label key={family} className="flex items-center space-x-3 cursor-pointer">
              <input
                type="radio"
                name="correctionFamily"
                value={family}
                checked={correctionFamily === family}
                onChange={() => {
                  setCorrectionFamily(family);
                  setCorrectionSubtype(GOAL_TAXONOMY[family][0]);
                }}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-gray-900">{family}</span>
            </label>
          ))}
        </div>

        {correctionFamily && (
          <>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Then select subtype:</h3>
            <div className="space-y-3">
              {GOAL_TAXONOMY[correctionFamily].map((subtype) => (
                <label key={subtype} className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="correctionSubtype"
                    value={subtype}
                    checked={correctionSubtype === subtype}
                    onChange={() => setCorrectionSubtype(subtype)}
                    className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-gray-900">{subtype}</span>
                </label>
              ))}
            </div>
          </>
        )}

        <div className="flex space-x-4 mt-6">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={!correctionFamily || !correctionSubtype}
            onClick={applyGoalTypeCorrection}
          >
            Confirm selection
          </button>
          <button
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            onClick={() => {
              setCorrectionFamily(resolvedFamily);
              setCorrectionSubtype(resolvedSubtype);
              cancelCorrections();
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  function renderDeadlineCorrection() {
    const today = getTodayInputValue();
    const dateValue = getDateInputValue(correctionDeadline);
    const hasPastDateSelection = Boolean(dateValue && dateValue < today);

    return (
      <div className="mt-8 p-6 bg-gray-50 rounded-lg border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">When do you need this done?</h3>

        <div className="space-y-2 mb-6">
          <label className="block text-sm font-semibold uppercase tracking-wide text-gray-700">Select a date</label>
          <input
            type="date"
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={dateValue}
            min={today}
            onChange={(e) =>
              setCorrectionDeadline(e.target.value ? toStoredDeadline(e.target.value) : '')
            }
          />
          {hasPastDateSelection && (
            <div className="text-red-600 text-sm mt-1">Please choose today or a future date.</div>
          )}
        </div>

        <div className="space-y-3 mb-6">
          <label className="block text-sm font-semibold uppercase tracking-wide text-gray-700">Is this a hard deadline?</label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name="deadlineType"
              value="HARD"
              checked={correctionDeadlineType === 'HARD'}
              onChange={() => setCorrectionDeadlineType('HARD')}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-900">Yes — this date cannot move</span>
          </label>
          <label className="flex items-center space-x-3 cursor-pointer">
            <input
              type="radio"
              name="deadlineType"
              value="TARGET"
              checked={correctionDeadlineType === 'TARGET'}
              onChange={() => setCorrectionDeadlineType('TARGET')}
              className="w-4 h-4 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-gray-900">No — this is a target</span>
          </label>
        </div>

        <div className="flex space-x-4">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            disabled={!correctionDeadline || hasPastDateSelection}
            onClick={() => {
              applyDeadlineCorrection();
            }}
          >
            Confirm
          </button>
          <button
            className="bg-gray-300 text-gray-700 px-4 py-2 rounded-lg font-semibold hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-colors"
            onClick={() => {
              setCorrectionDeadline(resolvedDeadline || '');
              setCorrectionDeadlineType(deadlineType);
              cancelCorrections();
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return null;
}
