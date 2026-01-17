import React from 'react';
import ReactDOMServer from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { IdentityProvider } from '../../src/state/identityStore.js';

describe('IdentityProvider engine authority invariant', () => {
  it('does not throw when goalDirective is null and eligibility map exists', () => {
    const okState = { goalDirective: null, directiveEligibilityByGoal: {} };
    expect(() => {
      ReactDOMServer.renderToString(
        <IdentityProvider initialState={okState}>
          <div>Test</div>
        </IdentityProvider>
      );
    }).not.toThrow();
  });

  it('does not throw when goalDirective references an eligible goal', () => {
    const okState = {
      goalDirective: { goalId: 'g1' },
      directiveEligibilityByGoal: { g1: { allowed: true, reasons: [] } }
    };
    expect(() => {
      ReactDOMServer.renderToString(
        <IdentityProvider initialState={okState}>
          <div>Test</div>
        </IdentityProvider>
      );
    }).not.toThrow();
  });

  it('throws when directiveEligibilityByGoal is missing', () => {
    const badState = { goalDirective: null };
    expect(() => {
      ReactDOMServer.renderToString(
        <IdentityProvider initialState={badState}>
          <div>Test</div>
        </IdentityProvider>
      );
    }).toThrow();
  });
});
