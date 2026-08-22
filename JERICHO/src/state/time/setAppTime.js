/**
 * setAppTime — Centralized setter for appTime.nowISO and appTime.activeDayKey
 *
 * Respects timeIsPinned guard: if pin is set, does NOT update values.
 * This ensures test fixtures can lock in specific time values while the app runs.
 *
 * Used by: identityStore.js (reducer), identityCompute.js (derived state mutations)
 */

import { dayKeyFromISO } from './time.ts';

/**
 * Set appTime fields on state, respecting the timeIsPinned guard.
 *
 * @param {object} state - The state object to mutate
 * @param {object} options - Configuration object
 * @param {string} [options.nowISO] - ISO timestamp to set (if provided)
 * @param {string} [options.activeDayKey] - Day key to set (if provided)
 * @param {boolean} [options.respectPin=true] - If true, check timeIsPinned guard
 * @param {string} [options.mode='update'] - Context hint: 'init' | 'refresh' | 'transition' | 'recovery'
 * @param {string} [options.timeZone] - TimeZone to use for derivation (if needed)
 *
 * @returns {void} Mutates state in place
 */
export function setAppTime(state, options = {}) {
  const {
    nowISO = null,
    activeDayKey = null,
    respectPin = true,
    mode = 'update',
    timeZone = null,
  } = options;

  if (!state || !state.appTime) {
    return; // Guard against mutation of undefined
  }

  // Guard: If pin is set and we're told to respect it, don't change anything
  if (respectPin && state.appTime.timeIsPinned) {
    return;
  }

  // Update nowISO if provided
  if (nowISO !== null) {
    state.appTime.nowISO = nowISO;
  }

  // Update activeDayKey if provided
  if (activeDayKey !== null) {
    state.appTime.activeDayKey = activeDayKey;
  }

  // If nowISO was just set and activeDayKey wasn't provided,
  // derive activeDayKey from nowISO (common pattern)
  if (nowISO !== null && activeDayKey === null) {
    const tz = timeZone || state.appTime.timeZone || 'UTC';
    state.appTime.activeDayKey = dayKeyFromISO(nowISO, tz);
  }
}
