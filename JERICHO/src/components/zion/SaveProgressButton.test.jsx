import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import React from 'react';

let mockSaveProgress = vi.fn();
vi.mock('../../state/identityStore', () => ({
  useIdentityStore: () => ({ saveProgress: mockSaveProgress }),
}));

import SaveProgressButton from './SaveProgressButton.jsx';

afterEach(() => {
  cleanup();
  mockSaveProgress = vi.fn();
});

describe('SaveProgressButton', () => {
  it('shows a confirmed saved status when the server push succeeds', async () => {
    mockSaveProgress.mockResolvedValueOnce({ ok: true, status: 200 });
    render(<SaveProgressButton />);
    fireEvent.click(screen.getByRole('button', { name: /save progress/i }));
    await waitFor(() => {
      expect(screen.getByTestId('save-progress-status')).toHaveTextContent(/saved/i);
    });
    expect(mockSaveProgress).toHaveBeenCalledTimes(1);
  });

  it('surfaces a failure (and reassures work is local) when the push fails', async () => {
    mockSaveProgress.mockResolvedValueOnce({ ok: false, status: 500 });
    render(<SaveProgressButton />);
    fireEvent.click(screen.getByRole('button', { name: /save progress/i }));
    await waitFor(() => {
      const status = screen.getByTestId('save-progress-status');
      expect(status).toHaveTextContent(/save failed/i);
      expect(status).toHaveTextContent(/stored locally/i);
    });
  });
});
