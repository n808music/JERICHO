import React from 'react';
import '@testing-library/jest-dom';
import { act } from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AppShell from '../../src/components/AppShell.jsx';

describe('AppShell structure entry without an active cycle', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('lands in the review-mode Structure shell and offers starting a new cycle', async () => {
    render(<AppShell />);
    const cycleIds = Object.keys(window.__jerichoDebug__?.cyclesById || {});
    await act(async () => {
      cycleIds.forEach((cycleId) => {
        window.__jerichoDebug__?.hardDeleteCycle?.(cycleId);
      });
    });
    await waitFor(() => expect(window.__jerichoDebug__?.activeCycleId ?? null).toBeNull());
    expect(await screen.findByRole('button', { name: /Structure/i })).toBeInTheDocument();
    expect(screen.getByText(/Review Mode/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Start new cycle/i })).toBeInTheDocument();
    expect(screen.getByText(/Cycle Summary/i)).toBeInTheDocument();
    expect(screen.getByText(/^Contract Admission$/i)).toBeInTheDocument();
    expect(window.__jerichoDebug__?.activeCycleId ?? null).toBeNull();
  });

  it('resets to the true blank lifecycle state from product-facing controls', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<AppShell />);

    fireEvent.click(await screen.findByRole('button', { name: /Structure/i }));
    fireEvent.click(await screen.findByText(/^Execution Cycle$/i));
    fireEvent.click(screen.getByRole('button', { name: /Clear Goal/i }));

    await waitFor(() => expect(window.__jerichoDebug__?.activeCycleId ?? null).toBeNull());

    expect(screen.getByRole('button', { name: /Start new cycle/i })).toBeInTheDocument();
    expect(screen.getByText(/^Contract Admission$/i)).toBeInTheDocument();
    expect(window.__jerichoDebug__?.goalLifecycleState).toBe('blank');

    confirmSpy.mockRestore();
  });
});
