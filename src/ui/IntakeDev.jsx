import { useState } from 'react';
import GoalIntakeUI from '../components/intake/GoalIntakeUI.jsx';
import FeasibilityDisplay from '../components/feasibility/FeasibilityDisplay.jsx';
import ScheduleProposalView from '../components/scheduling/ScheduleProposalView.jsx';
import CalendarView from '../components/calendar/CalendarView.jsx';

void GoalIntakeUI;
void FeasibilityDisplay;
void ScheduleProposalView;
void CalendarView;

export default function IntakeDev() {
  const [stage, setStage] = useState('intake');
  const [goalPayload, setGoalPayload] = useState(null);
  const [feasibilityPayload, setFeasibilityPayload] = useState(null);
  const [scheduleResult, setScheduleResult] = useState(null);

  if (stage === 'intake') {
    return (
      <GoalIntakeUI
        onConfirmed={(payload) => {
          setGoalPayload(payload);
          setStage('feasibility');
        }}
      />
    );
  }

  if (stage === 'done') {
    return (
      <div style={shellStyle}>
        <CalendarView
          schedulePayload={scheduleResult}
          onComplete={(result) => {
            console.log('All blocks marked:', result);
            setStage('finished');
          }}
        />
      </div>
    );
  }

  if (stage === 'finished') {
    return (
      <div style={shellStyle}>
        <h2>Schedule complete</h2>
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
