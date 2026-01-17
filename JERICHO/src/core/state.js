import React, { createContext, useContext, useEffect, useReducer, useMemo } from 'react';
import { explainTaskReasons } from './explanations.js';
import { selectTodayTasks } from './selectors.js';

function derivePriorityField(state) {
  // Priority field = today’s ranked actions, density adapts by user condition
  const today = selectTodayTasks(state).map((task) => ({
    ...task,
    explanation: explainTaskReasons(task)
  }));
  const density = state.userToday?.condition === 'overwhelmed' ? 2 : state.userToday?.condition === 'ahead' ? 5 : 3;
  const sorted = today.sort((a, b) => priorityRank(b.priority) - priorityRank(a.priority));
  return sorted.slice(0, density);
}

function priorityRank(priority) {
  if (priority === 'high') return 3;
  if (priority === 'medium') return 2;
  if (priority === 'low') return 1;
  return 0;
}

export const initialState = {
  identity: {
    name: 'N8',
    traits: ['stable', 'precise'],
    gaps: ['reach'],
    band: 'neutral',
    regulation: 'aligned' // S: Self-Discipline state descriptor
  },
  goal: {
    id: 'goal-definite',
    title: 'Grow revenue to $10k/month',
    targetDate: '2025-06-01',
    relevance: 'anchor' // Definite goal as anchor
  },
  userToday: {
    // user self-report for gap co-creation (III)
    condition: 'stable', // stable | low-energy | overwhelmed | ahead
    note: ''
  },
  projects: [
    { id: 'p1', name: 'Cycle Orchestration', status: 'active', progress: 0.35 },
    { id: 'p2', name: 'Signal Ingestion', status: 'blocked', progress: 0.18 },
    { id: 'p3', name: 'Advisor Panel', status: 'active', progress: 0.52 }
  ],
  tasks: [
    {
      id: 't1',
      title: 'Assign capabilities',
      decision: 'keep',
      governanceEligible: true,
      reasons: ['identity_priority'],
      status: 'in_progress',
      due: 'today',
      priority: 'high',
      domain: 'Creation',
      horizon: 'Today',
      start: '09:00',
      end: '10:30'
    },
    {
      id: 't2',
      title: 'Pipeline build block',
      decision: 'keep',
      governanceEligible: false,
      reasons: ['above_cycle_cap'],
      status: 'pending',
      due: 'today',
      priority: 'medium',
      domain: 'Focus',
      horizon: 'Today',
      start: '11:00',
      end: '12:00'
    },
    {
      id: 't3',
      title: 'Outcome projection',
      decision: 'defer',
      governanceEligible: false,
      reasons: ['deferred_by_compression'],
      status: 'queued',
      due: 'week',
      priority: 'low',
      domain: 'Resources',
      horizon: 'Week',
      start: '14:00',
      end: '15:00'
    },
    {
      id: 't4',
      title: 'API sync',
      decision: 'drop',
      governanceEligible: false,
      reasons: ['dropped_by_compression'],
      status: 'dropped',
      due: 'goal',
      priority: 'none',
      domain: 'Creation',
      horizon: 'Goal'
    }
  ],
  priorityField: [], // Today priority field (IV/V)
  disciplines: {
    Body: {
      Today: { label: 'Body', metric: 'light', delta: 1, state: 'pending' },
      Week: { label: 'Rest', metric: 'holding', delta: 0.2, state: 'active' },
      Month: { label: 'Recovery', metric: 'easing', delta: -1, state: 'drifting' },
      Goal: { label: 'Capacity', metric: 'tracked', delta: 0, state: 'pending' }
    },
    Resources: {
      Today: { label: 'Resources', metric: 'moderate', delta: 0, state: 'active' },
      Week: { label: 'Leads', metric: 'holding', delta: 1, state: 'active' },
      Month: { label: 'Runway', metric: 'steady', delta: 0.3, state: 'active' },
      Goal: { label: 'Sustain', metric: 'tracked', delta: 0, state: 'pending' }
    },
    Creation: {
      Today: { label: 'Creation', metric: 'heavy', delta: 0, state: 'active' },
      Week: { label: 'Review', metric: 'holding', delta: 0, state: 'active' },
      Month: { label: 'Feature', metric: 'planned', delta: 0, state: 'pending' },
      Goal: { label: 'Quality', metric: 'tracked', delta: 0, state: 'active' }
    },
    Focus: {
      Today: { label: 'Focus', metric: '90m', delta: 0, state: 'active' },
      Week: { label: 'Streak', metric: 'holding', delta: 0, state: 'pending' },
      Month: { label: 'Identity', metric: 'tracked', delta: 0, state: 'active' },
      Goal: { label: 'Definite', metric: 'aligned', delta: 0, state: 'active' }
    }
  },
  schedule: {
    today: [
      { id: 'b1', taskId: 't1', label: 'Assign capabilities', discipline: 'Creation', start: '09:00', end: '10:30', priority: true, state: 'in_progress' },
      { id: 'b2', taskId: 't2', label: 'Pipeline build', discipline: 'Focus', start: '11:00', end: '12:00', priority: false, state: 'pending' }
    ],
    week: {
      Mon: [
        { id: 'wb1', taskId: 't1', label: 'Assign capabilities', discipline: 'Creation', start: '09:00', end: '10:30', priority: true, state: 'in_progress' },
        { id: 'wb2', taskId: 't2', label: 'Pipeline build', discipline: 'Focus', start: '11:00', end: '12:00', priority: false, state: 'pending' }
      ],
      Tue: [
        { id: 'wb3', label: 'Resource push', discipline: 'Resources', start: '10:00', end: '11:00', priority: false, state: 'pending' }
      ],
      Wed: [
        { id: 'wb4', label: 'Outcome projection', discipline: 'Resources', start: '14:00', end: '15:00', priority: false, state: 'queued', taskId: 't3' }
      ],
      Thu: [],
      Fri: [],
      Sat: [],
      Sun: []
    }
  },
  metrics: {
    driftIndex: 12,
    completionRate: 68,
    streak: 0, // non-punitive; kept neutral
    riskFlags: ['Integration lag', 'Capacity compression'],
    cycleHistory: [42, 55, 61, 68, 70]
  },
  focusProjectId: 'p1'
};

