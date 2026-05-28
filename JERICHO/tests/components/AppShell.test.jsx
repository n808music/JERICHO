import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import AppShell from '../../src/components/AppShell.jsx';
import { JerichoProvider, initialState } from '../../src/core/state.js';

describe('AppShell', () => {
  it('renders discipline mode without crashing', () => {
    const html = ReactDOMServer.renderToString(
      <JerichoProvider initialMode="discipline" initialData={initialState}>
        <AppShell />
      </JerichoProvider>
    );
    expect(html).toContain('Jericho // LIVE');
  });

  it('renders zion mode without crashing', () => {
    const html = ReactDOMServer.renderToString(
      <JerichoProvider initialMode="zion" initialData={initialState}>
        <AppShell />
      </JerichoProvider>
    );
    expect(html).toContain('Jericho // LIVE');
  });

  it('does not treat the default local seed as coherent profile context', () => {
    const html = ReactDOMServer.renderToString(<AppShell />);

    expect(html).toContain('Profile access');
    expect(html).not.toContain('Restore Operation Endgame');
    expect(html).toContain('Continue as James');
    expect(html).toContain('Create profile');
    expect(html).toContain('default local/demo profile');
    expect(html).not.toContain('Grow revenue to $10k/month');
    expect(html).not.toContain('Today');
    expect(html).not.toContain('Structure');
  });
});
