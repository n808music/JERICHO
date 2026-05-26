import { useState } from 'react';
import Button from './components/ui/Button.jsx';
import openRouterService from './services/openrouter.js';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';

function TechFlowApp() {
  const [objective, setObjective] = useState('');
  const [timeHorizon, setTimeHorizon] = useState('monthly');
  const [isDecomposing, setIsDecomposing] = useState(false);
  const [decomposition, setDecomposition] = useState(null);
  const [error, setError] = useState('');

  const handleDecompose = async () => {
    if (!objective.trim()) {
      setError('Please enter an objective');
      return;
    }

    setIsDecomposing(true);
    setError('');

    try {
      const context = {
        teamSize: '3-5 developers',
        resources: 'React, Node.js, OpenRouter API',
        constraints: 'Time to market priority'
      };

      const result = await openRouterService.decomposeTask(
        objective,
        timeHorizon,
        context
      );
      setDecomposition(result);
    } catch (err) {
      setError(err.message || 'Failed to decompose task. Please try again.');
      console.error('Decomposition error:', err);
    } finally {
      setIsDecomposing(false);
    }
  };

  const renderTaskCard = (task) => (
    <div className="tf-card tf-p-4 tf-mb-3" key={task.id}>
      <div className="tf-flex tf-justify-between tf-items-start tf-mb-2">
        <h3 className="tf-font-semibold tf-text-lg">{task.title}</h3>
        <span
          className={`tf-px-2 tf-py-1 tf-text-xs tf-font-medium tf-rounded ${
            task.priority === 'high'
              ? 'tf-bg-error tf-text-neutral'
              : task.priority === 'medium'
                ? 'tf-bg-warning tf-text-neutral'
                : 'tf-bg-success tf-text-neutral'
          }`}
        >
          {task.priority.toUpperCase()}
        </span>
      </div>
      <p className="tf-text-sm tf-text-neutral tf-mb-3">{task.description}</p>
      <div className="tf-flex tf-gap-4 tf-text-sm">
        <div>
          <strong>Time:</strong> {task.estimatedHours}h
        </div>
        <div>
          <strong>Horizon:</strong> {task.timeHorizon}
        </div>
        <div>
          <strong>Category:</strong> {task.category}
        </div>
      </div>
    </div>
  );

  return (
    <div className="TechFlowApp tf-p-6">
      <header className="tf-mb-8">
        <h1 className="tf-text-4xl tf-font-bold tf-mb-2">TechFlow</h1>
        <p className="tf-text-xl tf-text-neutral">
          Strategic Task Planner with AI-Powered Decomposition
        </p>
      </header>

      <main className="tf-max-w-4xl tf-mx-auto">
        {/* Objective Input Section */}
        <section className="tf-card tf-p-6 tf-mb-8">
          <h2 className="tf-text-2xl tf-font-semibold tf-mb-4">
            Define Your Objective
          </h2>

          <div className="tf-mb-4">
            <label
              htmlFor="objective"
              className="tf-block tf-text-sm tf-font-medium tf-mb-2"
            >
              Strategic Objective
            </label>
            <textarea
              id="objective"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g., Launch new user authentication system by Q2"
              className="tf-w-full tf-p-3 tf-border tf-rounded tf-resize-y"
              rows={3}
            />
          </div>

          <div className="tf-mb-4">
            <label
              htmlFor="timeHorizon"
              className="tf-block tf-text-sm tf-font-medium tf-mb-2"
            >
              Planning Horizon
            </label>
            <select
              id="timeHorizon"
              value={timeHorizon}
              onChange={(e) => setTimeHorizon(e.target.value)}
              className="tf-w-full tf-p-3 tf-border tf-rounded"
            >
              <option value="daily">Daily Planning</option>
              <option value="weekly">Weekly Planning</option>
              <option value="monthly">Monthly Planning</option>
              <option value="quarterly">Quarterly Planning</option>
              <option value="annual">Annual Planning</option>
            </select>
          </div>

          <div className="tf-flex tf-gap-3">
            <Button
              onClick={handleDecompose}
              loading={isDecomposing}
              disabled={!objective.trim()}
              variant="primary"
              size="lg"
            >
              {isDecomposing ? 'Decomposing...' : 'Decompose Task'}
            </Button>
            <Button
              onClick={() => {
                setObjective('');
                setDecomposition(null);
                setError('');
              }}
              variant="ghost"
            >
              Clear
            </Button>
          </div>

          {error && (
            <div className="tf-mt-4 tf-p-3 tf-bg-error tf-text-error tf-rounded">
              <strong>Error:</strong> {error}
            </div>
          )}
        </section>

        {/* Decomposition Results */}
        {decomposition && (
          <section className="tf-mb-8">
            <div className="tf-card tf-p-6">
              <h2 className="tf-text-2xl tf-font-semibold tf-mb-4">
                Task Decomposition Results
              </h2>

              <div className="tf-mb-6">
                <h3 className="tf-font-medium tf-mb-2">Success Criteria:</h3>
                <ul className="tf-list-disc tf-ml-6 tf-space-y-1">
                  {decomposition.successCriteria?.map((criteria, index) => (
                    <li key={index} className="tf-text-sm">
                      {criteria}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="tf-mb-6">
                <h3 className="tf-font-medium tf-mb-2">Generated Tasks:</h3>
                {decomposition.tasks?.map(renderTaskCard)}
              </div>

              {decomposition.risks && decomposition.risks.length > 0 && (
                <div className="tf-p-4 tf-bg-warning tf-rounded">
                  <h3 className="tf-font-medium tf-mb-2">Potential Risks:</h3>
                  <ul className="tf-list-disc tf-ml-6 tf-space-y-1">
                    {decomposition.risks.map((risk, index) => (
                      <li key={index} className="tf-text-sm">
                        {risk}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </section>
        )}

        {/* Component Demo Section */}
        <section className="tf-card tf-p-6 tf-mb-8">
          <h2 className="tf-text-2xl tf-font-semibold tf-mb-4">
            Component Showcase
          </h2>

          <div className="tf-space-y-6">
            {/* Button Variants */}
            <div>
              <h3 className="tf-font-medium tf-mb-3">Button Variants</h3>
              <div className="tf-flex tf-gap-3 tf-flex-wrap">
                <Button variant="primary" size="sm">
                  Primary Small
                </Button>
                <Button variant="primary" size="md">
                  Primary Medium
                </Button>
                <Button variant="primary" size="lg">
                  Primary Large
                </Button>
                <Button variant="secondary" size="md">
                  Secondary
                </Button>
                <Button variant="ghost" size="md">
                  Ghost
                </Button>
                <Button variant="danger" size="md">
                  Danger
                </Button>
              </div>
            </div>

            {/* Button States */}
            <div>
              <h3 className="tf-font-medium tf-mb-3">Button States</h3>
              <div className="tf-flex tf-gap-3">
                <Button disabled>Disabled Button</Button>
                <Button loading>Loading Button</Button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="tf-mt-12 tf-py-6 tf-border-t tf-text-center">
        <p className="tf-text-sm tf-text-neutral">
          TechFlow - Strategic Planning Powered by AI
        </p>
      </footer>
    </div>
  );
}

export default TechFlowApp;
