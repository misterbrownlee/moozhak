import { jest } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock config
jest.unstable_mockModule('../../core/config.js', () => ({
  fileConfig: {
    GETBPM_API_KEY: 'test-api-key',
  },
}));

// Mock logger
jest.unstable_mockModule('../../core/logger.js', () => ({
  log: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

// Mock rate limiter to always allow requests in tests
jest.unstable_mockModule('../../core/services/rateLimiter.js', () => ({
  acquireSlot: jest
    .fn()
    .mockResolvedValue({ allowed: true, waited: 0, blocked: false }),
  canMakeRequest: jest.fn().mockReturnValue(true),
  getStatus: jest.fn().mockReturnValue({
    count: 0,
    limit: 3000,
    remaining: 3000,
    isThrottling: false,
    isBlocked: false,
  }),
  getTimeUntilSlotAvailable: jest.fn().mockReturnValue(0),
}));

const {
  searchSong,
  searchBothByLookup,
  searchByTitle,
  searchArtist,
  getSong,
  getArtist,
  findBpm,
  formatBpmResult,
  isConfigured,
  lookupAlbumBpm,
  GETSONGBPM_BASE_URL,
} = await import('../../core/services/getsongbpm.js');

const { log } = await import('../../core/logger.js');

describe('GetSongBPM API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GETSONGBPM_BASE_URL', () => {
    it('is the correct API base URL', () => {
      expect(GETSONGBPM_BASE_URL).toBe('https://api.getsong.co');
    });
  });

  describe('isConfigured', () => {
    it('returns true when API key is set in file config', () => {
      expect(isConfigured()).toBe(true);
    });

    it('uses explicit apiKey when provided', () => {
      expect(isConfigured('inline-key')).toBe(true);
      expect(isConfigured(null)).toBe(false);
      expect(isConfigured('')).toBe(false);
    });
  });

  describe('searchSong', () => {
    const mockSearchResult = {
      search: [
        {
          id: 'qZPp7',
          title: 'Never Gonna Give You Up',
          tempo: '112',
          time_sig: '4/4',
          key_of: 'A♭m',
          artist: {
            id: 'MKkm',
            name: 'Rick Astley',
          },
          album: {
            title: 'Whenever You Need Somebody',
            year: '1987',
          },
        },
      ],
    };

    it('searches by artist and title', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResult,
      });

      const result = await searchSong('Rick Astley', 'Never Gonna Give You Up');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('api_key=test-api-key'),
        expect.any(Object),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=both'),
        expect.any(Object),
      );
      expect(result).toEqual(mockSearchResult);
    });

    it('includes lookup parameter with artist and song', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResult,
      });

      await searchSong('Rick Astley', 'Never Gonna Give You Up');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('lookup=song'),
        expect.any(Object),
      );
    });

    it('respects limit option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResult,
      });

      await searchSong('Artist', 'Title', { limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object),
      );
    });

    it('returns error on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await searchSong('Artist', 'Title');

      expect(result).toEqual({ error: 'invalid_api_key' });
      expect(log.error).toHaveBeenCalled();
    });

    it('returns error on 429 rate limit', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
      });

      const result = await searchSong('Artist', 'Title');

      expect(result).toEqual({ error: 'rate_limited' });
      expect(log.warn).toHaveBeenCalled();
    });

    it('returns null on other HTTP errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await searchSong('Artist', 'Title');

      expect(result).toBeNull();
    });

    it('logs debug info when verbose', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResult,
      });

      await searchSong('Rick Astley', 'Never Gonna Give You Up', {
        verbose: true,
      });

      expect(log.debug).toHaveBeenCalledWith(
        'GetSongBPM: Searching for "Rick Astley" - "Never Gonna Give You Up"',
      );
    });
  });

  describe('searchByTitle', () => {
    it('searches by title only with type=song', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ search: [] }),
      });

      await searchByTitle('Never Gonna Give You Up');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=song'),
        expect.any(Object),
      );
    });
  });

  describe('searchArtist', () => {
    it('searches by artist name with type=artist', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ search: [] }),
      });

      await searchArtist('Daft Punk');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=artist'),
        expect.any(Object),
      );
    });
  });

  describe('getSong', () => {
    const mockSong = {
      song: {
        id: 'qZPp7',
        title: 'Never Gonna Give You Up',
        tempo: '112',
        artist: { name: 'Rick Astley' },
      },
    };

    it('fetches song by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSong,
      });

      const result = await getSong('qZPp7');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/song/'),
        expect.any(Object),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('id=qZPp7'),
        expect.any(Object),
      );
      expect(result).toEqual(mockSong);
    });

    it('logs debug info when verbose', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSong,
      });

      await getSong('qZPp7', true);

      expect(log.debug).toHaveBeenCalledWith(
        'GetSongBPM: Found "Never Gonna Give You Up" - 112 BPM',
      );
    });
  });

  describe('getArtist', () => {
    const mockArtist = {
      artist: {
        id: 'MKkm',
        name: 'Rick Astley',
        genres: ['pop'],
        from: 'GB',
      },
    };

    it('fetches artist by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockArtist,
      });

      const result = await getArtist('MKkm');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('/artist/'),
        expect.any(Object),
      );
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('id=MKkm'),
        expect.any(Object),
      );
      expect(result).toEqual(mockArtist);
    });
  });

  describe('findBpm', () => {
    const mockSearchResult = {
      search: [
        {
          id: 'qZPp7',
          title: 'Never Gonna Give You Up',
          tempo: '112',
          time_sig: '4/4',
          key_of: 'A♭m',
          open_key: '8m',
          danceability: 73,
          acousticness: 14,
          uri: 'https://getsongbpm.com/song/never-gonna-give-you-up/qZPp7',
          artist: {
            id: 'MKkm',
            name: 'Rick Astley',
          },
          album: {
            title: 'Whenever You Need Somebody',
            year: '1987',
          },
        },
      ],
    };

    it('returns BPM and song info for successful search', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResult,
      });

      const result = await findBpm('Rick Astley', 'Never Gonna Give You Up');

      expect(result.found).toBe(true);
      expect(result.bpm).toBe(112);
      expect(result.song.title).toBe('Never Gonna Give You Up');
      expect(result.song.artist).toBe('Rick Astley');
      expect(result.song.key).toBe('A♭m');
      expect(result.song.timeSignature).toBe('4/4');
    });

    it('returns not found for empty search results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ search: [] }),
      });

      const result = await findBpm('Unknown', 'Unknown Song');

      expect(result.found).toBe(false);
      expect(result.error).toBe('no_results');
      expect(result.bpm).toBeNull();
    });

    it('returns error when search fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await findBpm('Artist', 'Title');

      expect(result.found).toBe(false);
      expect(result.error).toBe('search_failed');
    });

    it('prefers exact artist match', async () => {
      const multipleResults = {
        search: [
          {
            id: 'wrong',
            title: 'Same Title',
            tempo: '100',
            artist: { name: 'Wrong Artist' },
          },
          {
            id: 'correct',
            title: 'Same Title',
            tempo: '120',
            artist: { name: 'Correct Artist' },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => multipleResults,
      });

      const result = await findBpm('Correct Artist', 'Same Title');

      expect(result.song.id).toBe('correct');
      expect(result.bpm).toBe(120);
    });

    it('falls back to first result if no artist match', async () => {
      const multipleResults = {
        search: [
          {
            id: 'first',
            title: 'Title',
            tempo: '100',
            artist: { name: 'First Artist' },
          },
          {
            id: 'second',
            title: 'Title',
            tempo: '120',
            artist: { name: 'Second Artist' },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => multipleResults,
      });

      const result = await findBpm('Unknown Artist', 'Title');

      expect(result.song.id).toBe('first');
    });

    it('accepts API returning a single song object instead of an array (no songs.find crash)', async () => {
      const singleObject = {
        search: {
          id: 'solo',
          title: 'Lonely Hit',
          tempo: '99',
          key_of: 'Cm',
          time_sig: '4/4',
          artist: { name: 'Solo Artist' },
        },
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => singleObject,
      });

      const result = await findBpm('Solo Artist', 'Lonely Hit');

      expect(result.found).toBe(true);
      expect(result.bpm).toBe(99);
      expect(result.song.id).toBe('solo');
    });

    it('accepts single search object missing tempo (found but bpm null)', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          search: {
            id: 'n',
            title: 'No Tempo',
            artist: { name: 'Artist' },
          },
        }),
      });

      const result = await findBpm('Artist', 'No Tempo');

      expect(result.found).toBe(true);
      expect(result.bpm).toBeNull();
      expect(result.song.title).toBe('No Tempo');
    });

    it('uses custom lookup in search when options.lookup is set', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResult,
      });

      await findBpm('Rick Astley', 'Never Gonna Give You Up', {
        lookup: 'song:Custom Title artist:Other',
      });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(new URL(calledUrl).searchParams.get('lookup')).toBe(
        'song:Custom Title artist:Other',
      );
    });

    it('with empty artist uses first search result when using custom lookup', async () => {
      const multipleResults = {
        search: [
          {
            id: 'first',
            title: 'T',
            tempo: '100',
            artist: { name: 'A' },
          },
          {
            id: 'second',
            title: 'T',
            tempo: '120',
            artist: { name: 'B' },
          },
        ],
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => multipleResults,
      });

      const result = await findBpm('', 'ignored', { lookup: 'song:T' });

      expect(result.found).toBe(true);
      expect(result.song.id).toBe('first');
      expect(result.bpm).toBe(100);
    });

    it('trims whitespace from options.lookup', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResult,
      });

      await findBpm('A', 'B', { lookup: '  song:Z  ' });

      const calledUrl = mockFetch.mock.calls[0][0];
      expect(new URL(calledUrl).searchParams.get('lookup')).toBe('song:Z');
    });
  });

  describe('searchBothByLookup', () => {
    it('calls /search/ with type=both and lookup string', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ search: [] }),
      });

      await searchBothByLookup('song:Hi artist:There');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('type=both'),
        expect.any(Object),
      );
      expect(
        new URL(mockFetch.mock.calls[0][0]).searchParams.get('lookup'),
      ).toBe('song:Hi artist:There');
    });
  });

  describe('lookupAlbumBpm', () => {
    const mockTrack1Result = {
      search: [
        {
          id: 'track1',
          title: 'Around the World',
          tempo: '121',
          time_sig: '4/4',
          key_of: 'Am',
          open_key: '8m',
          artist: { name: 'Daft Punk' },
        },
      ],
    };

    const mockTrack2Result = {
      search: [
        {
          id: 'track2',
          title: 'Da Funk',
          tempo: '116',
          time_sig: '4/4',
          key_of: 'Gm',
          open_key: '6m',
          artist: { name: 'Daft Punk' },
        },
      ],
    };

    it('looks up BPM for multiple tracks', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockTrack1Result,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockTrack2Result,
        });

      const tracks = [
        { position: 'A1', title: 'Around the World' },
        { position: 'A2', title: 'Da Funk' },
      ];

      const result = await lookupAlbumBpm('Daft Punk', tracks);

      expect(result.success).toBe(true);
      expect(result.artist).toBe('Daft Punk');
      expect(result.tracks).toHaveLength(2);
      expect(result.tracks[0].bpm).toBe(121);
      expect(result.tracks[0].key).toBe('Am');
      expect(result.tracks[1].bpm).toBe(116);
      expect(result.tracks[1].key).toBe('Gm');
      expect(result.summary.total).toBe(2);
      expect(result.summary.found).toBe(2);
      expect(result.summary.notFound).toBe(0);
      expect(result.summary.rateLimited).toBe(0);
    });

    it('handles tracks not found', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockTrack1Result,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => ({ search: [] }),
        });

      const tracks = [
        { position: 'A1', title: 'Around the World' },
        { position: 'A2', title: 'Unknown Track' },
      ];

      const result = await lookupAlbumBpm('Daft Punk', tracks);

      expect(result.success).toBe(true);
      expect(result.tracks[0].found).toBe(true);
      expect(result.tracks[1].found).toBe(false);
      expect(result.tracks[1].error).toBe('no_results');
      expect(result.summary.found).toBe(1);
      expect(result.summary.notFound).toBe(1);
    });

    it('returns error when API key not configured', async () => {
      // This test uses the mocked config with API key, so we need a separate test file
      // to test the no-API-key case. For now, we test the validation.
      const result = await lookupAlbumBpm('', []);

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_input');
    });

    it('returns error for empty tracks array', async () => {
      const result = await lookupAlbumBpm('Daft Punk', []);

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_input');
    });

    it('returns error for null artist', async () => {
      const result = await lookupAlbumBpm(null, [{ title: 'Test' }]);

      expect(result.success).toBe(false);
      expect(result.error).toBe('invalid_input');
    });

    it('skips tracks without titles', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTrack1Result,
      });

      const tracks = [
        { position: 'A1', title: 'Around the World' },
        { position: 'A2', title: null },
        { position: 'A3' }, // no title property
      ];

      const result = await lookupAlbumBpm('Daft Punk', tracks);

      expect(result.success).toBe(true);
      expect(result.tracks).toHaveLength(3);
      expect(result.tracks[0].found).toBe(true);
      expect(result.tracks[1].found).toBe(false);
      expect(result.tracks[1].error).toBe('no_title');
      expect(result.tracks[2].found).toBe(false);
      expect(result.summary.found).toBe(1);
      expect(result.summary.notFound).toBe(2);
    });

    it('preserves track position in results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTrack1Result,
      });

      const tracks = [{ position: 'B3', title: 'Around the World' }];

      const result = await lookupAlbumBpm('Daft Punk', tracks);

      expect(result.tracks[0].position).toBe('B3');
    });
  });
});

