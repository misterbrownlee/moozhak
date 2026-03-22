import {
  buildTrackSetMembershipIndex,
  calculateSetStats,
  denormalizeTrackFromLibraryItem,
  findSetsContainingTrack,
  findSetsReferencingLibraryItemId,
  flattenLibraryToTrackRows,
  pickSetThumbUrls,
  SET_NOTES_MAX_LENGTH,
  trackMembershipKey,
  validateSetNotes,
} from '../../../core/domain/setlists.js';

describe('setlists domain', () => {
  describe('trackMembershipKey', () => {
    it('builds stable key', () => {
      expect(trackMembershipKey('lib_1', 'A1')).toBe('lib_1::A1');
      expect(trackMembershipKey('lib_1', ' A1 ')).toBe('lib_1::A1');
    });
  });

  describe('buildTrackSetMembershipIndex', () => {
    it('collects keys from all sets', () => {
      const sets = [
        {
          id: 's1',
          tracks: [
            { libraryItemId: 'a', trackPosition: 'A1' },
            { libraryItemId: 'b', trackPosition: 'B1' },
          ],
        },
        {
          id: 's2',
          tracks: [{ libraryItemId: 'a', trackPosition: 'A2' }],
        },
      ];
      const idx = buildTrackSetMembershipIndex(sets);
      expect(idx.has('a::A1')).toBe(true);
      expect(idx.has('b::B1')).toBe(true);
      expect(idx.has('a::A2')).toBe(true);
      expect(idx.size).toBe(3);
    });
  });

  describe('findSetsReferencingLibraryItemId', () => {
    it('returns unique sets by id', () => {
      const sets = [
        { id: 's1', name: 'Warm-up', tracks: [{ libraryItemId: 'lib_x' }] },
        { id: 's2', name: 'Peak', tracks: [{ libraryItemId: 'lib_y' }] },
        {
          id: 's3',
          name: '',
          tracks: [
            { libraryItemId: 'lib_x', trackPosition: 'A1' },
            { libraryItemId: 'lib_x', trackPosition: 'A2' },
          ],
        },
      ];
      expect(findSetsReferencingLibraryItemId(sets, 'lib_x')).toEqual([
        { id: 's1', name: 'Warm-up' },
        { id: 's3', name: 'Untitled set' },
      ]);
    });
  });

  describe('findSetsContainingTrack', () => {
    it('returns sets that contain the exact track key', () => {
      const sets = [
        {
          id: 's1',
          name: 'Zed',
          tracks: [{ libraryItemId: 'lib_x', trackPosition: 'A1' }],
        },
        {
          id: 's2',
          name: 'Alpha',
          tracks: [{ libraryItemId: 'lib_x', trackPosition: 'A2' }],
        },
      ];
      expect(findSetsContainingTrack(sets, 'lib_x', 'A2')).toEqual([
        {
          id: 's2',
          name: 'Alpha',
          thumbUrls: [],
        },
      ]);
    });

    it('returns multiple sets when the same track appears in each', () => {
      const sets = [
        {
          id: 'a',
          name: 'B',
          tracks: [{ libraryItemId: 'lid', trackPosition: 'B1' }],
        },
        {
          id: 'b',
          name: 'A',
          tracks: [{ libraryItemId: 'lid', position: 'B1' }],
        },
      ];
      const got = findSetsContainingTrack(sets, 'lid', 'B1');
      expect(got.map((x) => x.id)).toEqual(['b', 'a']);
      expect(got.every((x) => x.name && x.id)).toBe(true);
    });

    it('returns [] when no set contains that position', () => {
      const sets = [
        { id: 's1', name: 'S', tracks: [{ libraryItemId: 'lib_x', trackPosition: 'A1' }] },
      ];
      expect(findSetsContainingTrack(sets, 'lib_x', 'A2')).toEqual([]);
    });

    it('uses persisted thumbUrls when length is 4', () => {
      const urls = ['http://1', 'http://2', 'http://3', 'http://4'];
      const sets = [
        {
          id: 's1',
          name: 'S',
          thumbUrls: urls,
          tracks: [{ libraryItemId: 'x', trackPosition: 'A1', thumb: 'http://other' }],
        },
      ];
      expect(findSetsContainingTrack(sets, 'x', 'A1')[0].thumbUrls).toEqual(urls);
    });
  });

  describe('pickSetThumbUrls', () => {
    const mk = (lid, thumb, n = 1) =>
      Array.from({ length: n }, () => ({
        libraryItemId: lid,
        thumb,
        cover: '',
      }));

    it('returns [] when fewer than 4 tracks', () => {
      expect(pickSetThumbUrls(mk('a', 'http://a', 3))).toEqual([]);
    });

    it('returns [] when fewer than 4 unique albums with URLs', () => {
      const tracks = mk('a', 'http://a', 5);
      expect(pickSetThumbUrls(tracks)).toEqual([]);
    });

    it('uses first 4 unique URLs when 4 <= n <= 9', () => {
      const tracks = [
        ...mk('a', 'http://a', 2),
        ...mk('b', 'http://b', 2),
        ...mk('c', 'http://c', 2),
        ...mk('d', 'http://d', 2),
      ];
      expect(tracks.length).toBe(8);
      expect(pickSetThumbUrls(tracks)).toEqual([
        'http://a',
        'http://b',
        'http://c',
        'http://d',
      ]);
    });

    it('uses rng when n >= 10', () => {
      const tracks = [];
      for (let i = 0; i < 10; i++) {
        tracks.push({
          libraryItemId: `lib_${i}`,
          thumb: `http://t${i}`,
          cover: '',
        });
      }
      let c = 0;
      const rng = () => {
        c += 0.1;
        return c % 1 || 0.5;
      };
      const got = pickSetThumbUrls(tracks, rng);
      expect(got).toHaveLength(4);
      const pool = tracks.map((t) => t.thumb);
      for (const u of got) {
        expect(pool).toContain(u);
      }
    });
  });

  describe('calculateSetStats', () => {
    it('handles empty and BPM tracks', () => {
      expect(calculateSetStats([])).toEqual({
        trackCount: 0,
        bpmMin: null,
        bpmMax: null,
        bpmAverage: null,
      });
      expect(
        calculateSetStats([{ bpm: 120 }, { bpm: 130 }, { bpm: null }]),
      ).toEqual({
        trackCount: 3,
        bpmMin: 120,
        bpmMax: 130,
        bpmAverage: 125,
      });
    });
    it('includes string BPM values from stored tracks', () => {
      expect(
        calculateSetStats([{ bpm: '118' }, { bpm: 122 }]),
      ).toEqual({
        trackCount: 2,
        bpmMin: 118,
        bpmMax: 122,
        bpmAverage: 120,
      });
    });
  });

  describe('denormalizeTrackFromLibraryItem', () => {
    it('maps track by position', () => {
      const item = {
        id: 'lib_1',
        title: 'Album',
        artist: 'Artist',
        discogsId: 99,
        thumb: 'http://thumb',
        cover: 'http://cover',
        sides: [
          {
            label: 'A',
            tracks: [
              {
                position: 'A1',
                title: 'One',
                bpm: 128,
                key: 'Am',
                duration: '3:00',
              },
            ],
          },
        ],
      };
      expect(denormalizeTrackFromLibraryItem(item, 'A1')).toMatchObject({
        libraryItemId: 'lib_1',
        trackPosition: 'A1',
        title: 'One',
        albumTitle: 'Album',
        artist: 'Artist',
        bpm: 128,
        thumb: 'http://thumb',
        cover: 'http://cover',
      });
    });

    it('returns null without item id', () => {
      expect(denormalizeTrackFromLibraryItem(null, 'A1')).toBeNull();
    });
  });

  describe('flattenLibraryToTrackRows', () => {
    it('flattens sides', () => {
      const items = [
        {
          id: 'l1',
          title: 'LP',
          artist: 'Band',
          discogsId: 1,
          thumb: 't',
          sides: [
            {
              label: 'A',
              tracks: [{ position: 'A1', title: 'T1', bpm: 100 }],
            },
          ],
        },
      ];
      expect(flattenLibraryToTrackRows(items)).toEqual([
        expect.objectContaining({
          libraryItemId: 'l1',
          position: 'A1',
          albumTitle: 'LP',
          trackTitle: 'T1',
          bpm: 100,
        }),
      ]);
    });
  });

  describe('validateSetNotes', () => {
    it('accepts empty and trims', () => {
      expect(validateSetNotes('')).toEqual({ ok: true, value: '' });
      expect(validateSetNotes('  hi  ')).toEqual({ ok: true, value: 'hi' });
    });

    it('rejects over max length', () => {
      const long = 'x'.repeat(SET_NOTES_MAX_LENGTH + 1);
      const r = validateSetNotes(long);
      expect(r.ok).toBe(false);
      expect(r.error).toContain('300');
    });
  });
});
