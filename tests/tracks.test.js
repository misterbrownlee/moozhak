/**
 * Tests for tracks command with mocked API calls
 * Uses Jest mocks to verify API interactions without actual network requests
 */
import { jest } from '@jest/globals';

// Mock the dependencies before importing the module under test
const mockGetMaster = jest.fn();
const mockGetRelease = jest.fn();
const mockWriteJsonOutput = jest.fn();
const mockWriteTracksOutput = jest.fn();
const mockLog = {
  plain: jest.fn(),
  info: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  header: jest.fn(),
  divider: jest.fn(),
};

jest.unstable_mockModule('../lib/discogs.js', () => ({
  getMaster: mockGetMaster,
  getRelease: mockGetRelease,
  formatTrack: (track, idx, format) => {
    const pos = track.position || String(idx + 1);
    return format === 'csv' ? `${pos},${track.title},${track.duration || ''}` : `  ${pos} ${track.title}`;
  },
  buildDiscogsUrl: (type, id) => `https://www.discogs.com/${type}/${id}`,
}));

jest.unstable_mockModule('../lib/output.js', () => ({
  writeJsonOutput: mockWriteJsonOutput,
  writeTracksOutput: mockWriteTracksOutput,
}));

jest.unstable_mockModule('../lib/logger.js', () => ({
  log: mockLog,
}));

// Import after mocking
const { handleTracks, tracksCommand, buildTracksOutput, extractReleaseInfo } = await import('../lib/commands/tracks.js');

