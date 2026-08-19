/**
 * SequencingStrategyModal.jsx
 *
 * Modal for configuring sequencing strategy (Foundation-First vs Output-First) for an initiative.
 * - If classification exists: shows recommendation with "Reconfigure" option
 * - If no classification: displays three-question probe
 * - If inconclusive: shows two operator choice buttons (Foundation-First OR Output-First)
 *
 * Cross-effect disclosure: warns operator that classification is shared with
 * pricing strategy planning (Phase 1 locked).
 */

import React, { useState, useMemo } from 'react';
import { classifyFromAnswers, buildSequencingStrategyPayload } from '../../domain/elicitation/sequencingStrategySlot.js';

export default function SequencingStrategyModal({ open, initiativeId, initiative, onClose, onSubmit }) {
  const [phase, setPhase] = useState('classification'); // classification | inconclusive_choice
  const [answers, setAnswers] = useState({
    category_precedent: '',
    audience_precedent: '',
    competitive_density: '',
  });
  const [selectedStrategy, setSelectedStrategy] = useState('');
  const [customReasoning, setCustomReasoning] = useState('');

  const showingExistingClassification = initiative?.riskClassification && open;

  const handleAnswerChange = (probeName, value) => {
    setAnswers((prev) => ({
      ...prev,
      [probeName]: value,
    }));
  };

  const classification = useMemo(() => {
    if (!answers.category_precedent || !answers.audience_precedent || !answers.competitive_density) {
      return null;
    }
    return classifyFromAnswers(answers);
  }, [answers]);

  const handleClassificationSubmit = () => {
    if (!classification) return;

    if (classification.riskClass === 'inconclusive') {
      setPhase('inconclusive_choice');
      return;
    }

    // Auto-select strategy based on classification
    const autoStrategy = classification.riskClass === 'differentiation_risk' ? 'foundation_first' : 'output_first';
    setSelectedStrategy(autoStrategy);
    handleStrategySubmit(autoStrategy, '');
  };

  const handleStrategySubmit = (strategy, reasoning) => {
    if (!classification) return;

    const payload = buildSequencingStrategyPayload(initiativeId, classification.riskClass, strategy, reasoning);
    onSubmit?.(payload);
    handleClose();
  };

  const handleInconclusiveChoice = (choice) => {
    if (choice === 'custom') {
      if (!customReasoning.trim()) return;
      // For inconclusive, operator must choose foundation_first or output_first, not a third option
      // So custom reasoning requires they pick one of the two strategies
      return;
    }
    handleStrategySubmit(choice, customReasoning.trim() || '');
  };

  const handleClose = () => {
    setPhase('classification');
    setAnswers({
      category_precedent: '',
      audience_precedent: '',
      competitive_density: '',
    });
    setSelectedStrategy('');
    setCustomReasoning('');
    onClose?.();
  };

  const handleReconfigure = () => {
    setPhase('classification');
    setAnswers({
      category_precedent: '',
      audience_precedent: '',
      competitive_density: '',
    });
    setSelectedStrategy('');
    setCustomReasoning('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="w-full max-w-2xl rounded-lg border border-line/40 bg-jericho-surface shadow-lg">
        {/* Header */}
        <div className="border-b border-line/20 px-6 py-4">
          <h2 className="text-lg font-semibold text-jericho-text">Configure Sequencing Strategy</h2>
          <p className="mt-1 text-xs text-muted">Initiative: {initiative?.name || initiativeId}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Cross-Effect Warning */}
          <div className="rounded-lg border border-amber-600/30 bg-amber-600/10 p-3">
            <p className="text-xs text-amber-900/90">
              <strong>⚠️ Important:</strong> This classification is shared with your pricing strategy planning. If you
              change it here, it will affect pricing recommendations too.
            </p>
          </div>

          {/* Show existing classification + option to reconfigure */}
          {showingExistingClassification ? (
            <div className="space-y-3">
              <div className="rounded-lg border border-emerald-600/30 bg-emerald-600/10 p-3">
                <p className="text-xs text-emerald-900/90">
                  <strong>Current Classification:</strong> {initiative.riskClassification}
                </p>
                <p className="mt-1 text-xs text-emerald-900/80">
                  <strong>Sequencing Strategy:</strong> {initiative.sequencingStrategy || '(not set)'}
                </p>
                {initiative.sequencingReasoning && (
                  <p className="mt-1 text-xs text-emerald-900/80">
                    <strong>Reasoning:</strong> {initiative.sequencingReasoning}
                  </p>
                )}
              </div>

              <button
                type="button"
                className="text-xs text-jericho-accent hover:underline"
                onClick={handleReconfigure}
              >
                Reconfigure Classification
              </button>
            </div>
          ) : phase === 'classification' ? (
            // Three-question probe
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted mb-2">
                  1. Has this category seen proven, non-commoditized winners?
                </label>
                <div className="flex gap-2">
                  {['yes', 'no', 'unknown'].map((opt) => (
                    <label key={opt} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="category_precedent"
                        value={opt}
                        checked={answers.category_precedent === opt}
                        onChange={(e) => handleAnswerChange('category_precedent', e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-xs text-jericho-text capitalize">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-2">
                  2. Do your target customers have prior successful relationships with similar offerings?
                </label>
                <div className="flex gap-2">
                  {['yes', 'no', 'unknown'].map((opt) => (
                    <label key={opt} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="audience_precedent"
                        value={opt}
                        checked={answers.audience_precedent === opt}
                        onChange={(e) => handleAnswerChange('audience_precedent', e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-xs text-jericho-text capitalize">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted mb-2">
                  3. Is the category highly competitive or underserved?
                </label>
                <div className="flex gap-2">
                  {['competitive', 'underserved', 'unknown'].map((opt) => (
                    <label key={opt} className="flex items-center gap-1 cursor-pointer">
                      <input
                        type="radio"
                        name="competitive_density"
                        value={opt}
                        checked={answers.competitive_density === opt}
                        onChange={(e) => handleAnswerChange('competitive_density', e.target.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-xs text-jericho-text capitalize">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {classification && (
                <div className="rounded-lg border border-line/40 bg-jericho-surface/50 p-3">
                  <p className="text-xs font-medium text-jericho-text">
                    Classification: <strong>{classification.riskClass}</strong>
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {classification.riskClass === 'differentiation_risk'
                      ? 'Foundation-First recommended: strong category and audience precedent indicate your Foundation investment (brand, positioning) is well-justified upfront.'
                      : classification.riskClass === 'validation_risk'
                        ? 'Output-First recommended: weak category or audience precedent indicates demand uncertainty is the primary risk; build a minimal, falsifiable test first.'
                        : 'Choose explicitly: Foundation-First or Output-First based on your risk tolerance.'}
                  </p>
                </div>
              )}
            </div>
          ) : phase === 'inconclusive_choice' ? (
            // Inconclusive choice buttons
            <div className="space-y-3">
              <p className="text-xs text-muted">Your answers don't point to a clear consensus. Choose a strategy:</p>

              <button
                type="button"
                className="w-full rounded-lg border border-line/40 bg-jericho-surface/50 p-3 text-left hover:bg-jericho-surface transition"
                onClick={() => handleInconclusiveChoice('foundation_first')}
              >
                <p className="text-xs font-medium text-jericho-text">Foundation-First</p>
                <p className="mt-1 text-xs text-muted">
                  Build brand, positioning, and business foundation before or alongside first product release.
                </p>
              </button>

              <button
                type="button"
                className="w-full rounded-lg border border-line/40 bg-jericho-surface/50 p-3 text-left hover:bg-jericho-surface transition"
                onClick={() => handleInconclusiveChoice('output_first')}
              >
                <p className="text-xs font-medium text-jericho-text">Output-First</p>
                <p className="mt-1 text-xs text-muted">Build and test a minimal, falsifiable output first to validate market demand.</p>
              </button>

              <div className="space-y-2 pt-2 border-t border-line/20">
                <p className="text-xs font-medium text-muted">Optional: add reasoning for your choice:</p>
                <textarea
                  placeholder="e.g., Founder has strong brand equity in this space; starting with Foundation-First leverages that..."
                  value={customReasoning}
                  onChange={(e) => setCustomReasoning(e.target.value)}
                  className="w-full rounded-lg border border-line/40 bg-jericho-surface px-3 py-2 text-xs text-jericho-text placeholder-muted/50"
                  rows={2}
                />
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="border-t border-line/20 flex gap-2 justify-end px-6 py-4">
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg border border-line/60 px-4 py-2 text-xs font-medium text-muted hover:text-jericho-text transition"
          >
            {showingExistingClassification ? 'Close' : 'Cancel'}
          </button>
          {!showingExistingClassification && phase === 'classification' && (
            <button
              type="button"
              disabled={!classification}
              onClick={handleClassificationSubmit}
              className="rounded-lg bg-jericho-accent/90 px-4 py-2 text-xs font-medium text-jericho-surface hover:bg-jericho-accent transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continue
            </button>
          )}
          {phase === 'inconclusive_choice' && (
            <button
              type="button"
              onClick={() => setPhase('classification')}
              className="rounded-lg border border-line/60 px-4 py-2 text-xs font-medium text-muted hover:text-jericho-text transition"
            >
              Back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
