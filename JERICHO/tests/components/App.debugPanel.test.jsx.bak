import React from 'react';
import '@testing-library/jest-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import App from '../../src/App.jsx';

describe('App debug panel surface', () => {
  beforeEach(() => {
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: () => {},
      removeItem: () => {},
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not render the black Jericho debug panel in the app root', () => {
    render(<App />);

    expect(screen.queryByText(/JERICHO DEBUG/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/PHASE 1/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/SELECT A TRACE EVENT/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /ALL/i })).not.toBeInTheDocument();
  });
});
