import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import AppShell from '../../src/components/AppShell.jsx';
import { JerichoProvider, initialState } from '../../src/core/state.js';

describe('AppShell', () => {
  it('renders without crashing in discipline mode', () => {
    // No session → login gate renders; smoke test confirms no throw
    const html = ReactDOMServer.renderToString(
      <JerichoProvider initialMode="discipline" initialData={initialState}>
        <AppShell />
      </JerichoProvider>
    );
    expect(html).toContain('Jericho');
  });

  it('renders without crashing in zion mode', () => {
    const html = ReactDOMServer.renderToString(
      <JerichoProvider initialMode="zion" initialData={initialState}>
        <AppShell />
      </JerichoProvider>
    );
    expect(html).toContain('Jericho');
  });

  it('cold load (no session) shows login gate, not profile or execution tools', () => {
    // localStorage unavailable in SSR → isAuthenticated() returns false → login gate
    const html = ReactDOMServer.renderToString(<AppShell />);

    expect(html).toContain('Sign in');
    expect(html).not.toContain('Profile access');
    expect(html).not.toContain('Today');
    expect(html).not.toContain('Structure');
    expect(html).not.toContain('Grow revenue to $10k/month');
  });
});
