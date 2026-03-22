/**
 * Browser UI preferences (localStorage). Source of truth for tests; synced to
 * web/public/moozhak-ui-prefs.js (see npm run sync:domain).
 */

export const LIBRARY_UI_STORAGE_KEY = 'mzk:ui:library';

export const LIBRARY_UI_DEFAULTS = Object.freeze({
  subView: 'albums',
  trackSortKey: 'trackTitle',
  trackSortDir: 'asc',
  viewMode: 'cards',
});

const SUB_VIEWS = new Set(['albums', 'tracks']);
const VIEW_MODES = new Set(['cards', 'list']);
const TRACK_SORT_KEYS = new Set([
  'trackTitle',
  'artist',
  'albumTitle',
  'bpm',
  'key',
]);
const SORT_DIRS = new Set(['asc', 'desc']);

/**
 * @param {unknown} v
 * @param {Set<string>} allowed
 * @param {string} fallback
 */
function pickEnum(v, allowed, fallback) {
  return typeof v === 'string' && allowed.has(v) ? v : fallback;
}

/**
 * Normalize parsed JSON into a safe library UI state.
 * @param {unknown} raw
 * @returns {{ subView: string, trackSortKey: string, trackSortDir: string, viewMode: string }}
 */
export function normalizeLibraryUiPrefs(raw) {
  const base = { ...LIBRARY_UI_DEFAULTS };
  if (!raw || typeof raw !== 'object') return base;

  const o = /** @type {Record<string, unknown>} */ (raw);
  base.subView = pickEnum(o.subView, SUB_VIEWS, LIBRARY_UI_DEFAULTS.subView);
  base.viewMode = pickEnum(
    o.viewMode,
    VIEW_MODES,
    LIBRARY_UI_DEFAULTS.viewMode,
  );

  const ts = o.trackSort;
  if (ts && typeof ts === 'object') {
    const t = /** @type {Record<string, unknown>} */ (ts);
    base.trackSortKey = pickEnum(
      t.key,
      TRACK_SORT_KEYS,
      LIBRARY_UI_DEFAULTS.trackSortKey,
    );
    base.trackSortDir = pickEnum(
      t.dir,
      SORT_DIRS,
      LIBRARY_UI_DEFAULTS.trackSortDir,
    );
  }

  return base;
}

/**
 * @param {string | null} json
 * @returns {{ subView: string, trackSortKey: string, trackSortDir: string, viewMode: string }}
 */
export function parseLibraryUiPrefsJson(json) {
  if (json == null || json === '') {
    return { ...LIBRARY_UI_DEFAULTS };
  }
  try {
    return normalizeLibraryUiPrefs(JSON.parse(json));
  } catch {
    return { ...LIBRARY_UI_DEFAULTS };
  }
}

/**
 * @param {{ getItem: (k: string) => string | null }} storage
 * @returns {{ subView: string, trackSortKey: string, trackSortDir: string, viewMode: string }}
 */
export function readLibraryUiPrefs(storage) {
  const rawJson = storage.getItem(LIBRARY_UI_STORAGE_KEY);
  /** @type {unknown} */
  let parsed = null;
  if (rawJson) {
    try {
      parsed = JSON.parse(rawJson);
    } catch {
      parsed = null;
    }
  }
  const normalized = normalizeLibraryUiPrefs(parsed);
  const hasStoredViewMode =
    parsed && typeof parsed === 'object' && Object.hasOwn(parsed, 'viewMode');
  if (!hasStoredViewMode) {
    const legacy = storage.getItem('viewMode');
    if (legacy === 'list' || legacy === 'cards') {
      normalized.viewMode = legacy;
    }
  }
  return normalized;
}

/**
 * Card/list view mode only. Contract for the inline boot snippet in
 * web/views/partials/view-toggle-boot.ejs (keep parsing rules in sync).
 * @param {{ getItem: (k: string) => string | null }} storage
 * @returns {'cards' | 'list'}
 */
export function readViewModeFromStorage(storage) {
  const { viewMode } = readLibraryUiPrefs(storage);
  return viewMode === 'list' ? 'list' : 'cards';
}

/**
 * @param {{ subView: string, trackSortKey: string, trackSortDir: string, viewMode: string }} state
 * @returns {string}
 */
export function serializeLibraryUiPrefs(state) {
  const n = normalizeLibraryUiPrefs({
    subView: state.subView,
    trackSort: { key: state.trackSortKey, dir: state.trackSortDir },
    viewMode: state.viewMode,
  });
  return JSON.stringify({
    v: 1,
    subView: n.subView,
    trackSort: { key: n.trackSortKey, dir: n.trackSortDir },
    viewMode: n.viewMode,
  });
}

/**
 * @param {{ setItem: (k: string, v: string) => void }} storage
 * @param {{ subView: string, trackSortKey: string, trackSortDir: string, viewMode: string }} state
 */
export function writeLibraryUiPrefs(storage, state) {
  storage.setItem(LIBRARY_UI_STORAGE_KEY, serializeLibraryUiPrefs(state));
}