describe('handleTracks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockDb = {};
  const defaultFlags = {
    tracks_output: 'human',
    verbose: false,
  };

  const mockMasterData = {
    title: 'Black Sands',
    artists: [{ name: 'Bonobo' }],
    year: 2010,
    tracklist: [
      { position: '1', title: 'Prelude', duration: '2:15' },
      { position: '2', title: 'Kiara', duration: '5:15' },
    ],
  };

  const mockReleaseData = {
    title: 'Discovery',
    artists: [{ name: 'Daft Punk' }],
    year: 2001,
    tracklist: [
      { position: '1', title: 'One More Time', duration: '5:20' },
      { position: '2', title: 'Aerodynamic', duration: '3:27' },
    ],
  };

  describe('API calls', () => {
    it('calls getMaster for master type', async () => {
      mockGetMaster.mockResolvedValue(mockMasterData);

      await handleTracks(mockDb, 'master', '12345', defaultFlags);

      expect(mockGetMaster).toHaveBeenCalledTimes(1);
      expect(mockGetMaster).toHaveBeenCalledWith(mockDb, 12345, false);
      expect(mockGetRelease).not.toHaveBeenCalled();
    });

    it('calls getRelease for release type', async () => {
      mockGetRelease.mockResolvedValue(mockReleaseData);

      await handleTracks(mockDb, 'release', '67890', defaultFlags);

      expect(mockGetRelease).toHaveBeenCalledTimes(1);
      expect(mockGetRelease).toHaveBeenCalledWith(mockDb, 67890, false);
      expect(mockGetMaster).not.toHaveBeenCalled();
    });

    it('passes verbose flag to API call', async () => {
      mockGetMaster.mockResolvedValue(mockMasterData);
      const flags = { ...defaultFlags, verbose: true };

      await handleTracks(mockDb, 'master', '12345', flags);

      expect(mockGetMaster).toHaveBeenCalledWith(mockDb, 12345, true);
    });

    it('parses string ID to integer', async () => {
      mockGetMaster.mockResolvedValue(mockMasterData);

      await handleTracks(mockDb, 'master', '99999', defaultFlags);

      expect(mockGetMaster).toHaveBeenCalledWith(mockDb, 99999, false);
    });
  });

  describe('error handling', () => {
    it('logs error for invalid ID', async () => {
      await handleTracks(mockDb, 'master', 'not-a-number', defaultFlags);

      expect(mockLog.error).toHaveBeenCalledWith('Invalid ID. Please provide a numeric ID.');
      expect(mockGetMaster).not.toHaveBeenCalled();
    });

    it('logs warning when API returns null', async () => {
      mockGetMaster.mockResolvedValue(null);

      await handleTracks(mockDb, 'master', '12345', defaultFlags);

      expect(mockLog.warn).toHaveBeenCalledWith('Could not fetch master #12345.');
    });

    it('logs warning for empty tracklist', async () => {
      mockGetMaster.mockResolvedValue({ ...mockMasterData, tracklist: [] });

      await handleTracks(mockDb, 'master', '12345', defaultFlags);

      expect(mockLog.warn).toHaveBeenCalledWith('No tracks found.');
    });
  });

  describe('output', () => {
    it('writes JSON output with correct structure', async () => {
      mockGetMaster.mockResolvedValue(mockMasterData);

      await handleTracks(mockDb, 'master', '12345', defaultFlags);

      expect(mockWriteJsonOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'tracks',
          params: {
            sourceType: 'master',
            id: 12345,
          },
          result: expect.objectContaining({
            artist: 'Bonobo',
            title: 'Black Sands',
            year: 2010,
            url: 'https://www.discogs.com/master/12345',
            tracks: expect.arrayContaining([
              expect.objectContaining({ position: '1', title: 'Prelude' }),
              expect.objectContaining({ position: '2', title: 'Kiara' }),
            ]),
          }),
        })
      );
    });

    it('writes tracks output file', async () => {
      mockGetMaster.mockResolvedValue(mockMasterData);

      await handleTracks(mockDb, 'master', '12345', defaultFlags);

      expect(mockWriteTracksOutput).toHaveBeenCalledWith(
        expect.any(String),
        12345,
        'human',
        'Bonobo',
        'Black Sands'
      );
    });

    it('uses correct URL for release type', async () => {
      mockGetRelease.mockResolvedValue(mockReleaseData);

      await handleTracks(mockDb, 'release', '67890', defaultFlags);

      expect(mockWriteJsonOutput).toHaveBeenCalledWith(
        expect.objectContaining({
          result: expect.objectContaining({
            url: 'https://www.discogs.com/release/67890',
          }),
        })
      );
    });

    it('logs success message with album info', async () => {
      mockGetMaster.mockResolvedValue(mockMasterData);

      await handleTracks(mockDb, 'master', '12345', defaultFlags);

      expect(mockLog.success).toHaveBeenCalledWith(
        'Found: master #12345 - Bonobo - Black Sands (2010)'
      );
    });

    it('handles missing year in success message', async () => {
      mockGetMaster.mockResolvedValue({ ...mockMasterData, year: null });

      await handleTracks(mockDb, 'master', '12345', defaultFlags);

      expect(mockLog.success).toHaveBeenCalledWith(
        'Found: master #12345 - Bonobo - Black Sands'
      );
    });
  });

  describe('output formats', () => {
    it('uses human format by default', async () => {
      mockGetMaster.mockResolvedValue(mockMasterData);

      await handleTracks(mockDb, 'master', '12345', { tracks_output: 'human', verbose: false });

      expect(mockLog.header).toHaveBeenCalledWith('Tracklist (2 tracks):\n');
    });

    it('outputs CSV header for csv format', async () => {
      mockGetMaster.mockResolvedValue(mockMasterData);

      await handleTracks(mockDb, 'master', '12345', { tracks_output: 'csv', verbose: false });

      expect(mockLog.plain).toHaveBeenCalledWith('position,title,duration');
    });

    it('outputs markdown headers for markdown format', async () => {
      mockGetMaster.mockResolvedValue(mockMasterData);

      await handleTracks(mockDb, 'master', '12345', { tracks_output: 'markdown', verbose: false });

      expect(mockLog.plain).toHaveBeenCalledWith('| Position | Title | Duration |');
      expect(mockLog.plain).toHaveBeenCalledWith('|----------|-------|----------|');
    });

    it('passes format to writeTracksOutput', async () => {
      mockGetMaster.mockResolvedValue(mockMasterData);

      await handleTracks(mockDb, 'master', '12345', { tracks_output: 'csv', verbose: false });

      expect(mockWriteTracksOutput).toHaveBeenCalledWith(
        expect.any(String),
        12345,
        'csv',
        'Bonobo',
        'Black Sands'
      );
    });
  });
});

