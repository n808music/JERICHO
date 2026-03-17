import { useState } from 'react';
import GoalIntakeUI from '../components/intake/GoalIntakeUI.jsx';
import FeasibilityDisplay from '../components/feasibility/FeasibilityDisplay.jsx';
import ScheduleProposalView from '../components/scheduling/ScheduleProposalView.jsx';

void GoalIntakeUI;
void FeasibilityDisplay;
void ScheduleProposalView;

export default function IntakeDev() {
  const [stage, setStage] = useState('intake');
  const [goalPayload, setGoalPayload] = useState(null);
  const [feasibilityPayload, setFeasibilityPayload] = useState(null);
  const [scheduleResult, setScheduleResult] = useState(null);
  const shellStyle = { maxWidth: '600px', margin: '40px auto', padding: '0 20px' };

  if (stage === 'intake') {
    return (
      <div style={shellStyle}>
        <GoalIntakeUI
          onConfirmed={(payload) => {
            setGoalPayload(payload);
            setStage('feasibility');
          }}
        />
      </div>
    );
  }

  if (stage === 'done') {
    return (
      <div style={shellStyle}>
        <h2>Schedule committed</h2>
        <pre style={{ background: '#f4f4f4', padding: 16, borderRadius: 8 }}>
          {JSON.stringify(scheduleResult, null, 2)}
        </pre>
        <button
          onClick={() => {
            setStage('intake');
            setGoalPayload(null);
            setFeasibilityPayload(null);
            setScheduleResult(null);
          }}
        >
          Start over
        </button>
      </div>
    );
  }

  return (
    <>
      {goalPayload && (
        <div style={{ ...shellStyle, display: stage === 'feasibility' ? 'block' : 'none' }}>
        <FeasibilityDisplay
          goalPayload={goalPayload}
          onConfirmed={(result) => {
            setFeasibilityPayload(result);
            setStage('scheduling');
          }}
          onAdjustGoal={() => {
            setGoalPayload(null);
            setFeasibilityPayload(null);
            setScheduleResult(null);
            setStage('intake');
          }}
        />
        </div>
      )}

      {feasibilityPayload && (
        <div style={{ ...shellStyle, display: stage === 'scheduling' ? 'block' : 'none' }}>
        <ScheduleProposalView
          feasibilityPayload={feasibilityPayload}
          onConfirmed={(result) => {
            setScheduleResult(result);
            setStage('done');
          }}
          onAdjustFeasibility={() => setStage('feasibility')}
        />
        </div>
      )}
    </>
  );
}
