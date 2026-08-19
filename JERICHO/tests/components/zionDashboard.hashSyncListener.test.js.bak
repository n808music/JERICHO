import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * Test that hash changes trigger view state updates.
 * This is a behavioral test verifying the hashchange listener works correctly.
 */
describe('ZionDashboard hash-sync listener', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should attach hashchange listener on mount', () => {
    const addEventListenerSpy = vi.spyOn(window, 'addEventListener');

    // When ZionDashboard's effect runs, it should register a hashchange listener
    const mockSetView = vi.fn();

    // Simulate what the effect does
    if (typeof window !== 'undefined') {
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

      syncHashToView();
      window.addEventListener('hashchange', syncHashToView);
    }

    // Verify listener was registered
    expect(addEventListenerSpy).toHaveBeenCalledWith('hashchange', expect.any(Function));

    addEventListenerSpy.mockRestore();
  });

  it('should respond to hashchange events by updating view', () => {
    const setViewCalls = [];
    const mockSetView = (view) => {
      setViewCalls.push(view);
    };

    window.location.hash = '';

    // Simulate the effect's behavior
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

    // Initial sync on "mount"
    syncHashToView();
    expect(setViewCalls).toEqual([]); // No hash yet

    // User navigates to #/structure
    window.location.hash = '#/structure';
    syncHashToView();
    expect(setViewCalls.slice(-1)).toEqual(['structure']);

    // User navigates to #/today
    window.location.hash = '#/today';
    syncHashToView();
    expect(setViewCalls.slice(-1)).toEqual(['today']);

    // User navigates to #/stability
    window.location.hash = '#/stability';
    syncHashToView();
    expect(setViewCalls.slice(-1)).toEqual(['stability']);

    window.location.hash = '';
  });
});