const initialStore = {
  mode: 'zion',
  state: initialState
};

function attachModeToDom(mode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.mode = mode;
}

function jerichoReducer(store, action) {
  switch (action.type) {
    case 'switchMode': {
      const nextMode = action.nextMode === 'zion' ? 'zion' : 'discipline';
      attachModeToDom(nextMode);
      return { ...store, mode: nextMode };
    }
    case 'runCycle': {
      // GSPD: G->S->P->D loop baked into recompute
      const priorityField = derivePriorityField(store.state);
      const updatedTasks = store.state.tasks.map((task) => ({
        ...task,
        explanation: explainTaskReasons(task)
      }));
      return {
        ...store,
        state: {
          ...store.state,
          tasks: updatedTasks,
          priorityField
        }
      };
    }
    case 'completeTask': {
      const updatedTasks = store.state.tasks.map((task) =>
        task.id === action.taskId
          ? { ...task, status: 'completed', completedAt: new Date().toISOString() }
          : task
      );
      const completionRate = Math.min(100, store.state.metrics.completionRate + 5);
      const driftIndex = Math.max(0, (store.state.metrics.driftIndex || 0) - 3);
      const updatedScheduleToday = (store.state.schedule?.today || []).map((block) =>
        block.taskId === action.taskId ? { ...block, state: 'complete' } : block
      );
      return {
        ...store,
        state: {
          ...store.state,
          tasks: updatedTasks,
          schedule: { ...store.state.schedule, today: updatedScheduleToday },
          metrics: { ...store.state.metrics, completionRate, driftIndex }
        }
      };
    }
    case 'acknowledgeTask': {
      const updatedTasks = store.state.tasks.map((task) =>
        task.id === action.taskId ? { ...task, acknowledged: true } : task
      );
      return { ...store, state: { ...store.state, tasks: updatedTasks } };
    }
    case 'focusProject': {
      return { ...store, state: { ...store.state, focusProjectId: action.projectId } };
    }
    case 'planBlock': {
      const block = action.block;
      const todaySchedule = store.state.schedule?.today || [];
      const nextId = `b${todaySchedule.length + 1}`;
      const start = block.start || suggestStart(todaySchedule);
      const end = block.end || suggestEnd(start, block.duration || 60);
      const newBlock = {
        id: block.id || nextId,
        label: block.label,
        taskId: block.taskId,
        discipline: block.discipline || 'Discipline',
        start,
        end,
        priority: !!block.priority,
        state: 'pending'
      };
      return {
        ...store,
        state: {
          ...store.state,
          schedule: {
            ...store.state.schedule,
            today: [...todaySchedule, newBlock]
          }
        }
      };
    }
    case 'setUserCondition': {
      const condition = action.condition || 'stable';
      return { ...store, state: { ...store.state, userToday: { ...store.state.userToday, condition } } };
    }
    default:
      return store;
  }
}

function suggestStart(blocks = []) {
  if (!blocks.length) return '08:00';
  const last = blocks[blocks.length - 1];
  return last.end || '09:00';
}

function suggestEnd(start, durationMinutes = 60) {
  if (!start) return '09:00';
  const [h, m] = start.split(':').map(Number);
  const total = h * 60 + (m || 0) + durationMinutes;
  const newH = Math.floor(total / 60)
    .toString()
    .padStart(2, '0');
  const newM = (total % 60).toString().padStart(2, '0');
  return `${newH}:${newM}`;
}

const JerichoContext = createContext(null);

export const JerichoProvider = ({ children, initialMode, initialData }) => {
  const seed = useMemo(
    () => ({
      mode: initialMode || initialStore.mode,
      state: initialData || initialStore.state
    }),
    [initialMode, initialData]
  );

  const [store, dispatch] = useReducer(jerichoReducer, seed);

  useEffect(() => {
    attachModeToDom(store.mode);
  }, [store.mode]);

  const actions = useMemo(
    () => ({
      switchMode: (nextMode) => dispatch({ type: 'switchMode', nextMode }),
      runCycle: () => dispatch({ type: 'runCycle' }),
      completeTask: (taskId) => dispatch({ type: 'completeTask', taskId }),
      acknowledgeTask: (taskId) => dispatch({ type: 'acknowledgeTask', taskId }),
      focusProject: (projectId) => dispatch({ type: 'focusProject', projectId }),
      planBlock: (block) => dispatch({ type: 'planBlock', block }),
      setUserCondition: (condition) => dispatch({ type: 'setUserCondition', condition })
    }),
    []
  );

  const value = useMemo(() => ({ ...store, ...actions }), [store, actions]);

  return React.createElement(JerichoContext.Provider, { value }, children);
};

export const useJericho = () => {
  const ctx = useContext(JerichoContext);
  if (!ctx) throw new Error('useJericho must be used within JerichoProvider');
  return ctx;
};

export { jerichoReducer, initialStore, derivePriorityField };
