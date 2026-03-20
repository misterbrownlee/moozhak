import {
  createBoxSetItems,
  extractTracksFromSides,
  getTrackSide,
  groupTracksBySide,
  isBoxSet,
  mergeBpmIntoSides,
  normalizeLibraryItem,
  parseBoxSetAlbums,
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
