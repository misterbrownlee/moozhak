import { jest } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn();
global.fetch = mockFetch;

// Mock logger
jest.unstable_mockModule('../lib/logger.js', () => ({
  log: {
    debug: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

const {
  getTrack,
  getTracks,
  getAudioFeatures,
  getArtist,
  getTrackWithFeatures,
  formatBpm,
  formatAudioFeatures,
  isValidReccoBeatsId,
  RECCOBEATS_BASE_URL,
} = await import('../lib/reccobeats.js');

const { log } = await import('../lib/logger.js');

describe('ReccoBeats API', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('RECCOBEATS_BASE_URL', () => {
    it('is the correct API base URL', () => {
      expect(RECCOBEATS_BASE_URL).toBe('https://api.reccobeats.com/v1');
    });
  });

  describe('getTrack', () => {
    const mockTrack = {
      id: '8212bab8-5911-48a0-b177-24923ef2329a',
      trackTitle: 'Wicked Games',
      artists: [{ id: 'artist-id', name: 'The Weeknd' }],
      durationMs: 325305,
      isrc: 'USUM72104140',
      popularity: 69,
    };

    it('fetches track by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTrack,
      });

      const result = await getTrack('8212bab8-5911-48a0-b177-24923ef2329a');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.reccobeats.com/v1/track/8212bab8-5911-48a0-b177-24923ef2329a',
        expect.objectContaining({
          headers: expect.objectContaining({
            Accept: 'application/json',
          }),
        }),
      );
      expect(result).toEqual(mockTrack);
    });

    it('returns null on HTTP error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
      });

      const result = await getTrack('invalid-id');

      expect(result).toBeNull();
      expect(log.error).toHaveBeenCalled();
    });

    it('returns rate limit error on 429', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        headers: new Map([['Retry-After', '30']]),
      });

      const result = await getTrack('test-id');

      expect(result).toEqual({ error: 'rate_limited', retryAfter: 30 });
      expect(log.warn).toHaveBeenCalled();
    });

    it('returns auth error on 401', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 401,
      });

      const result = await getTrack('test-id');

      expect(result).toEqual({ error: 'auth_required' });
      expect(log.error).toHaveBeenCalled();
    });

    it('returns null on network error', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      const result = await getTrack('test-id');

      expect(result).toBeNull();
      expect(log.error).toHaveBeenCalledWith(
        'ReccoBeats request failed: Network error',
      );
    });

    it('logs debug info when verbose', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTrack,
      });

      await getTrack('test-id', true);

      expect(log.debug).toHaveBeenCalledWith(
        'ReccoBeats: Fetching track test-id',
      );
      expect(log.debug).toHaveBeenCalledWith(
        'ReccoBeats: Found track "Wicked Games"',
      );
    });
  });

  describe('getTracks', () => {
    const mockTracks = {
      content: [
        { id: 'id1', trackTitle: 'Track 1' },
        { id: 'id2', trackTitle: 'Track 2' },
      ],
    };

    it('fetches multiple tracks by IDs', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTracks,
      });

      const result = await getTracks(['id1', 'id2']);

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.reccobeats.com/v1/track?ids=id1,id2',
        expect.any(Object),
      );
      expect(result).toEqual(mockTracks);
    });

    it('returns empty content for empty array', async () => {
      const result = await getTracks([]);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual({ content: [] });
    });

    it('returns empty content for null input', async () => {
      const result = await getTracks(null);

      expect(mockFetch).not.toHaveBeenCalled();
      expect(result).toEqual({ content: [] });
    });

    it('logs debug info when verbose', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockTracks,
      });

      await getTracks(['id1', 'id2'], true);

      expect(log.debug).toHaveBeenCalledWith('ReccoBeats: Fetching 2 tracks');
      expect(log.debug).toHaveBeenCalledWith('ReccoBeats: Found 2 tracks');
    });
  });

  describe('getAudioFeatures', () => {
    const mockFeatures = {
      id: 'track-id',
      tempo: 114.033,
      acousticness: 0.0217,
      danceability: 0.606,
      energy: 0.57,
      valence: 0.258,
    };

    it('fetches audio features by track ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockFeatures,
      });

      const result = await getAudioFeatures('track-id');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.reccobeats.com/v1/track/track-id/audio-features',
        expect.any(Object),
      );
      expect(result).toEqual(mockFeatures);
    });

    it('logs debug info with BPM when verbose', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockFeatures,
      });

      await getAudioFeatures('track-id', true);

      expect(log.debug).toHaveBeenCalledWith('ReccoBeats: BPM = 114.033');
    });
  });

  describe('getArtist', () => {
    const mockArtist = {
      id: 'artist-id',
      name: 'The Weeknd',
      href: 'https://open.spotify.com/artist/xxx',
    };

    it('fetches artist by ID', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockArtist,
      });

      const result = await getArtist('artist-id');

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.reccobeats.com/v1/artist/artist-id',
        expect.any(Object),
      );
      expect(result).toEqual(mockArtist);
    });

    it('logs debug info when verbose', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => mockArtist,
      });

      await getArtist('artist-id', true);

      expect(log.debug).toHaveBeenCalledWith(
        'ReccoBeats: Found artist "The Weeknd"',
      );
    });
  });

  describe('getTrackWithFeatures', () => {
    const mockTrack = {
      id: 'track-id',
      trackTitle: 'Test Track',
      artists: [{ name: 'Artist' }],
    };

    const mockFeatures = {
      tempo: 120,
      energy: 0.8,
    };

    it('fetches track and features in parallel', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockTrack,
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockFeatures,
        });

      const result = await getTrackWithFeatures('track-id');

      expect(result).toEqual({
        ...mockTrack,
        audioFeatures: mockFeatures,
      });
    });

    it('returns null audioFeatures if features request fails', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockTrack,
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
        });

      const result = await getTrackWithFeatures('track-id');

      expect(result).toEqual({
        ...mockTrack,
        audioFeatures: null,
      });
    });

    it('returns error if track request fails', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const result = await getTrackWithFeatures('track-id');

      expect(result).toBeNull();
    });

    it('returns rate limit error from track request', async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: false,
          status: 429,
          headers: new Map([['Retry-After', '60']]),
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: async () => mockFeatures,
        });

      const result = await getTrackWithFeatures('track-id');

      expect(result).toEqual({ error: 'rate_limited', retryAfter: 60 });
    });
  });
});