describe('tracksCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has correct command metadata', () => {
    expect(tracksCommand.name).toBe('tracks');
    expect(tracksCommand.aliases).toContain('t');
    expect(tracksCommand.minArgs).toBe(1);
    expect(tracksCommand.usage).toBe('tracks [type] <id>');
  });

  it('calls handleTracks with parsed args', async () => {
    mockGetMaster.mockResolvedValue({
      title: 'Test',
      artists: [{ name: 'Artist' }],
      tracklist: [],
    });

    const ctx = {
      db: {},
      sessionFlags: { tracks_type: 'master', tracks_output: 'human', verbose: false },
    };

    await tracksCommand.handler(['12345'], ctx);

    expect(mockGetMaster).toHaveBeenCalledWith(ctx.db, 12345, false);
  });

  it('uses session tracks_type as default', async () => {
    mockGetRelease.mockResolvedValue({
      title: 'Test',
      artists: [{ name: 'Artist' }],
      tracklist: [],
    });

    const ctx = {
      db: {},
      sessionFlags: { tracks_type: 'release', tracks_output: 'human', verbose: false },
    };

    await tracksCommand.handler(['12345'], ctx);

    expect(mockGetRelease).toHaveBeenCalled();
    expect(mockGetMaster).not.toHaveBeenCalled();
  });

  it('allows overriding type via args', async () => {
    mockGetRelease.mockResolvedValue({
      title: 'Test',
      artists: [{ name: 'Artist' }],
      tracklist: [],
    });

    const ctx = {
      db: {},
      sessionFlags: { tracks_type: 'master', tracks_output: 'human', verbose: false },
    };

    await tracksCommand.handler(['release', '12345'], ctx);

    expect(mockGetRelease).toHaveBeenCalled();
    expect(mockGetMaster).not.toHaveBeenCalled();
  });

  it('returns true to continue REPL', async () => {
    mockGetMaster.mockResolvedValue(null);

    const ctx = {
      db: {},
      sessionFlags: { tracks_type: 'master', tracks_output: 'human', verbose: false },
    };

    const result = await tracksCommand.handler(['12345'], ctx);

    expect(result).toBe(true);
  });

  it('handles invalid type error', async () => {
    const ctx = {
      db: {},
      sessionFlags: { tracks_type: 'master', tracks_output: 'human', verbose: false },
    };

    const result = await tracksCommand.handler(['artist', '12345'], ctx);

    expect(result).toBe(true);
    expect(mockLog.error).toHaveBeenCalledWith("Invalid type 'artist'");
    expect(mockGetMaster).not.toHaveBeenCalled();
  });
});

describe('extractReleaseInfo (pure function)', () => {
  it('extracts all fields from complete data', () => {
    const data = {
      title: 'Black Sands',
      artists: [{ name: 'Bonobo' }],
      year: 2010,
      tracklist: [{ position: '1', title: 'Prelude' }],
    };

    const info = extractReleaseInfo(data, 'master', 12345);

    expect(info).toEqual({
      artists: 'Bonobo',
      title: 'Black Sands',
      year: 2010,
      url: 'https://www.discogs.com/master/12345',
      tracklist: [{ position: '1', title: 'Prelude' }],
    });
  });

  it('joins multiple artists with comma', () => {
    const data = {
      title: 'Test',
      artists: [{ name: 'Artist 1' }, { name: 'Artist 2' }, { name: 'Artist 3' }],
      tracklist: [],
    };

    const info = extractReleaseInfo(data, 'master', 1);

    expect(info.artists).toBe('Artist 1, Artist 2, Artist 3');
  });

  it('handles missing artists', () => {
    const data = { title: 'Test', tracklist: [] };

    const info = extractReleaseInfo(data, 'master', 1);

    expect(info.artists).toBe('Unknown Artist');
  });

  it('handles missing title', () => {
    const data = { artists: [{ name: 'Artist' }], tracklist: [] };

    const info = extractReleaseInfo(data, 'master', 1);

    expect(info.title).toBe('Untitled');
  });

  it('handles missing year', () => {
    const data = { title: 'Test', artists: [{ name: 'Artist' }], tracklist: [] };

    const info = extractReleaseInfo(data, 'master', 1);

    expect(info.year).toBeNull();
  });

  it('handles missing tracklist', () => {
    const data = { title: 'Test', artists: [{ name: 'Artist' }] };

    const info = extractReleaseInfo(data, 'master', 1);

    expect(info.tracklist).toEqual([]);
  });

  it('builds correct URL for master type', () => {
    const data = { title: 'Test', tracklist: [] };

    const info = extractReleaseInfo(data, 'master', 99999);

    expect(info.url).toBe('https://www.discogs.com/master/99999');
  });

  it('builds correct URL for release type', () => {
    const data = { title: 'Test', tracklist: [] };

    const info = extractReleaseInfo(data, 'release', 88888);

    expect(info.url).toBe('https://www.discogs.com/release/88888');
  });
});

