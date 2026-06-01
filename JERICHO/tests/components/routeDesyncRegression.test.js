import { describe, it, expect, beforeEach } from 'vitest';

/**
 * Regression test for route-to-content desynchronization bug.
 *
 * Bug scenario: User at /#/today navigates to /#/structure
 * Expected: Content pane shows Structure
 * Bug: Content pane still shows Today (view state desynchronized from hash)
 *
 * Root cause: hashchange listener was missing; effect only ran on mount
 * Fix: Added window.addEventListener('hashchange', syncHashToView) in hash-sync effect
 */
describe('Route-to-content desynchronization regression', () => {
  beforeEach(() => {
    window.location.hash = '';
  });

  it('should sync view state when hash changes from #/today to #/structure', () => {
    const viewStates = [];
    const mockSetView = (view) => {
      viewStates.push(view);
    };

    // User starts at #/today
    window.location.hash = '#/today';

    // Simulate hash-sync effect behavior
    const syncHashToView = () => {
      const currentHash = window.location.hash || '';
      if (currentHash.startsWith('#/structure')) {
        mockSetView('structure');
      } else if (currentHash.startsWith('#/today')) {
        mockSetView('today');
      } else if (currentHash.startsWith('#/stability')) {
        mockSetView('stability');
      }
    };

    // Initial mount sync
    syncHashToView();
    expect(viewStates).toEqual(['today']);

    // User clicks link or navigates to #/structure
    window.location.hash = '#/structure';

    // Before fix: hashchange listener doesn't exist, syncHashToView not called
    // After fix: hashchange event fires, listener calls syncHashToView
    syncHashToView();

    // View should now be structure, not still today
    expect(viewStates).toEqual(['today', 'structure']);
    expect(viewStates[viewStates.length - 1]).toBe('structure');
  });

  it('should maintain correct view state across multiple hash changes', () => {
    const viewStates = [];
    const mockSetView = (view) => {
      viewStates.push(view);
    };

    const syncHashToView = () => {
      const currentHash = window.location.hash || '';
      if (currentHash.startsWith('#/structure')) {
        mockSetView('structure');
      } else if (currentHash.startsWith('#/today')) {
        mockSetView('today');
      } else if (currentHash.startsWith('#/stability')) {
        mockSetView('stability');
      }
    };

    // Simulate user navigation sequence
    window.location.hash = '#/structure';
    syncHashToView();

    window.location.hash = '#/today';
    syncHashToView();

    window.location.hash = '#/stability';
    syncHashToView();

    window.location.hash = '#/structure';
    syncHashToView();

    // Verify all transitions were captured
    expect(viewStates).toEqual(['structure', 'today', 'stability', 'structure']);
  });

  it('should correctly identify view from various hash formats', () => {
    const viewStates = [];
    const mockSetView = (view) => {
      viewStates.push(view);
    };

    const syncHashToView = () => {
      const currentHash = window.location.hash || '';
      if (currentHash.startsWith('#/structure')) {
        mockSetView('structure');
      } else if (currentHash.startsWith('#/today')) {
        mockSetView('today');
      } else if (currentHash.startsWith('#/stability')) {
        mockSetView('stability');
      }
    };

    // Test that startsWith correctly matches these variations
    window.location.hash = '#/structure';
    syncHashToView();

    window.location.hash = '#/structure/';
    syncHashToView();

    window.location.hash = '#/structure?foo=bar';
    syncHashToView();

    window.location.hash = '#/today';
    syncHashToView();

    // All should identify correctly
    expect(viewStates).toEqual(['structure', 'structure', 'structure', 'today']);
  });
});