describe('formatBpm', () => {
  it('rounds tempo to nearest integer', () => {
    expect(formatBpm(114.033)).toBe('114');
    expect(formatBpm(120.9)).toBe('121');
    expect(formatBpm(90.5)).toBe('91');
  });

  it('returns "N/A" for null', () => {
    expect(formatBpm(null)).toBe('N/A');
  });

  it('returns "N/A" for undefined', () => {
    expect(formatBpm(undefined)).toBe('N/A');
  });

  it('handles zero', () => {
    expect(formatBpm(0)).toBe('0');
  });

  it('handles integer values', () => {
    expect(formatBpm(120)).toBe('120');
  });
});

describe('formatAudioFeatures', () => {
  const features = {
    tempo: 114.033,
    energy: 0.57,
    danceability: 0.606,
    valence: 0.258,
  };

  describe('human format (default)', () => {
    it('formats all features', () => {
      const result = formatAudioFeatures(features);
      expect(result).toBe(
        'BPM: 114  Energy: 57%  Danceability: 61%  Mood: 26%',
      );
    });

    it('returns unavailable message for null features', () => {
      expect(formatAudioFeatures(null)).toBe('Audio features unavailable');
    });

    it('returns unavailable message for error response', () => {
      expect(formatAudioFeatures({ error: 'rate_limited' })).toBe(
        'Audio features unavailable',
      );
    });
  });

  describe('csv format', () => {
    it('formats as comma-separated values', () => {
      const result = formatAudioFeatures(features, 'csv');
      expect(result).toBe('114,57,61,26');
    });

    it('returns empty CSV for null features', () => {
      expect(formatAudioFeatures(null, 'csv')).toBe(',,,,');
    });
  });

  describe('pipe format', () => {
    it('formats with pipe separators', () => {
      const result = formatAudioFeatures(features, 'pipe');
      expect(result).toBe('114 | 57% | 61% | 26%');
    });
  });

  describe('markdown format', () => {
    it('formats as markdown table row', () => {
      const result = formatAudioFeatures(features, 'markdown');
      expect(result).toBe('| 114 | 57% | 61% | 26% |');
    });
  });

  describe('missing values', () => {
    it('handles missing energy', () => {
      const partial = { tempo: 120 };
      const result = formatAudioFeatures(partial);
      expect(result).toContain('BPM: 120');
      expect(result).toContain('Energy: N/A');
    });

    it('handles missing tempo', () => {
      const partial = { energy: 0.5 };
      const result = formatAudioFeatures(partial);
      expect(result).toContain('BPM: N/A');
    });
  });
});

describe('isValidReccoBeatsId', () => {
  it('validates correct UUID format', () => {
    expect(isValidReccoBeatsId('8212bab8-5911-48a0-b177-24923ef2329a')).toBe(
      true,
    );
    expect(isValidReccoBeatsId('9451b6b2-8746-4d43-abd7-c355ed1e3048')).toBe(
      true,
    );
  });

  it('accepts uppercase UUIDs', () => {
    expect(isValidReccoBeatsId('8212BAB8-5911-48A0-B177-24923EF2329A')).toBe(
      true,
    );
  });

  it('rejects invalid formats', () => {
    expect(isValidReccoBeatsId('not-a-uuid')).toBe(false);
    expect(isValidReccoBeatsId('12345')).toBe(false);
    expect(isValidReccoBeatsId('')).toBe(false);
    expect(isValidReccoBeatsId('8212bab8-5911-48a0-b177')).toBe(false);
    expect(isValidReccoBeatsId('8212bab8591148a0b17724923ef2329a')).toBe(false);
  });

  it('rejects Discogs-style numeric IDs', () => {
    expect(isValidReccoBeatsId('27113')).toBe(false);
    expect(isValidReccoBeatsId('249504')).toBe(false);
  });
});

