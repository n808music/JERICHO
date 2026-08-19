/**
 * initiativeRegistryLoader.js
 *
 * Loads the Initiative registry from the live Operation Morning Sun Google Sheet
 * at runtime, preventing staleness and keeping code synchronized with real matrix data.
 *
 * REQUIRES: GOOGLE_APPLICATION_CREDENTIALS environment variable set to a service account key
 * with read access to Google Sheets API. Set this in your local environment (.env, shell profile, etc.)
 * — never pass credentials through chat or configuration.
 *
 * Sheet source (Operation Morning Sun Official Reference Matrix):
 *   Sheet ID: 1fuhoQDTz1F_AjBPlgHybP7ulSbH3CKjDoDDQkKnuKxw
 *   Tab: "2. INITIATIVES"
 *
 * Fallback strategy:
 *   - Primary: live API fetch from Google Sheet
 *   - Fallback: last-known-good snapshot cached to disk (.jericho/initiative-registry-cache.json)
 *   - Signal: WARN log line when serving cached fallback (not silent)
 *   - Force-refresh: Set FORCE_REFRESH_REGISTRY=true to skip cache and disk fallback
 *
 * Configuration:
 *   REGISTRY_CACHE_TTL_MINUTES (default: 5) — in-memory cache duration
 *   FORCE_REFRESH_REGISTRY (default: false) — skip cache and always fetch live
 */

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { deriveAliasesFromName } from './initiativeAliasDerivation.js';

const SHEET_ID = '1fuhoQDTz1F_AjBPlgHybP7ulSbH3CKjDoDDQkKnuKxw';
const SHEET_TAB = '2. INITIATIVES';
const CACHE_DIR = path.join(os.homedir(), '.jericho');
const CACHE_FILE = path.join(CACHE_DIR, 'initiative-registry-cache.json');
const CACHE_TTL_MS = (Number(process.env.REGISTRY_CACHE_TTL_MINUTES) || 5) * 60 * 1000;

let cachedRegistry = null;
let cacheTimestamp = null;

/**
 * Loads the Initiative registry from the live Google Sheet, with disk-cached fallback.
 * Caches in-memory for REGISTRY_CACHE_TTL_MINUTES (default 5).
 * Falls back to last-known-good disk cache if live fetch fails, with warning log.
 *
 * @returns {Promise<Array>} Array of initiative objects with structure:
 *   { id, name, owner, phase, terminalDeadline, aliases }
 */
export async function loadInitiativeRegistry() {
  const forceRefresh = process.env.FORCE_REFRESH_REGISTRY === 'true';

  // Return in-memory cache if still fresh (unless forced refresh)
  if (!forceRefresh && cachedRegistry && cacheTimestamp && Date.now() - cacheTimestamp < CACHE_TTL_MS) {
    return cachedRegistry;
  }

  try {
    const auth = new google.auth.GoogleAuth({
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    const sheets = google.sheets({ version: 'v4', auth });

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `'${SHEET_TAB}'!A:Z`, // Read all columns from the tab
    });

    const rows = response.data.values || [];
    if (rows.length < 2) {
      throw new Error(`No data found in sheet tab "${SHEET_TAB}"`);
    }

    // Parse rows into initiative objects
    const headers = rows[0].map((h) => String(h || '').trim().toLowerCase());
    const initiatives = [];

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row[0]) {continue;}

      const initiativeName = String(row[0] || '').trim();
      if (!initiativeName) {continue;}

      const ownerIdx = headers.indexOf('owner');
      const phaseIdx = headers.indexOf('phase');
      const deadlineIdx = headers.findIndex((h) => h.includes('deadline') || h.includes('target'));

      const initiative = {
        id: slugifyInitiativeName(initiativeName),
        name: initiativeName,
        owner: ownerIdx >= 0 ? String(row[ownerIdx] || '').trim() : '',
        phase: phaseIdx >= 0 ? String(row[phaseIdx] || '').trim() : '',
        terminalDeadline: deadlineIdx >= 0 ? String(row[deadlineIdx] || '').trim() : '',
        aliases: deriveAliasesFromName(initiativeName),
      };

      initiatives.push(initiative);
    }

    if (initiatives.length === 0) {
      throw new Error('No valid initiatives found in sheet');
    }

    // Cache in-memory and persist to disk
    cachedRegistry = initiatives;
    cacheTimestamp = Date.now();
    await persistCacheToFile(initiatives);

    console.log(`[initiativeRegistryLoader] Loaded ${initiatives.length} initiatives from Operation Morning Sun matrix (live).`);
    return initiatives;
  } catch (error) {
    console.error('[initiativeRegistryLoader] Failed to fetch live registry:', error.message);

    // Try disk fallback
    const diskFallback = await loadCacheFromFile();
    if (diskFallback && diskFallback.length > 0) {
      cachedRegistry = diskFallback;
      cacheTimestamp = Date.now();
      console.warn('[initiativeRegistryLoader] USING DISK CACHE — live fetch failed. Registry may be stale.');
      console.warn('[initiativeRegistryLoader] Ensure GOOGLE_APPLICATION_CREDENTIALS is configured. To force refresh, set FORCE_REFRESH_REGISTRY=true.');
      return diskFallback;
    }

    // No fallback available
    console.error('[initiativeRegistryLoader] No disk cache available. Returning empty registry.');
    console.error('[initiativeRegistryLoader] Set up GOOGLE_APPLICATION_CREDENTIALS in your local environment to enable live fetches.');
    return [];
  }
}

