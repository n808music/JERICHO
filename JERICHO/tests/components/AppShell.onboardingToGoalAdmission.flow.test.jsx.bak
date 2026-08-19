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

  async function enterProfile() {
    fireEvent.click(await screen.findByRole('button', { name: /Create profile/i }));
  }

  it('lands in the review-mode Structure shell and offers starting a new cycle', async () => {
    render(<AppShell />);
    await enterProfile();
    const cycleIds = Object.keys(window.__jerichoDebug__?.cyclesById || {});
    await act(async () => {
      cycleIds.forEach((cycleId) => {
        window.__jerichoDebug__?.hardDeleteCycle?.(cycleId);
      });
    });
    await waitFor(() => expect(window.__jerichoDebug__?.activeCycleId ?? null).toBeNull());
    expect(await screen.findByRole('button', { name: /Structure/i })).toBeInTheDocument();
    expect(screen.getByText(/Review Mode/i)).toBeInTheDocument();
    expect(window.__jerichoDebug__?.activeCycleId ?? null).toBeNull();
  });

  it('starts a new coherent profile in the true blank lifecycle state', async () => {
    render(<AppShell />);
    await enterProfile();

    fireEvent.click(await screen.findByRole('button', { name: /Structure/i }));

    await waitFor(() => expect(window.__jerichoDebug__?.activeCycleId ?? null).toBeNull());

    expect(await screen.findByText(/^Contract Admission$/i)).toBeInTheDocument();
    expect(screen.getByText(/What are you trying to do/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Continue$/i })).toBeInTheDocument();
    expect(screen.queryByText(/Grow revenue to \$10k\/month/i)).not.toBeInTheDocument();
    expect(window.__jerichoDebug__?.goalLifecycleState).toBe('blank');
  });
});
