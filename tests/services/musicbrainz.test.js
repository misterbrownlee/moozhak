import { jest } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock logger
jest.unstable_mockModule('../../lib/logger.js', () => ({
  log: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const {
  lookupByUrl,
  lookupByDiscogsRelease,
  getRelease,
  getRecording,
  searchRecordings,
  getIsrcsForDiscogsRelease,
  findTrackIsrcs,
  isValidMbid,
  MUSICBRAINZ_BASE_URL,
  USER_AGENT,
} = await import('../../lib/services/musicbrainz.js');

const { log } = await import('../../lib/logger.js');

describe('MusicBrainz API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset rate limit timer
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('constants', () => {
    it('has correct base URL', () => {
      expect(MUSICBRAINZ_BASE_URL).toBe('https://musicbrainz.org/ws/2');
    });

    it('has user agent with app name', () => {
      expect(USER_AGENT).toContain('moozhak');
    });
  });

  describe('getRecording', () => {
    const mockRecording = {
      id: '8f3471b5-7e6a-48da-86a9-c1c07a0f47ae',
      title: 'Never Gonna Give You Up',
      length: 212960,
      isrcs: ['GBARL8700052', 'USAT21601138'],
    };

    it('fetches recording with ISRCs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRecording,
      });

      jest.advanceTimersByTime(1200);
      const result = await getRecording('8f3471b5-7e6a-48da-86a9-c1c07a0f47ae');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          '/recording/8f3471b5-7e6a-48da-86a9-c1c07a0f47ae',
        ),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': USER_AGENT,
          }),
        }),
      );
      expect(result).toEqual(mockRecording);
    });

    it('includes isrcs in request', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRecording,
      });

      jest.advanceTimersByTime(1200);
      await getRecording('test-id');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('inc=isrcs'),
        expect.any(Object),
      );
    });

    it('returns null on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      jest.advanceTimersByTime(1200);
      const result = await getRecording('invalid-id');

      expect(result).toBeNull();
      expect(log.error).toHaveBeenCalled();
    });

    it('returns rate limit error on 503', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 503,
      });

      jest.advanceTimersByTime(1200);
      const result = await getRecording('test-id');

      expect(result).toEqual({ error: 'rate_limited' });
      expect(log.warn).toHaveBeenCalled();
    });

    it('logs debug info when verbose', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRecording,
      });

      jest.advanceTimersByTime(1200);
      await getRecording('test-id', true);

      expect(log.debug).toHaveBeenCalledWith(
        'MusicBrainz: Fetching recording test-id',
      );
    });
  });

  describe('getRelease', () => {
    const mockRelease = {
      id: 'dc919562-19c7-42c8-961c-7ed5520f00bb',
      title: 'Never Gonna Give You Up',
      media: [
        {
          tracks: [
            {
              number: 'A',
              title: 'Never Gonna Give You Up',
              recording: {
                id: 'rec-id',
                isrcs: ['GBARL8700052'],
              },
            },
          ],
        },
      ],
    };

    it('fetches release with recordings and ISRCs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockRelease,
      });

      jest.advanceTimersByTime(1200);
      const result = await getRelease('dc919562-19c7-42c8-961c-7ed5520f00bb');

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('inc=recordings%2Bisrcs'),
        expect.any(Object),
      );
      expect(result).toEqual(mockRelease);
    });
  });

  describe('searchRecordings', () => {
    const mockSearchResults = {
      count: 68,
      recordings: [
        {
          id: 'f0611db0-7393-4efa-9a8a-cd9441df8d7f',
          score: 100,
          title: 'Never Gonna Give You Up',
          'artist-credit': [
            {
              artist: {
                id: 'db92a151-1ac2-438b-bc43-b82e149ddd50',
                name: 'Rick Astley',
              },
            },
          ],
        },
      ],
    };

    it('searches by artist and title', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResults,
      });

      jest.advanceTimersByTime(1200);
      const result = await searchRecordings(
        'Rick Astley',
        'Never Gonna Give You Up',
      );

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('recording%3A%22Never+Gonna+Give+You+Up%22'),
        expect.any(Object),
      );
      expect(result).toEqual(mockSearchResults);
    });

    it('respects limit option', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockSearchResults,
      });

      jest.advanceTimersByTime(1200);
      await searchRecordings('Artist', 'Title', { limit: 10 });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('limit=10'),
        expect.any(Object),
      );
    });
  });

  describe('lookupByUrl', () => {
    it('looks up URL and gets relations', async () => {
      // First call: URL lookup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'url-id',
          resource: 'https://www.discogs.com/release/249504',
        }),
      });

      // Second call: URL with relations
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'url-id',
          relations: [
            {
              release: {
                id: 'release-id',
                title: 'Test Release',
              },
            },
          ],
        }),
      });

      jest.advanceTimersByTime(2500);
      const result = await lookupByUrl(
        'https://www.discogs.com/release/249504',
      );

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.relations).toHaveLength(1);
    });
  });

  describe('lookupByDiscogsRelease', () => {
    it('constructs Discogs URL from release ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'url-id' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'url-id', relations: [] }),
      });

      jest.advanceTimersByTime(2500);
      await lookupByDiscogsRelease(249504);

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(
          'https%3A%2F%2Fwww.discogs.com%2Frelease%2F249504',
        ),
        expect.any(Object),
      );
    });
  });

  describe('getIsrcsForDiscogsRelease', () => {
    it('returns tracks with ISRCs for valid Discogs release', async () => {
      // URL lookup
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'url-id' }),
      });

      // URL with relations
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'url-id',
          relations: [
            {
              release: {
                id: 'mb-release-id',
                title: 'Test Album',
              },
            },
          ],
        }),
      });

      // Release with recordings
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'mb-release-id',
          title: 'Test Album',
          media: [
            {
              tracks: [
                {
                  number: '1',
                  title: 'Track One',
                  recording: {
                    id: 'rec-1',
                    isrcs: ['ISRC001', 'ISRC002'],
                  },
                },
                {
                  number: '2',
                  title: 'Track Two',
                  recording: {
                    id: 'rec-2',
                    isrcs: [],
                  },
                },
              ],
            },
          ],
        }),
      });

      jest.advanceTimersByTime(4000);
      const result = await getIsrcsForDiscogsRelease(123456);

      expect(result.found).toBe(true);
      expect(result.releaseTitle).toBe('Test Album');
      expect(result.tracks).toHaveLength(2);
      expect(result.tracks[0].isrcs).toEqual(['ISRC001', 'ISRC002']);
      expect(result.tracks[1].isrcs).toEqual([]);
    });

    it('returns not found for unknown Discogs release', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      jest.advanceTimersByTime(1200);
      const result = await getIsrcsForDiscogsRelease(999999);

      expect(result.found).toBe(false);
      expect(result.tracks).toEqual([]);
    });

    it('returns error when no release is linked', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'url-id' }),
      });
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'url-id', relations: [] }),
      });

      jest.advanceTimersByTime(2500);
      const result = await getIsrcsForDiscogsRelease(123456);

      expect(result.found).toBe(false);
      expect(result.error).toBe('no_release_linked');
    });
  });

  describe('findTrackIsrcs', () => {
    it('searches and returns ISRCs for best match', async () => {
      // Search results
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          count: 1,
          recordings: [
            {
              id: 'rec-id',
              title: 'Test Track',
              score: 100,
              'artist-credit': [{ artist: { name: 'Test Artist' } }],
            },
          ],
        }),
      });

      // Recording with ISRCs
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'rec-id',
          title: 'Test Track',
          isrcs: ['ISRC123'],
        }),
      });

      jest.advanceTimersByTime(2500);
      const result = await findTrackIsrcs('Test Artist', 'Test Track');

      expect(result.found).toBe(true);
      expect(result.isrcs).toEqual(['ISRC123']);
      expect(result.recording.title).toBe('Test Track');
    });

    it('returns empty ISRCs when search has no results', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ count: 0, recordings: [] }),
      });

      jest.advanceTimersByTime(1200);
      const result = await findTrackIsrcs('Unknown', 'Track');

      expect(result.found).toBe(false);
      expect(result.isrcs).toEqual([]);
    });

    it('prefers artist name match', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          count: 2,
          recordings: [
            {
              id: 'wrong-id',
              title: 'Test Track',
              score: 100,
              'artist-credit': [{ artist: { name: 'Wrong Artist' } }],
            },
            {
              id: 'correct-id',
              title: 'Test Track',
              score: 95,
              'artist-credit': [{ artist: { name: 'Correct Artist' } }],
            },
          ],
        }),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          id: 'correct-id',
          title: 'Test Track',
          isrcs: ['CORRECT_ISRC'],
        }),
      });

      jest.advanceTimersByTime(2500);
      const result = await findTrackIsrcs('Correct Artist', 'Test Track');

      expect(result.recording.id).toBe('correct-id');
    });
  });
});

describe('isValidMbid', () => {
  it('validates correct MBID format', () => {
    expect(isValidMbid('8f3471b5-7e6a-48da-86a9-c1c07a0f47ae')).toBe(true);
    expect(isValidMbid('dc919562-19c7-42c8-961c-7ed5520f00bb')).toBe(true);
  });

  it('accepts uppercase MBIDs', () => {
    expect(isValidMbid('8F3471B5-7E6A-48DA-86A9-C1C07A0F47AE')).toBe(true);
  });

  it('rejects invalid formats', () => {
    expect(isValidMbid('not-a-mbid')).toBe(false);
    expect(isValidMbid('12345')).toBe(false);
    expect(isValidMbid('')).toBe(false);
    expect(isValidMbid('8f3471b5-7e6a-48da-86a9')).toBe(false);
  });

  it('rejects Discogs-style numeric IDs', () => {
    expect(isValidMbid('249504')).toBe(false);
  });
});
