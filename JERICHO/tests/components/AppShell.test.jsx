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
    expect(html).toContain('Jericho System');
  });

  it('renders zion mode without crashing', () => {
    const html = ReactDOMServer.renderToString(
      <JerichoProvider initialMode="zion" initialData={initialState}>
        <AppShell />
      </JerichoProvider>
    );
    expect(html).toContain('Jericho System');
  });
});