/**
 * Persists the registry to disk cache for fallback use.
 */
async function persistCacheToFile(initiatives) {
  try {
    if (!fs.existsSync(CACHE_DIR)) {
      fs.mkdirSync(CACHE_DIR, { recursive: true });
    }
    fs.writeFileSync(CACHE_FILE, JSON.stringify({ timestamp: new Date().toISOString(), initiatives }, null, 2));
  } catch (error) {
    console.warn('[initiativeRegistryLoader] Could not persist cache to disk:', error.message);
  }
}

/**
 * Loads the registry from disk cache (used when live fetch fails).
 */
async function loadCacheFromFile() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      return data.initiatives || [];
    }
  } catch (error) {
    console.warn('[initiativeRegistryLoader] Could not load disk cache:', error.message);
  }
  return [];
}

/**
 * Derives a slug ID from an initiative name.
 * Example: "The Jericho System" → "the-jericho-system"
 */
function slugifyInitiativeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove non-alphanumeric except hyphens
    .replace(/\s+/g, '-') // Replace spaces with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .trim();
}

/**
 * Synchronous fallback if async loading hasn't happened yet.
 * Checks: in-memory cache → disk cache → empty array.
 * If disk cache is used, logs a warning (registry may be stale).
 */
export function getInitiativeRegistrySyncOrEmpty() {
  // Return in-memory cache if available
  if (cachedRegistry && cachedRegistry.length > 0) {
    return cachedRegistry;
  }

  // Fall back to disk cache (synchronous read)
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      const diskRegistry = data.initiatives || [];
      if (diskRegistry.length > 0) {
        console.warn('[initiativeRegistryLoader] Using disk cache (async load not yet complete). Registry may be stale.');
        console.warn('[initiativeRegistryLoader] Ensure loadInitiativeRegistry() is awaited before rendering.');
        return diskRegistry;
      }
    }
  } catch (error) {
    console.error('[initiativeRegistryLoader] Error reading disk cache in sync accessor:', error.message);
  }

  // No cache available — this is a first-boot or cache-cleared scenario
  console.error('[initiativeRegistryLoader] Initiative registry not initialized. Neither in-memory cache nor disk cache available.');
  console.error('[initiativeRegistryLoader] Ensure loadInitiativeRegistry() is called and awaited at app startup before rendering.');
  console.error('[initiativeRegistryLoader] Set GOOGLE_APPLICATION_CREDENTIALS in your environment to enable registry loading.');

  return [];
}

export default loadInitiativeRegistry;
