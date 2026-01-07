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
}));

jest.unstable_mockModule('../lib/output.js', () => ({
  writeJsonOutput: mockWriteJsonOutput,
  writeTracksOutput: mockWriteTracksOutput,
}));

jest.unstable_mockModule('../lib/logger.js', () => ({
  log: mockLog,
}));

// Import after mocking
const { handleTracks, tracksCommand } = await import('../lib/commands/tracks.js');

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

