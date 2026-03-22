import {
  createBoxSetItems,
  extractTracksFromSides,
  getTrackSide,
  groupTracksBySide,
  isBoxSet,
  mergeBpmIntoSides,
  normalizeLibraryItem,
  parseBoxSetAlbums,
  parseTrackBpm,
  numericBpmOrNull,
  bpmSortComparable,
  normalizeStoredBpmValue,
  normalizeLibraryItemTrackBpms,
  normalizeSetlistTrackBpms,
} from '../../../core/domain/library.js';

describe('core/domain/library', () => {
  describe('getTrackSide', () => {
    it('parses vinyl side prefix', () => {
      expect(getTrackSide('A1')).toBe('A');
      expect(getTrackSide('AA2')).toBe('AA');
    });
    it('returns empty for falsy', () => {
      expect(getTrackSide('')).toBe('');
    });
  });

  describe('groupTracksBySide', () => {
    it('groups by side label', () => {
      const tracklist = [
        { position: 'A1', title: 'One' },
        { position: 'A2', title: 'Two' },
        { position: 'B1', title: 'Three' },
      ];
      const sides = groupTracksBySide(tracklist);
      expect(sides).toEqual([
        { label: 'A', tracks: [tracklist[0], tracklist[1]] },
        { label: 'B', tracks: [tracklist[2]] },
      ]);
    });
    it('returns empty for empty input', () => {
      expect(groupTracksBySide([])).toEqual([]);
      expect(groupTracksBySide(null)).toEqual([]);
    });
  });

  describe('isBoxSet', () => {
    it('detects box set in string or serialized formats', () => {
      expect(isBoxSet('12" Vinyl Box Set')).toBe(true);
      expect(isBoxSet([{ name: 'Box Set' }])).toBe(true);
      expect(isBoxSet('LP')).toBe(false);
    });
  });

  describe('parseBoxSetAlbums', () => {
    it('splits on heading markers', () => {
      const tracklist = [
        { type_: 'heading', title: 'Album One' },
        { type_: 'track', position: '1-1', title: 'T1' },
        { type_: 'heading', title: 'Album Two' },
        { type_: 'track', position: '2-1', title: 'T2' },
      ];
      const albums = parseBoxSetAlbums(tracklist);
      expect(albums).toHaveLength(2);
      expect(albums[0].title).toBe('Album One');
      expect(albums[0].tracks).toHaveLength(1);
      expect(albums[1].title).toBe('Album Two');
    });
  });

  describe('normalizeLibraryItem', () => {
    it('applies defaults and groups sides', () => {
      const body = {
        discogsId: 1,
        title: 'Test',
        tracklist: [{ position: 'A1', title: 'A' }],
      };
      const item = normalizeLibraryItem(body);
      expect(item.artist).toBe('Unknown Artist');
      expect(item.sides).toEqual([
        { label: 'A', tracks: [{ position: 'A1', title: 'A' }] },
      ]);
    });
    it('sets boxSet when provided', () => {
      const item = normalizeLibraryItem(
        { discogsId: 1, title: 'X', tracklist: [] },
        'Box',
      );
      expect(item.boxSet).toBe('Box');
    });
  });

  describe('createBoxSetItems', () => {
    it('returns single item when no structured headings', () => {
      const body = {
        discogsId: 9,
        title: 'Plain',
        tracklist: [{ position: 'A1', title: 'One' }],
      };
      const items = createBoxSetItems(body);
      expect(items).toHaveLength(1);
      expect(items[0].title).toBe('Plain');
    });
    it('creates one item per parsed album', () => {
      const body = {
        discogsId: 9,
        title: 'Box Name',
        artist: 'Artist',
        year: 2000,
        format: 'Box Set',
        thumb: '',
        tracklist: [
          { type_: 'heading', title: 'Vol 1' },
          { type_: 'track', position: '1', title: 'S1' },
        ],
      };
      const items = createBoxSetItems(body);
      expect(items.length).toBeGreaterThanOrEqual(1);
      expect(items[0].boxSet).toBe('Box Name');
    });
  });

  describe('extractTracksFromSides', () => {
    it('flattens tracks from sides', () => {
      const sides = [
        { label: 'A', tracks: [{ title: 'a' }] },
        { label: 'B', tracks: [{ title: 'b' }] },
      ];
      expect(extractTracksFromSides(sides)).toEqual([
        { title: 'a' },
        { title: 'b' },
      ]);
    });
  });

  describe('parseTrackBpm', () => {
    it('treats empty as null', () => {
      expect(parseTrackBpm(null)).toEqual({ valid: true, value: null });
      expect(parseTrackBpm(undefined)).toEqual({ valid: true, value: null });
      expect(parseTrackBpm('')).toEqual({ valid: true, value: null });
      expect(parseTrackBpm('  ')).toEqual({ valid: true, value: null });
    });
    it('accepts finite numbers and numeric strings', () => {
      expect(parseTrackBpm(128)).toEqual({ valid: true, value: 128 });
      expect(parseTrackBpm('120')).toEqual({ valid: true, value: 120 });
      expect(parseTrackBpm('  99.5  ')).toEqual({ valid: true, value: 99.5 });
    });
    it('rejects non-numeric text and non-finite numbers', () => {
      expect(parseTrackBpm('abc')).toEqual({ valid: false });
      expect(parseTrackBpm('12a')).toEqual({ valid: false });
      expect(parseTrackBpm(Number.NaN)).toEqual({ valid: false });
      expect(parseTrackBpm(Number.POSITIVE_INFINITY)).toEqual({ valid: false });
    });
  });

  describe('numericBpmOrNull', () => {
    it('coerces valid numeric strings and numbers', () => {
      expect(numericBpmOrNull('128')).toBe(128);
      expect(numericBpmOrNull(99.5)).toBe(99.5);
    });
    it('returns null for empty and invalid', () => {
      expect(numericBpmOrNull(null)).toBeNull();
      expect(numericBpmOrNull('')).toBeNull();
      expect(numericBpmOrNull('x')).toBeNull();
    });
  });

  describe('bpmSortComparable', () => {
    it('uses numeric value when present', () => {
      expect(bpmSortComparable('120', true)).toBe(120);
      expect(bpmSortComparable(120, false)).toBe(120);
    });
    it('sends missing to end for asc and desc', () => {
      expect(bpmSortComparable(null, true)).toBe(Infinity);
      expect(bpmSortComparable('bad', true)).toBe(Infinity);
      expect(bpmSortComparable(null, false)).toBe(-Infinity);
    });
  });

  describe('normalizeStoredBpmValue', () => {
    it('returns number or null', () => {
      expect(normalizeStoredBpmValue('118')).toBe(118);
      expect(normalizeStoredBpmValue(122)).toBe(122);
      expect(normalizeStoredBpmValue('')).toBeNull();
      expect(normalizeStoredBpmValue('nope')).toBeNull();
    });
  });

  describe('normalizeLibraryItemTrackBpms', () => {
    it('coerces string BPM and clears invalid', () => {
      const item = {
        sides: [
          {
            tracks: [
              { bpm: '120', title: 'a' },
              { bpm: 130, title: 'b' },
              { bpm: 'x', title: 'c' },
            ],
          },
        ],
      };
      expect(normalizeLibraryItemTrackBpms(item)).toBe(true);
      expect(item.sides[0].tracks[0].bpm).toBe(120);
      expect(item.sides[0].tracks[1].bpm).toBe(130);
      expect(item.sides[0].tracks[2].bpm).toBeNull();
    });
    it('returns false when nothing changes', () => {
      const item = {
        sides: [{ tracks: [{ bpm: 100 }] }],
      };
      expect(normalizeLibraryItemTrackBpms(item)).toBe(false);
    });
  });

  describe('normalizeSetlistTrackBpms', () => {
    it('normalizes tracks array', () => {
      const doc = {
        tracks: [{ bpm: '99' }, { bpm: null }],
      };
      expect(normalizeSetlistTrackBpms(doc)).toBe(true);
      expect(doc.tracks[0].bpm).toBe(99);
      expect(doc.tracks[1].bpm).toBeNull();
    });
  });

  describe('mergeBpmIntoSides', () => {
    it('merges found BPM by position', () => {
      const sides = [
        {
          label: 'A',
          tracks: [{ position: 'A1', title: 'One' }],
        },
      ];
      const bpmTracks = [
        { position: 'A1', title: 'One', found: true, bpm: 120, key: 'Am' },
      ];
      const merged = mergeBpmIntoSides(sides, bpmTracks);
      expect(merged[0].tracks[0]).toMatchObject({
        bpm: 120,
        key: 'Am',
      });
    });
    it('leaves track unchanged when no match', () => {
      const sides = [
        { label: 'A', tracks: [{ position: 'A1', title: 'One' }] },
      ];
      const merged = mergeBpmIntoSides(sides, []);
      expect(merged[0].tracks[0]).not.toHaveProperty('bpm');
    });
  });
});