describe('buildTracksOutput (pure function)', () => {
  const sampleReleaseInfo = {
    artists: 'Bonobo',
    title: 'Black Sands',
    year: 2010,
    url: 'https://www.discogs.com/master/12345',
    tracklist: [
      { position: '1', title: 'Prelude', duration: '2:15' },
      { position: '2', title: 'Kiara', duration: '5:15' },
    ],
  };

  it('builds correct output structure', () => {
    const output = buildTracksOutput('master', 12345, sampleReleaseInfo);

    expect(output).toEqual({
      type: 'tracks',
      params: {
        sourceType: 'master',
        id: 12345,
      },
      result: {
        artist: 'Bonobo',
        title: 'Black Sands',
        year: 2010,
        url: 'https://www.discogs.com/master/12345',
        tracks: [
          { position: '1', title: 'Prelude', duration: '2:15', type_: 'track' },
          { position: '2', title: 'Kiara', duration: '5:15', type_: 'track' },
        ],
      },
    });
  });

  it('sets correct sourceType for release', () => {
    const releaseInfo = { ...sampleReleaseInfo, url: 'https://www.discogs.com/release/67890' };

    const output = buildTracksOutput('release', 67890, releaseInfo);

    expect(output.params.sourceType).toBe('release');
    expect(output.params.id).toBe(67890);
  });

  it('handles empty tracklist', () => {
    const releaseInfo = { ...sampleReleaseInfo, tracklist: [] };

    const output = buildTracksOutput('master', 12345, releaseInfo);

    expect(output.result.tracks).toEqual([]);
  });

  it('uses index+1 as position when missing', () => {
    const releaseInfo = {
      ...sampleReleaseInfo,
      tracklist: [
        { title: 'Track One' },
        { title: 'Track Two' },
      ],
    };

    const output = buildTracksOutput('master', 12345, releaseInfo);

    expect(output.result.tracks[0].position).toBe('1');
    expect(output.result.tracks[1].position).toBe('2');
  });

  it('handles missing track title', () => {
    const releaseInfo = {
      ...sampleReleaseInfo,
      tracklist: [{ position: '1', duration: '3:00' }],
    };

    const output = buildTracksOutput('master', 12345, releaseInfo);

    expect(output.result.tracks[0].title).toBe('');
  });

  it('handles missing duration', () => {
    const releaseInfo = {
      ...sampleReleaseInfo,
      tracklist: [{ position: '1', title: 'Test' }],
    };

    const output = buildTracksOutput('master', 12345, releaseInfo);

    expect(output.result.tracks[0].duration).toBe('');
  });

  it('preserves track type_ field', () => {
    const releaseInfo = {
      ...sampleReleaseInfo,
      tracklist: [{ position: '1', title: 'Test', type_: 'heading' }],
    };

    const output = buildTracksOutput('master', 12345, releaseInfo);

    expect(output.result.tracks[0].type_).toBe('heading');
  });

  it('defaults type_ to track when missing', () => {
    const releaseInfo = {
      ...sampleReleaseInfo,
      tracklist: [{ position: '1', title: 'Test' }],
    };

    const output = buildTracksOutput('master', 12345, releaseInfo);

    expect(output.result.tracks[0].type_).toBe('track');
  });

  it('handles null year', () => {
    const releaseInfo = { ...sampleReleaseInfo, year: null };

    const output = buildTracksOutput('master', 12345, releaseInfo);

    expect(output.result.year).toBeNull();
  });
});

