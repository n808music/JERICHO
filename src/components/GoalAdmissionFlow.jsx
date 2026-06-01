import React, { useState, useEffect } from 'react';

/**
 * GoalAdmissionFlow - Structured Intake UI (Prompt 13b)
 *
 * 5-screen progressive intake flow:
 * Screen 1: Goal classification (digital/physical product, consumable branching)
 * Screen 2: Timeline & availability (execution context, weekly hours)
 * Screen 3: Capital assessment (available capital, audience if needed)
 * Screen 4: Legal & assets (entity status, state, experience)
 * Screen 5: Feasibility review (VIABLE/CAPITAL_CONSTRAINED/VIABLE_WITH_ACQUISITION, presale math)
 *
 * Removed surfaces: Causal Chain, Reinforcement Disclosure, Sacrifice field
 * Added: Presale math display, Illinois Series LLC surfacing, honest capital framing
 */

// Type definitions
const IntakeProgressState = {
  currentScreen: 1,
  screen1: null,
  screen2: null,
  screen3: null,
  screen4: null,
  feasibilityResult: null,
  intakeFeasibilityReport: null,
  selectedPivot: null,
  immutabilityAcknowledged: false,
};

const PrePlanFeasibilityResult = {
  status: '',
  explanation: '',
};

const SCREENS = {
  RESUME: 0,
  GOAL_CLASSIFICATION: 1,
  TIMELINE_AVAILABILITY: 2,
  CAPITAL_ASSESSMENT: 3,
  LEGAL_ASSETS: 4,
  FEASIBILITY_REVIEW: 5,
};

const PROGRESS_LABELS = {
  [SCREENS.GOAL_CLASSIFICATION]: 'Your goal',
  [SCREENS.TIMELINE_AVAILABILITY]: 'Timeline',
  [SCREENS.CAPITAL_ASSESSMENT]: 'Capital',
  [SCREENS.LEGAL_ASSETS]: 'Assets',
  [SCREENS.FEASIBILITY_REVIEW]: 'Review',
};

