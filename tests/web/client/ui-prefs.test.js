import {
  LIBRARY_UI_DEFAULTS,
  LIBRARY_UI_STORAGE_KEY,
  normalizeLibraryUiPrefs,
  parseLibraryUiPrefsJson,
  readLibraryUiPrefs,
  readViewModeFromStorage,
  serializeLibraryUiPrefs,
  writeLibraryUiPrefs,
} from '../../../web/lib/client/ui-prefs.js';

describe('ui-prefs (library)', () => {
  test('normalizeLibraryUiPrefs returns defaults for non-objects', () => {
    expect(normalizeLibraryUiPrefs(null)).toEqual({ ...LIBRARY_UI_DEFAULTS });
    expect(normalizeLibraryUiPrefs(undefined)).toEqual({
      ...LIBRARY_UI_DEFAULTS,
    });
    expect(normalizeLibraryUiPrefs('x')).toEqual({ ...LIBRARY_UI_DEFAULTS });
  });

  test('normalizeLibraryUiPrefs accepts valid subView and trackSort', () => {
    expect(
      normalizeLibraryUiPrefs({
        subView: 'tracks',
        trackSort: { key: 'bpm', dir: 'desc' },
        viewMode: 'list',
      }),
    ).toEqual({
      subView: 'tracks',
      trackSortKey: 'bpm',
      trackSortDir: 'desc',
      viewMode: 'list',
    });
  });

  test('normalizeLibraryUiPrefs rejects unknown enum values', () => {
    expect(
      normalizeLibraryUiPrefs({
        subView: 'grid',
        trackSort: { key: 'title', dir: 'sideways' },
        viewMode: 'table',
      }),
    ).toEqual({ ...LIBRARY_UI_DEFAULTS });
  });

  test('parseLibraryUiPrefsJson handles invalid JSON', () => {
    expect(parseLibraryUiPrefsJson('{')).toEqual({ ...LIBRARY_UI_DEFAULTS });
  });

  test('readLibraryUiPrefs uses storage getItem', () => {
    const storage = {
      getItem: (k) => {
        if (k === LIBRARY_UI_STORAGE_KEY) {
          return JSON.stringify({
            v: 1,
            subView: 'tracks',
            trackSort: { key: 'artist', dir: 'desc' },
          });
        }
        if (k === 'viewMode') return null;
        return null;
      },
    };
    expect(readLibraryUiPrefs(storage)).toEqual({
      subView: 'tracks',
      trackSortKey: 'artist',
      trackSortDir: 'desc',
      viewMode: 'cards',
    });
  });

  test('readLibraryUiPrefs migrates legacy viewMode when blob omits it', () => {
    const storage = {
      getItem: (k) => {
        if (k === LIBRARY_UI_STORAGE_KEY) {
          return JSON.stringify({
            v: 1,
            subView: 'albums',
            trackSort: { key: 'trackTitle', dir: 'asc' },
          });
        }
        if (k === 'viewMode') return 'list';
        return null;
      },
    };
    expect(readLibraryUiPrefs(storage).viewMode).toBe('list');
  });

  test('readViewModeFromStorage matches readLibraryUiPrefs.viewMode', () => {
    const storage = {
      getItem: (k) => {
        if (k === LIBRARY_UI_STORAGE_KEY) {
          return JSON.stringify({
            v: 1,
            subView: 'albums',
            trackSort: { key: 'trackTitle', dir: 'asc' },
            viewMode: 'list',
          });
        }
        return null;
      },
    };
    expect(readViewModeFromStorage(storage)).toBe('list');
    expect(readViewModeFromStorage(storage)).toBe(
      readLibraryUiPrefs(storage).viewMode,
    );
  });

  test('readLibraryUiPrefs prefers blob viewMode over legacy key', () => {
    const storage = {
      getItem: (k) => {
        if (k === LIBRARY_UI_STORAGE_KEY) {
          return JSON.stringify({
            v: 1,
            subView: 'albums',
            trackSort: { key: 'trackTitle', dir: 'asc' },
            viewMode: 'cards',
          });
        }
        if (k === 'viewMode') return 'list';
        return null;
      },
    };
    expect(readLibraryUiPrefs(storage).viewMode).toBe('cards');
  });

  test('writeLibraryUiPrefs stores normalized JSON', () => {
    const calls = [];
    const storage = {
      setItem: (k, v) => calls.push([k, v]),
    };
    writeLibraryUiPrefs(storage, {
      subView: 'tracks',
      trackSortKey: 'bpm',
      trackSortDir: 'desc',
      viewMode: 'list',
    });
    expect(calls.length).toBe(1);
    expect(calls[0][0]).toBe(LIBRARY_UI_STORAGE_KEY);
    const parsed = JSON.parse(calls[0][1]);
    expect(parsed).toEqual({
      v: 1,
      subView: 'tracks',
      trackSort: { key: 'bpm', dir: 'desc' },
      viewMode: 'list',
    });
  });

  test('serializeLibraryUiPrefs coerces invalid values to defaults', () => {
    const json = serializeLibraryUiPrefs({
      subView: 'bogus',
      trackSortKey: 'nope',
      trackSortDir: 'maybe',
      viewMode: 'wide',
    });
    expect(JSON.parse(json)).toEqual({
      v: 1,
      subView: 'albums',
      trackSort: {
        key: 'trackTitle',
        dir: 'asc',
      },
      viewMode: 'cards',
    });
  });
});
