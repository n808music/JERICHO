/**
 * PricingStrategyModal.jsx
 *
 * Modal for configuring pricing strategy for an initiative.
 * - If classification exists: shows recommendation with "Reconfigure" option
 * - If no classification: displays three-question probe
 * - If inconclusive: shows three operator choice buttons
 *
 * Cross-effect disclosure: warns operator that classification is shared with
 * sequencing strategy planning (Phase 2).
 */

import React, { useState, useMemo } from 'react';
import { classifyFromAnswers, buildPricingStrategyPayload } from '../../domain/elicitation/pricingStrategySlot.js';

export default function PricingStrategyModal({ open, initiativeId, initiative, onClose, onSubmit }) {
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
    const autoStrategy = classification.riskClass === 'differentiation_risk' ? 'premium' : 'penetration';
    setSelectedStrategy(autoStrategy);
    handleStrategySubmit(autoStrategy, '');
  };

  const handleStrategySubmit = (strategy, reasoning) => {
    if (!classification) return;

    const payload = buildPricingStrategyPayload(initiativeId, classification.riskClass, strategy, reasoning);
    onSubmit?.(payload);
    handleClose();
  };

  const handleInconclusiveChoice = (choice) => {
    if (choice === 'custom') {
      if (!customReasoning.trim()) return;
      handleStrategySubmit('hybrid', customReasoning);
    } else {
      handleStrategySubmit(choice, '');
    }
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
          <h2 className="text-lg font-semibold text-jericho-text">Configure Pricing Strategy</h2>
          <p className="mt-1 text-xs text-muted">Initiative: {initiative?.name || initiativeId}</p>
        </div>

        {/* Content */}
        <div className="px-6 py-4 space-y-4">
          {/* Cross-Effect Warning */}
          <div className="rounded-lg border border-amber-600/30 bg-amber-600/10 p-3">
            <p className="text-xs text-amber-900/90">
              <strong>⚠️ Important:</strong> This classification is shared with your sequencing strategy planning. If you
              change it here, it will affect sequencing recommendations too.
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
                  <strong>Strategy:</strong> {initiative.pricingStrategy || '(not set)'}
                </p>
                {initiative.pricingReasoning && (
                  <p className="mt-1 text-xs text-emerald-900/80">
                    <strong>Reasoning:</strong> {initiative.pricingReasoning}
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
                      ? 'Premium/Skimming or Feature-Bundled strategy recommended.'
                      : classification.riskClass === 'validation_risk'
                        ? 'Penetration/Low-Cost or Usage-Based/Freemium strategy recommended.'
                        : 'Choose explicitly: Premium, Penetration, or Hybrid/Custom.'}
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
                onClick={() => handleInconclusiveChoice('premium')}
              >
                <p className="text-xs font-medium text-jericho-text">Use Premium Pricing</p>
                <p className="mt-1 text-xs text-muted">Differentiation-focused, anchor on feature superiority.</p>
              </button>

              <button
                type="button"
                className="w-full rounded-lg border border-line/40 bg-jericho-surface/50 p-3 text-left hover:bg-jericho-surface transition"
                onClick={() => handleInconclusiveChoice('penetration')}
              >
                <p className="text-xs font-medium text-jericho-text">Use Penetration Pricing</p>
                <p className="mt-1 text-xs text-muted">Validation-focused, maximize trial volume.</p>
              </button>

              <div className="space-y-2">
                <p className="text-xs font-medium text-muted">Or define a custom strategy:</p>
                <textarea
                  placeholder="e.g., Hybrid approach combining freemium with premium tier for enterprises..."
                  value={customReasoning}
                  onChange={(e) => setCustomReasoning(e.target.value)}
                  className="w-full rounded-lg border border-line/40 bg-jericho-surface px-3 py-2 text-xs text-jericho-text placeholder-muted/50"
                  rows={3}
                />
                <button
                  type="button"
                  className="w-full rounded-lg border border-jericho-accent/60 bg-jericho-accent/10 p-2 text-xs font-medium text-jericho-accent hover:bg-jericho-accent/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!customReasoning.trim()}
                  onClick={() => handleInconclusiveChoice('custom')}
                >
                  Use Hybrid/Custom Strategy
                </button>
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