export default function GoalAdmissionFlow({
  onGeneratePlan,
  onAspire,
  onStateChange,
  savedState,
  appTimeISO,
}) {
  const [currentScreen, setCurrentScreen] = useState(savedState ? SCREENS.RESUME : SCREENS.GOAL_CLASSIFICATION);
  const [intakeProgress, setIntakeProgress] = useState(savedState || {
    currentScreen: SCREENS.GOAL_CLASSIFICATION,
    screen1: null,
    screen2: null,
    screen3: null,
    screen4: null,
    feasibilityResult: null,
    intakeFeasibilityReport: null,
    selectedPivot: null,
    immutabilityAcknowledged: false,
  });

  // Update parent with state changes
  useEffect(() => {
    onStateChange?.(intakeProgress);
  }, [intakeProgress, onStateChange]);

  const updateIntakeProgress = (updates) => {
    setIntakeProgress(prev => ({ ...prev, ...updates }));
  };

  const advanceScreen = () => {
    const nextScreen = currentScreen + 1;
    setCurrentScreen(nextScreen);
    updateIntakeProgress({ currentScreen: nextScreen });
  };

  const goBack = () => {
    if (currentScreen > SCREENS.GOAL_CLASSIFICATION) {
      const prevScreen = currentScreen - 1;
      setCurrentScreen(prevScreen);
      updateIntakeProgress({ currentScreen: prevScreen });
    }
  };

  const handleResume = () => {
    setCurrentScreen(intakeProgress.currentScreen);
  };

  const handleStartOver = () => {
    setCurrentScreen(SCREENS.GOAL_CLASSIFICATION);
    setIntakeProgress({
      currentScreen: SCREENS.GOAL_CLASSIFICATION,
      screen1: null,
      screen2: null,
      screen3: null,
      screen4: null,
      feasibilityResult: null,
      intakeFeasibilityReport: null,
      selectedPivot: null,
      immutabilityAcknowledged: false,
    });
  };

  const generatePlan = () => {
    // Assemble intake from progress state
    const intake = assembleIntakeFromProgress(intakeProgress);
    onGeneratePlan(intake);
  };

  // Resume prompt
  if (currentScreen === SCREENS.RESUME) {
    return (
      <div className="intake-resume">
        <h2>Intake in progress</h2>
        <p>You were working on your goal intake. Would you like to continue where you left off?</p>
        <div className="resume-actions">
          <button onClick={handleResume}>Continue where you left off</button>
          <button onClick={handleStartOver}>Start over</button>
        </div>
      </div>
    );
  }

  return (
    <div className="goal-admission-flow">
      {/* Progress indicator */}
      <div className="progress-indicator">
        {Object.entries(PROGRESS_LABELS).map(([screenNum, label]) => (
          <div
            key={screenNum}
            className={`progress-step ${parseInt(screenNum) <= currentScreen ? 'completed' : ''} ${parseInt(screenNum) === currentScreen ? 'current' : ''}`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* Screen content */}
      <div className="screen-content">
        {currentScreen === SCREENS.GOAL_CLASSIFICATION && (
          <Screen1
            data={intakeProgress.screen1}
            onUpdate={(screen1) => updateIntakeProgress({ screen1 })}
            onContinue={advanceScreen}
          />
        )}

        {currentScreen === SCREENS.TIMELINE_AVAILABILITY && (
          <Screen2
            data={intakeProgress.screen2}
            onUpdate={(screen2) => updateIntakeProgress({ screen2 })}
            onContinue={advanceScreen}
            onBack={goBack}
          />
        )}

        {currentScreen === SCREENS.CAPITAL_ASSESSMENT && (
          <Screen3
            data={intakeProgress.screen3}
            onUpdate={(screen3) => updateIntakeProgress({ screen3 })}
            onContinue={advanceScreen}
            onBack={goBack}
          />
        )}

        {currentScreen === SCREENS.LEGAL_ASSETS && (
          <Screen4
            data={intakeProgress.screen4}
            onUpdate={(screen4) => updateIntakeProgress({ screen4 })}
            onContinue={advanceScreen}
            onBack={goBack}
          />
        )}

        {currentScreen === SCREENS.FEASIBILITY_REVIEW && (
          <Screen5
            intakeProgress={intakeProgress}
            onUpdate={updateIntakeProgress}
            onGeneratePlan={generatePlan}
            onBack={goBack}
            appTimeISO={appTimeISO}
          />
        )}
      </div>
    </div>
  );
}

// Screen 1: Goal Classification
function Screen1({ data, onUpdate, onContinue }) {
  const [goalDescription, setGoalDescription] = useState(data?.goalDescription || '');
  const [goalType, setGoalType] = useState(data?.goalType || '');
  const [isConsumable, setIsConsumable] = useState(data?.isConsumable);
  const [formulaPathway, setFormulaPathway] = useState(data?.formulaPathway);

  const handleContinue = () => {
    if (!goalDescription.trim()) return;
    if (!goalType) return;

    onUpdate({
      goalDescription: goalDescription.trim(),
      goalType,
      isConsumable,
      formulaPathway,
    });
    onContinue();
  };

  return (
    <div className="screen screen1">
      <h2>What are you trying to do?</h2>

      <div className="form-group">
        <label htmlFor="goal-description">Describe your goal</label>
        <textarea
          id="goal-description"
          value={goalDescription}
          onChange={(e) => setGoalDescription(e.target.value)}
          placeholder="Launch a caffeinated gum brand and make my first real sale..."
          required
        />
      </div>

      <div className="form-group">
        <label>What type of goal is this?</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              value="digital_product"
              checked={goalType === 'digital_product'}
              onChange={(e) => setGoalType(e.target.value)}
            />
            Digital product
          </label>
          <label>
            <input
              type="radio"
              value="physical_product"
              checked={goalType === 'physical_product'}
              onChange={(e) => setGoalType(e.target.value)}
            />
            Physical product
          </label>
          <label>
            <input
              type="radio"
              value="service_business"
              checked={goalType === 'service_business'}
              onChange={(e) => setGoalType(e.target.value)}
            />
            Service business
          </label>
        </div>
      </div>

      {goalType === 'physical_product' && (
        <div className="form-group">
          <label>Is this product ingested?</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value={true}
                checked={isConsumable === true}
                onChange={(e) => setIsConsumable(true)}
              />
              Yes, it is ingested
            </label>
            <label>
              <input
                type="radio"
                value={false}
                checked={isConsumable === false}
                onChange={(e) => setIsConsumable(false)}
              />
              No, it is not ingested
            </label>
          </div>
        </div>
      )}

      {isConsumable && (
        <div className="form-group">
          <label>How do you plan to develop the product formula?</label>
          <div className="radio-group">
            <label>
              <input
                type="radio"
                value="white_label"
                checked={formulaPathway === 'white_label'}
                onChange={(e) => setFormulaPathway(e.target.value)}
              />
              Use a manufacturer's existing formula and branding
            </label>
            <label>
              <input
                type="radio"
                value="custom"
                checked={formulaPathway === 'custom'}
                onChange={(e) => setFormulaPathway(e.target.value)}
              />
              Develop a custom formula
            </label>
            <label>
              <input
                type="radio"
                value="help_me_decide"
                checked={formulaPathway === 'help_me_decide'}
                onChange={(e) => setFormulaPathway(e.target.value)}
              />
              Help me decide
            </label>
          </div>
        </div>
      )}

      <div className="screen-actions">
        <button
          onClick={handleContinue}
          disabled={!goalDescription.trim() || !goalType}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// Screen 2: Timeline & Availability
function Screen2({ data, onUpdate, onContinue, onBack }) {
  const [executionContext, setExecutionContext] = useState(data?.executionContext || '');
  const [weeklyHours, setWeeklyHours] = useState(data?.weeklyHours || '');
  const [relationships, setRelationships] = useState(data?.relationships || []);

  const handleContinue = () => {
    if (!executionContext || !weeklyHours) return;

    onUpdate({
      executionContext,
      weeklyHours: parseInt(weeklyHours),
      relationships,
    });
    onContinue();
  };

  return (
    <div className="screen screen2">
      <h2>When and how?</h2>

      <div className="form-group">
        <label>How much time can you dedicate?</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              value="full_time"
              checked={executionContext === 'full_time'}
              onChange={(e) => setExecutionContext(e.target.value)}
            />
            This is my main focus
          </label>
          <label>
            <input
              type="radio"
              value="part_time"
              checked={executionContext === 'part_time'}
              onChange={(e) => setExecutionContext(e.target.value)}
            />
            Alongside a full-time job
          </label>
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="weekly-hours">How many hours per week?</label>
        <input
          id="weekly-hours"
          type="number"
          value={weeklyHours}
          onChange={(e) => setWeeklyHours(e.target.value)}
          min="1"
          max="168"
          required
        />
      </div>

      <div className="form-group">
        <label>Do you have existing relationships that could help?</label>
        <div className="checkbox-group">
          <label>
            <input
              type="checkbox"
              value="manufacturer"
              checked={relationships.includes('manufacturer')}
              onChange={(e) => {
                const newRelationships = e.target.checked
                  ? [...relationships, 'manufacturer']
                  : relationships.filter(r => r !== 'manufacturer');
                setRelationships(newRelationships);
              }}
            />
            Manufacturer or supplier contact
          </label>
          <label>
            <input
              type="checkbox"
              value="distributor"
              checked={relationships.includes('distributor')}
              onChange={(e) => {
                const newRelationships = e.target.checked
                  ? [...relationships, 'distributor']
                  : relationships.filter(r => r !== 'distributor');
                setRelationships(newRelationships);
              }}
            />
            Distributor contact
          </label>
          <label>
            <input
              type="checkbox"
              value="none"
              checked={relationships.includes('none')}
              onChange={(e) => {
                const newRelationships = e.target.checked
                  ? ['none']
                  : relationships.filter(r => r !== 'none');
                setRelationships(newRelationships);
              }}
            />
            None of the above — starting from scratch
          </label>
        </div>
      </div>

      <div className="screen-actions">
        <button onClick={onBack}>Back</button>
        <button
          onClick={handleContinue}
          disabled={!executionContext || !weeklyHours}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// Screen 3: Capital Assessment
function Screen3({ data, onUpdate, onContinue, onBack }) {
  const [capitalAvailable, setCapitalAvailable] = useState(data?.capitalAvailable || '');
  const [capitalConfidence, setCapitalConfidence] = useState(data?.capitalConfidence || '');
  const [audience, setAudience] = useState(data?.audience || []);

  const needsAudience = parseFloat(capitalAvailable) < 5000;

  const handleContinue = () => {
    if (!capitalAvailable || !capitalConfidence) return;
    if (needsAudience && audience.length === 0) return;

    onUpdate({
      capitalAvailable: parseFloat(capitalAvailable),
      capitalConfidence,
      audience: needsAudience ? audience : null,
    });
    onContinue();
  };

  return (
    <div className="screen screen3">
      <h2>How much money?</h2>

      <div className="form-group">
        <label htmlFor="capital-available">How much capital do you have available?</label>
        <input
          id="capital-available"
          type="number"
          value={capitalAvailable}
          onChange={(e) => setCapitalAvailable(e.target.value)}
          min="0"
          step="100"
          required
        />
      </div>

      <div className="form-group">
        <label>How confident are you in this amount?</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              value="confirmed"
              checked={capitalConfidence === 'confirmed'}
              onChange={(e) => setCapitalConfidence(e.target.value)}
            />
            Confirmed — it is available now
          </label>
          <label>
            <input
              type="radio"
              value="estimated"
              checked={capitalConfidence === 'estimated'}
              onChange={(e) => setCapitalConfidence(e.target.value)}
            />
            Estimated — I need to confirm availability
          </label>
        </div>
      </div>

      {needsAudience && (
        <div className="form-group">
          <label>Do you have an existing audience you can sell to?</label>
          <p className="help-text">Since your available capital is under $5,000, having an existing audience increases your chances of success.</p>

          {audience.map((item, index) => (
            <div key={index} className="audience-item">
              <select
                value={item.platform}
                onChange={(e) => {
                  const newAudience = [...audience];
                  newAudience[index] = { ...newAudience[index], platform: e.target.value };
                  setAudience(newAudience);
                }}
              >
                <option value="">Select platform</option>
                <option value="instagram">Instagram</option>
                <option value="twitter">Twitter</option>
                <option value="linkedin">LinkedIn</option>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="spotify">Spotify</option>
                <option value="email">Email list</option>
                <option value="website">Website/blog</option>
              </select>

              <input
                type="number"
                placeholder="Size"
                value={item.size || ''}
                onChange={(e) => {
                  const newAudience = [...audience];
                  newAudience[index] = { ...newAudience[index], size: parseInt(e.target.value) };
                  setAudience(newAudience);
                }}
              />

              <select
                value={item.relationship}
                onChange={(e) => {
                  const newAudience = [...audience];
                  newAudience[index] = { ...newAudience[index], relationship: e.target.value };
                  setAudience(newAudience);
                }}
              >
                <option value="">Relationship</option>
                <option value="owned">Owned audience</option>
                <option value="creative_work">Creative work</option>
                <option value="professional">Professional network</option>
              </select>

              <button
                type="button"
                onClick={() => {
                  const newAudience = audience.filter((_, i) => i !== index);
                  setAudience(newAudience);
                }}
              >
                Remove
              </button>
            </div>
          ))}

          <button
            type="button"
            onClick={() => setAudience([...audience, { platform: '', size: '', relationship: '' }])}
          >
            Add another
          </button>
        </div>
      )}

      <div className="screen-actions">
        <button onClick={onBack}>Back</button>
        <button
          onClick={handleContinue}
          disabled={!capitalAvailable || !capitalConfidence || (needsAudience && audience.length === 0)}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// Screen 4: Legal & Assets
function Screen4({ data, onUpdate, onContinue, onBack }) {
  const [hasEntity, setHasEntity] = useState(data?.hasEntity);
  const [entityType, setEntityType] = useState(data?.entityType || '');
  const [entityState, setEntityState] = useState(data?.entityState || '');
  const [entityPurpose, setEntityPurpose] = useState(data?.entityPurpose || '');
  const [businessPurpose, setBusinessPurpose] = useState(data?.businessPurpose || '');
  const [hasExperience, setHasExperience] = useState(data?.hasExperience);

  const handleContinue = () => {
    if (hasEntity === null) return;
    if (hasEntity && (!entityType || !entityState)) return;
    if (hasExperience === null) return;

    onUpdate({
      hasEntity,
      entityType: hasEntity ? entityType : null,
      entityState: hasEntity ? entityState : null,
      entityPurpose: hasEntity ? entityPurpose : null,
      businessPurpose: hasEntity ? businessPurpose : null,
      hasExperience,
    });
    onContinue();
  };

  return (
    <div className="screen screen4">
      <h2>Your existing assets</h2>

      <div className="form-group">
        <label>Do you have an existing legal entity?</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              checked={hasEntity === true}
              onChange={() => setHasEntity(true)}
            />
            Yes
          </label>
          <label>
            <input
              type="radio"
              checked={hasEntity === false}
              onChange={() => setHasEntity(false)}
            />
            No
          </label>
        </div>
      </div>

      {hasEntity && (
        <>
          <div className="form-group">
            <label htmlFor="entity-type">What type of entity?</label>
            <select
              id="entity-type"
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              required
            >
              <option value="">Select entity type</option>
              <option value="LLC">LLC</option>
              <option value="Corporation">Corporation</option>
              <option value="Partnership">Partnership</option>
              <option value="Sole Proprietorship">Sole Proprietorship</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="entity-state">What state is it registered in?</label>
            <select
              id="entity-state"
              value={entityState}
              onChange={(e) => setEntityState(e.target.value)}
              required
            >
              <option value="">Select state</option>
              <option value="AL">Alabama</option>
              <option value="AK">Alaska</option>
              <option value="AZ">Arizona</option>
              <option value="AR">Arkansas</option>
              <option value="CA">California</option>
              <option value="CO">Colorado</option>
              <option value="CT">Connecticut</option>
              <option value="DE">Delaware</option>
              <option value="FL">Florida</option>
              <option value="GA">Georgia</option>
              <option value="HI">Hawaii</option>
              <option value="ID">Idaho</option>
              <option value="IL">Illinois</option>
              <option value="IN">Indiana</option>
              <option value="IA">Iowa</option>
              <option value="KS">Kansas</option>
              <option value="KY">Kentucky</option>
              <option value="LA">Louisiana</option>
              <option value="ME">Maine</option>
              <option value="MD">Maryland</option>
              <option value="MA">Massachusetts</option>
              <option value="MI">Michigan</option>
              <option value="MN">Minnesota</option>
              <option value="MS">Mississippi</option>
              <option value="MO">Missouri</option>
              <option value="MT">Montana</option>
              <option value="NE">Nebraska</option>
              <option value="NV">Nevada</option>
              <option value="NH">New Hampshire</option>
              <option value="NJ">New Jersey</option>
              <option value="NM">New Mexico</option>
              <option value="NY">New York</option>
              <option value="NC">North Carolina</option>
              <option value="ND">North Dakota</option>
              <option value="OH">Ohio</option>
              <option value="OK">Oklahoma</option>
              <option value="OR">Oregon</option>
              <option value="PA">Pennsylvania</option>
              <option value="RI">Rhode Island</option>
              <option value="SC">South Carolina</option>
              <option value="SD">South Dakota</option>
              <option value="TN">Tennessee</option>
              <option value="TX">Texas</option>
              <option value="UT">Utah</option>
              <option value="VT">Vermont</option>
              <option value="VA">Virginia</option>
              <option value="WA">Washington</option>
              <option value="WV">West Virginia</option>
              <option value="WI">Wisconsin</option>
              <option value="WY">Wyoming</option>
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="entity-purpose">What is it currently used for?</label>
            <input
              id="entity-purpose"
              type="text"
              value={entityPurpose}
              onChange={(e) => setEntityPurpose(e.target.value)}
              placeholder="e.g., Consulting business, Real estate holding"
            />
          </div>

          <div className="form-group">
            <label>Will this new business use the same entity?</label>
            <div className="radio-group">
              <label>
                <input
                  type="radio"
                  value="same_business"
                  checked={businessPurpose === 'same_business'}
                  onChange={(e) => setBusinessPurpose(e.target.value)}
                />
                Same business
              </label>
              <label>
                <input
                  type="radio"
                  value="different_business"
                  checked={businessPurpose === 'different_business'}
                  onChange={(e) => setBusinessPurpose(e.target.value)}
                />
                Different business
              </label>
            </div>
          </div>
        </>
      )}

      <div className="form-group">
        <label>Have you started a business before?</label>
        <div className="radio-group">
          <label>
            <input
              type="radio"
              checked={hasExperience === true}
              onChange={() => setHasExperience(true)}
            />
            Yes
          </label>
          <label>
            <input
              type="radio"
              checked={hasExperience === false}
              onChange={() => setHasExperience(false)}
            />
            No
          </label>
        </div>
      </div>

      <div className="screen-actions">
        <button onClick={onBack}>Back</button>
        <button
          onClick={handleContinue}
          disabled={hasEntity === null || (hasEntity && (!entityType || !entityState)) || hasExperience === null}
        >
          Continue
        </button>
      </div>
    </div>
  );
}

// Screen 5: Feasibility Review
function Screen5({ intakeProgress, onUpdate, onGeneratePlan, onBack, appTimeISO }) {
  const [immutabilityAcknowledged, setImmutabilityAcknowledged] = useState(intakeProgress.immutabilityAcknowledged);

  // Calculate feasibility when screen loads
  useEffect(() => {
    if (!intakeProgress.feasibilityResult) {
      const result = calculateFeasibility(intakeProgress, appTimeISO);
      onUpdate({ feasibilityResult: result });
    }
  }, [intakeProgress, appTimeISO, onUpdate]);

  const handleGeneratePlan = () => {
    if (!immutabilityAcknowledged) return;
    onGeneratePlan();
  };

  const { feasibilityResult } = intakeProgress;

  return (
    <div className="screen screen5">
      <h2>Feasibility Result</h2>

      {feasibilityResult && (
        <div className="feasibility-result">
          {feasibilityResult.status === 'VIABLE' && (
            <div className="viable-result">
              <h3>Your goal is viable.</h3>
              <p>{feasibilityResult.explanation}</p>
            </div>
          )}

          {feasibilityResult.status === 'CAPITAL_CONSTRAINED' && (
            <div className="constrained-result">
              <h3>Requires more capital than you currently have</h3>
              <p>{feasibilityResult.explanation}</p>
              <div className="capital-gap">
                <strong>Gap: ${feasibilityResult.gap?.toLocaleString()}</strong>
                <p>Required by {feasibilityResult.estimatedTiming}</p>
              </div>
              <div className="alternatives">
                <h4>Alternatives:</h4>
                <ul>
                  <li>Reduce scope to fit available capital</li>
                  <li>Find additional funding sources</li>
                  <li>Extend timeline to reduce monthly burn</li>
                </ul>
              </div>
            </div>
          )}

          {feasibilityResult.status === 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED' && (
            <div className="acquisition-result">
              <h3>Viable with a capital acquisition track</h3>
              <p>{feasibilityResult.explanation}</p>

              {/* Presale math for gum goal */}
              {intakeProgress.screen1?.goalDescription?.toLowerCase().includes('gum') && (
                <div className="presale-math">
                  <h4>Presale Opportunity</h4>
                  <div className="math-breakdown">
                    <div>Target: $8,000 (200 orders × $40)</div>
                    <div>Conversion: 0.87%</div>
                    <div>Traffic needed: ~230,000 visitors</div>
                  </div>
                </div>
              )}

              {/* Illinois Series LLC surfacing */}
              {intakeProgress.screen4?.entityState === 'IL' &&
               intakeProgress.screen4?.businessPurpose === 'different_business' && (
                <div className="illinois-series-llc">
                  <h4>Illinois Series LLC Option</h4>
                  <p>Since you're in Illinois with an existing LLC for a different business, consider forming a Series LLC for this new venture. This provides liability protection while leveraging your existing entity.</p>
                </div>
              )}
            </div>
          )}

          {feasibilityResult.status === 'VIABLE_WITH_ADJUSTED_TIMELINE' && (
            <div className="adjusted-timeline-result">
              <h3>Viable, but not by {feasibilityResult.statedDeadline}</h3>
              <p>{feasibilityResult.explanation}</p>

              <div className="pivot-options">
                <h4>Choose your approach:</h4>
                <div className="pivot-buttons">
                  <button>Use this approach</button>
                  <button>Adjust timeline</button>
                  <button>Reduce scope</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="immutability-acknowledgment">
        <label>
          <input
            type="checkbox"
            checked={immutabilityAcknowledged}
            onChange={(e) => {
              setImmutabilityAcknowledged(e.target.checked);
              onUpdate({ immutabilityAcknowledged: e.target.checked });
            }}
          />
          I understand and am ready to commit to this plan. My answers above are immutable and will guide the creation of my execution plan.
        </label>
      </div>

      <div className="screen-actions">
        <button onClick={onBack}>Back</button>
        <button
          onClick={handleGeneratePlan}
          disabled={!immutabilityAcknowledged || !feasibilityResult}
        >
          Generate Plan
        </button>
      </div>
    </div>
  );
}

// Helper functions
function assembleIntakeFromProgress(progress) {
  return {
    goalDescription: progress.screen1?.goalDescription,
    goalClassification: progress.screen1?.goalType,
    isConsumable: progress.screen1?.isConsumable,
    formulaPathway: progress.screen1?.formulaPathway,
    executionContext: progress.screen2?.executionContext,
    weeklyHours: progress.screen2?.weeklyHours,
    relationships: progress.screen2?.relationships,
    capitalAvailable: progress.screen3?.capitalAvailable,
    capitalConfidence: progress.screen3?.capitalConfidence,
    audience: progress.screen3?.audience,
    legalFoundation: {
      hasEntity: progress.screen4?.hasEntity,
      entityType: progress.screen4?.entityType,
      entityState: progress.screen4?.entityState,
      entityPurpose: progress.screen4?.entityPurpose,
      businessPurpose: progress.screen4?.businessPurpose,
      gumEntityExists: progress.screen4?.businessPurpose === 'different_business',
    },
    hasExperience: progress.screen4?.hasExperience,
    feasibilityResult: progress.feasibilityResult,
    immutabilityAcknowledged: progress.immutabilityAcknowledged,
  };
}

function calculateFeasibility(progress, appTimeISO) {
  // Simplified feasibility calculation
  const capital = progress.screen3?.capitalAvailable || 0;
  const hasAudience = progress.screen3?.audience?.length > 0;
  const hasExperience = progress.screen4?.hasExperience;
  const isGumGoal = progress.screen1?.goalDescription?.toLowerCase().includes('gum');

  if (isGumGoal && capital < 2000) {
    return {
      status: 'VIABLE_WITH_CAPITAL_ACQUISITION_REQUIRED',
      explanation: 'Your caffeinated gum goal is viable but requires capital acquisition to cover production and regulatory costs.',
    };
  }

  if (capital < 5000 && !hasAudience) {
    return {
      status: 'CAPITAL_CONSTRAINED',
      explanation: 'Your available capital is below the minimum threshold for this type of venture.',
      gap: 5000 - capital,
      estimatedTiming: 'month 3',
      userCapital: capital,
    };
  }

  return {
    status: 'VIABLE',
    explanation: 'Your goal appears viable with the provided information.',
  };
}