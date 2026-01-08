import { jest } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock config
jest.unstable_mockModule('../../lib/config.js', () => ({
  fileConfig: {
    GETBPM_API_KEY: 'test-api-key',
  },
}));

// Mock logger
jest.unstable_mockModule('../../lib/logger.js', () => ({
  log: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const {
  searchSong,
  searchByTitle,
  searchArtist,
  getSong,
  getArtist,
  findBpm,
  formatBpmResult,
  isConfigured,
  GETSONGBPM_BASE_URL,
} = await import('../../lib/services/getsongbpm.js');

const { log } = await import('../../lib/logger.js');

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
    it('returns true when API key is set', () => {
      expect(isConfigured()).toBe(true);
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