describe('formatBpmResult', () => {
  const successResult = {
    found: true,
    bpm: 120,
    song: {
      tempo: '120',
      key: 'Am',
      timeSignature: '4/4',
    },
  };

  const notFoundResult = {
    found: false,
    error: 'no_results',
    bpm: null,
  };

  describe('human format (default)', () => {
    it('formats BPM, key, and time signature', () => {
      const result = formatBpmResult(successResult);
      expect(result).toBe('120 BPM  Key: Am  Time: 4/4');
    });

    it('returns "BPM not found" for not found', () => {
      expect(formatBpmResult(notFoundResult)).toBe('BPM not found');
    });
  });

  describe('csv format', () => {
    it('formats as comma-separated values', () => {
      const result = formatBpmResult(successResult, 'csv');
      expect(result).toBe('120,Am,4/4');
    });

    it('returns empty CSV for not found', () => {
      expect(formatBpmResult(notFoundResult, 'csv')).toBe(',,,');
    });
  });

  describe('pipe format', () => {
    it('formats with pipe separators', () => {
      const result = formatBpmResult(successResult, 'pipe');
      expect(result).toBe('120 BPM | Key: Am | Time: 4/4');
    });
  });

  describe('markdown format', () => {
    it('formats as markdown table row', () => {
      const result = formatBpmResult(successResult, 'markdown');
      expect(result).toBe('| 120 | Am | 4/4 |');
    });
  });

  describe('missing values', () => {
    it('handles missing key', () => {
      const partial = {
        found: true,
        song: { tempo: '120', timeSignature: '4/4' },
      };
      const result = formatBpmResult(partial);
      expect(result).toContain('Key: N/A');
    });

    it('handles missing time signature', () => {
      const partial = {
        found: true,
        song: { tempo: '120', key: 'Am' },
      };
      const result = formatBpmResult(partial);
      expect(result).toContain('Time: N/A');
    });
  });
});
