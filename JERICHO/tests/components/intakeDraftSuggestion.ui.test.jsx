/**
 * intakeDraftSuggestion.ui.test.jsx
 *
 * Gate D (D16–D19): UI qualification and interaction tests for IntakeDraftSuggestion.
 * Gate E (E20):     Regression guard — existing manual intake behavior unchanged.
 */

import React from 'react';
import '@testing-library/jest-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import IntakeDraftSuggestion from '../../src/components/zion/IntakeDraftSuggestion.jsx';
import { buildGoalIntakeContract, getIntakeGateCode } from '../../src/domain/goal/GoalIntakeContract.ts';

// ─── Shared fixture ───────────────────────────────────────────────────────────

const QUESTION = {
  id: 'podcast-completion-boundary',
  domain: 'podcast',
  prompt: 'What counts as complete by the deadline?',
  field: 'completionBoundary',
  answerType: 'single_select',
  options: ['recorded', 'edited', 'publish_ready', 'published'],
  required: true,
  reasonCode: 'COMPLETION_BOUNDARY_REQUIRED',
};

const DRAFT_ANSWER = {
  questionId: 'podcast-completion-boundary',
  field: 'completionBoundary',
  suggestedValue: 'published',
  rationale: 'You mentioned publishing the episodes.',
  requiresUserConfirmation: true,
};

// ─── Gate D: UI qualification and interaction ─────────────────────────────────

describe('Gate D — IntakeDraftSuggestion UI', () => {
  let onConfirm;
  let onDismiss;

  beforeEach(() => {
    onConfirm = vi.fn();
    onDismiss = vi.fn();
  });

  // D16: draft output is visibly qualified as suggestion, not committed state
  it('D16: renders with visible "AI suggestion — not applied" qualification text', () => {
    render(
      <IntakeDraftSuggestion
        question={QUESTION}
        draftAnswer={DRAFT_ANSWER}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
    );
    const qualifier = screen.getByTestId('intake-draft-qualifier');
    expect(qualifier).toBeInTheDocument();
    expect(qualifier.textContent?.toLowerCase()).toContain('not applied');
  });

  it('D16b: renders the suggested value in the UI', () => {
    render(
      <IntakeDraftSuggestion
        question={QUESTION}
        draftAnswer={DRAFT_ANSWER}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByTestId('intake-draft-value').textContent).toBe('published');
  });

  it('D16c: renders the rationale text when provided', () => {
    render(
      <IntakeDraftSuggestion
        question={QUESTION}
        draftAnswer={DRAFT_ANSWER}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
    );
    expect(screen.getByTestId('intake-draft-rationale')).toBeInTheDocument();
  });

  // D17: user confirmation is required — "Use this answer" calls onConfirm with correct args
  it('D17: clicking "Use this answer" calls onConfirm with field and suggestedValue', () => {
    render(
      <IntakeDraftSuggestion
        question={QUESTION}
        draftAnswer={DRAFT_ANSWER}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
    );
    const confirmBtn = screen.getByTestId('intake-draft-confirm');
    fireEvent.click(confirmBtn);
    expect(onConfirm).toHaveBeenCalledOnce();
    expect(onConfirm).toHaveBeenCalledWith('completionBoundary', 'published');
  });

  // D18: dismiss leaves manual intake path intact
  it('D18: clicking Dismiss calls onDismiss and does not call onConfirm', () => {
    render(
      <IntakeDraftSuggestion
        question={QUESTION}
        draftAnswer={DRAFT_ANSWER}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
    );
    const dismissBtn = screen.getByTestId('intake-draft-dismiss');
    fireEvent.click(dismissBtn);
    expect(onDismiss).toHaveBeenCalledOnce();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  // D19: no auto-apply on render
  it('D19: onConfirm and onDismiss are not called on initial render', () => {
    render(
      <IntakeDraftSuggestion
        question={QUESTION}
        draftAnswer={DRAFT_ANSWER}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
    );
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('renders nothing when question is null', () => {
    const { container } = render(
      <IntakeDraftSuggestion question={null} draftAnswer={DRAFT_ANSWER} onConfirm={onConfirm} onDismiss={onDismiss} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when draftAnswer is null', () => {
    const { container } = render(
      <IntakeDraftSuggestion question={QUESTION} draftAnswer={null} onConfirm={onConfirm} onDismiss={onDismiss} />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders aria-label for assistive technology', () => {
    render(
      <IntakeDraftSuggestion
        question={QUESTION}
        draftAnswer={DRAFT_ANSWER}
        onConfirm={onConfirm}
        onDismiss={onDismiss}
      />
    );
    const region = screen.getByRole('region');
    expect(region).toHaveAttribute('aria-label');
    expect(region.getAttribute('aria-label')?.toLowerCase()).toContain('not yet applied');
  });
});

// ─── Gate E: regression guard ─────────────────────────────────────────────────

describe('Gate E — existing manual intake behavior unchanged', () => {
  // E20: buildGoalIntakeContract still works correctly in the no-agent path
  it('E20: buildGoalIntakeContract blocks without answeredContext and resolves with it', () => {
    // Without answeredContext: ambiguous boundary → blocks
    const intakeBlocked = buildGoalIntakeContract({
      goalId: 'e20-goal',
      rawGoalText: 'Finish 10 podcast episodes',
      executionType: 'CreativeProduction',
      deadline: '2026-09-01',
    });
    expect(intakeBlocked.readiness.isReadyForPlanning).toBe(false);
    expect(getIntakeGateCode(intakeBlocked)).toBe('INTAKE_BOUNDARY_AMBIGUOUS');
    expect(intakeBlocked.requiredContextQuestions.length).toBeGreaterThanOrEqual(1);

    // With explicit answeredContext: resolved → ready
    const intakeReady = buildGoalIntakeContract({
      goalId: 'e20-goal',
      rawGoalText: 'Finish 10 podcast episodes',
      executionType: 'CreativeProduction',
      deadline: '2026-09-01',
      answeredContext: { completionBoundary: 'recorded' },
    });
    expect(intakeReady.readiness.isReadyForPlanning).toBe(true);
    expect(getIntakeGateCode(intakeReady)).toBe('INTAKE_OK');

    // Non-podcast goals are unaffected
    const nonPodcastIntake = buildGoalIntakeContract({
      goalId: 'e20-goal-2',
      rawGoalText: 'Run a marathon in under 4 hours',
      executionType: 'PhysicalTraining',
      deadline: '2026-09-01',
    });
    expect(nonPodcastIntake.readiness.isReadyForPlanning).toBe(true);
    expect(getIntakeGateCode(nonPodcastIntake)).toBe('INTAKE_OK');
  });

  it('E20b: LLM_CALL_PROFILES still contains the original three profiles unchanged', async () => {
    const { LLM_CALL_PROFILES } = await import('../../src/state/llmActionGraph.ts');
    expect(LLM_CALL_PROFILES.PLAN_ACTION_GRAPH.maxTokens).toBe(2000);
    expect(LLM_CALL_PROFILES.PLAN_SESSIONS.maxTokens).toBe(2000);
    expect(LLM_CALL_PROFILES.PLAN_SINGLE_BLOCK.maxTokens).toBe(500);
    // New profile exists and has correct schema version
    expect(LLM_CALL_PROFILES.INTAKE_CLARIFICATION).toBeDefined();
    expect(LLM_CALL_PROFILES.INTAKE_CLARIFICATION.schemaVersion).toBe('jericho_intake_draft_v1');
    expect(LLM_CALL_PROFILES.INTAKE_CLARIFICATION.maxTokens).toBe(800);
  });
});
