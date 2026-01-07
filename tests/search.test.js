/**
 * Tests for search command with mocked API calls
 * Uses Jest mocks to verify API interactions without actual network requests
 */
import { jest } from '@jest/globals';

// Mock the dependencies before importing the module under test
const mockSearchDiscogs = jest.fn();
const mockWriteJsonOutput = jest.fn();
const mockLog = {
  plain: jest.fn(),
  info: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  divider: jest.fn(),
};

jest.unstable_mockModule('../lib/discogs.js', () => ({
  searchDiscogs: mockSearchDiscogs,
  formatResult: (result) => `  ${result.id} | ${result.title}`,
  buildDiscogsUrlFromUri: (uri) => `https://www.discogs.com${uri}`,
}));

jest.unstable_mockModule('../lib/output.js', () => ({
  writeJsonOutput: mockWriteJsonOutput,
}));

jest.unstable_mockModule('../lib/logger.js', () => ({
  log: mockLog,
}));

// Import after mocking
const { handleSearch, searchCommand, buildSearchOutput } = await import(
  '../lib/commands/search.js'
);

describe('handleSearch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const mockDb = { search: jest.fn() };
  const defaultFlags = {
    type: null,
    per_page: 5,
    verbose: false,
  };

  it('calls searchDiscogs with correct parameters', async () => {
    mockSearchDiscogs.mockResolvedValue([]);

    await handleSearch(mockDb, 'Daft Punk', defaultFlags);

    expect(mockSearchDiscogs).toHaveBeenCalledTimes(1);
    expect(mockSearchDiscogs).toHaveBeenCalledWith(
      mockDb,
      'Daft Punk',
      null,
      5,
      false,
    );
  });

  it('passes type filter to searchDiscogs', async () => {
    mockSearchDiscogs.mockResolvedValue([]);
    const flags = { ...defaultFlags, type: 'master' };

    await handleSearch(mockDb, 'Bonobo', flags);

    expect(mockSearchDiscogs).toHaveBeenCalledWith(
      mockDb,
      'Bonobo',
      'master',
      5,
      false,
    );
  });

  it('passes per_page setting to searchDiscogs', async () => {
    mockSearchDiscogs.mockResolvedValue([]);
    const flags = { ...defaultFlags, per_page: 10 };

    await handleSearch(mockDb, 'Tycho', flags);

    expect(mockSearchDiscogs).toHaveBeenCalledWith(
      mockDb,
      'Tycho',
      null,
      10,
      false,
    );
  });

  it('passes verbose flag to searchDiscogs', async () => {
    mockSearchDiscogs.mockResolvedValue([]);
    const flags = { ...defaultFlags, verbose: true };

    await handleSearch(mockDb, 'Boards of Canada', flags);

    expect(mockSearchDiscogs).toHaveBeenCalledWith(
      mockDb,
      'Boards of Canada',
      null,
      5,
      true,
    );
  });

  it('writes JSON output when results are found', async () => {
    const mockResults = [
      {
        id: 123,
        title: 'Discovery - Daft Punk',
        type: 'master',
        year: 2001,
        uri: '/master/123',
      },
    ];
    mockSearchDiscogs.mockResolvedValue(mockResults);

    await handleSearch(mockDb, 'Daft Punk', defaultFlags);

    expect(mockWriteJsonOutput).toHaveBeenCalledTimes(1);
    expect(mockWriteJsonOutput).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'search',
        params: {
          query: 'Daft Punk',
          searchType: null,
          per_page: 5,
        },
        result: expect.objectContaining({
          tracks: expect.arrayContaining([
            expect.objectContaining({
              title: 'Discovery - Daft Punk',
              match: expect.objectContaining({
                type: 'master',
                year: 2001,
                id: 123,
              }),
            }),
          ]),
        }),
      }),
    );
  });

  it('does not write JSON output when no results found', async () => {
    mockSearchDiscogs.mockResolvedValue([]);

    await handleSearch(mockDb, 'nonexistent artist xyz123', defaultFlags);

    expect(mockWriteJsonOutput).not.toHaveBeenCalled();
  });

  it('logs warning when no results found', async () => {
    mockSearchDiscogs.mockResolvedValue([]);

    await handleSearch(mockDb, 'nonexistent', defaultFlags);

    expect(mockLog.warn).toHaveBeenCalledWith('No results found :(');
  });

  it('logs success message with result count', async () => {
    const mockResults = [
      { id: 1, title: 'Album 1' },
      { id: 2, title: 'Album 2' },
      { id: 3, title: 'Album 3' },
    ];
    mockSearchDiscogs.mockResolvedValue(mockResults);

    await handleSearch(mockDb, 'test', defaultFlags);

    expect(mockLog.success).toHaveBeenCalledWith('Found 3 result(s):');
  });

  it('displays each result using formatResult', async () => {
    const mockResults = [
      { id: 111, title: 'First Album' },
      { id: 222, title: 'Second Album' },
    ];
    mockSearchDiscogs.mockResolvedValue(mockResults);

    await handleSearch(mockDb, 'test', defaultFlags);

    // formatResult is called for each result and logged
    expect(mockLog.plain).toHaveBeenCalledWith('  111 | First Album');
    expect(mockLog.plain).toHaveBeenCalledWith('  222 | Second Album');
  });
});

describe('searchCommand', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('has correct command metadata', () => {
    expect(searchCommand.name).toBe('search');
    expect(searchCommand.aliases).toContain('s');
    expect(searchCommand.minArgs).toBe(0);
    expect(searchCommand.usage).toBe('search <query>');
  });

  it('shows help when called with no args', async () => {
    const ctx = {
      db: {},
      sessionFlags: { type: null, per_page: 5 },
    };

    const result = await searchCommand.handler([], ctx);

    expect(result).toBe(true);
    expect(mockLog.info).toHaveBeenCalledWith(
      expect.stringContaining('Search Discogs'),
    );
    expect(mockSearchDiscogs).not.toHaveBeenCalled();
  });

  it('calls handleSearch when args provided', async () => {
    mockSearchDiscogs.mockResolvedValue([]);
    const ctx = {
      db: { search: jest.fn() },
      sessionFlags: { type: null, per_page: 5, verbose: false },
    };

    const result = await searchCommand.handler(['Daft', 'Punk'], ctx);

    expect(result).toBe(true);
    expect(mockSearchDiscogs).toHaveBeenCalledWith(
      ctx.db,
      'Daft Punk',
      null,
      5,
      false,
    );
  });

  it('joins multiple args into single query', async () => {
    mockSearchDiscogs.mockResolvedValue([]);
    const ctx = {
      db: {},
      sessionFlags: { type: 'master', per_page: 10, verbose: true },
    };

    await searchCommand.handler(['Boards', 'of', 'Canada'], ctx);

    expect(mockSearchDiscogs).toHaveBeenCalledWith(
      ctx.db,
      'Boards of Canada',
      'master',
      10,
      true,
    );
  });

  it('always returns true to continue REPL', async () => {
    mockSearchDiscogs.mockResolvedValue([]);
    const ctx = {
      db: {},
      sessionFlags: { type: null, per_page: 5, verbose: false },
    };

    const result = await searchCommand.handler(['test'], ctx);

    expect(result).toBe(true);
  });
});

describe('buildSearchOutput (pure function)', () => {
  it('builds correct output structure', () => {
    const results = [
      {
        id: 123,
        title: 'Discovery - Daft Punk',
        type: 'master',
        year: 2001,
        uri: '/master/123',
      },
    ];

    const output = buildSearchOutput('Daft Punk', 'master', 5, results);

    expect(output).toEqual({
      type: 'search',
      params: {
        query: 'Daft Punk',
        searchType: 'master',
        per_page: 5,
      },
      result: {
        tracks: [
          {
            title: 'Discovery - Daft Punk',
            artist: 'Discovery',
            album: '',
            isrc: '',
            match: {
              type: 'master',
              year: 2001,
              url: 'https://www.discogs.com/master/123',
              id: 123,
            },
          },
        ],
      },
    });
  });

  it('handles null type filter', () => {
    const output = buildSearchOutput('query', null, 10, []);

    expect(output.params.searchType).toBeNull();
    expect(output.params.per_page).toBe(10);
  });

  it('handles empty results array', () => {
    const output = buildSearchOutput('test', null, 5, []);

    expect(output.result.tracks).toEqual([]);
  });

  it('extracts artist from title before dash', () => {
    const results = [
      { id: 1, title: 'Bonobo - Black Sands', uri: '/master/1' },
    ];

    const output = buildSearchOutput('test', null, 5, results);

    expect(output.result.tracks[0].artist).toBe('Bonobo');
  });

  it('handles title without dash', () => {
    const results = [{ id: 1, title: 'Single Word Title', uri: '/master/1' }];

    const output = buildSearchOutput('test', null, 5, results);

    expect(output.result.tracks[0].artist).toBe('Single Word Title');
    expect(output.result.tracks[0].title).toBe('Single Word Title');
  });

  it('handles missing title gracefully', () => {
    const results = [{ id: 1, uri: '/master/1' }];

    const output = buildSearchOutput('test', null, 5, results);

    expect(output.result.tracks[0].title).toBe('');
    expect(output.result.tracks[0].artist).toBe('');
  });

  it('handles missing year', () => {
    const results = [
      { id: 1, title: 'Test', type: 'release', uri: '/release/1' },
    ];

    const output = buildSearchOutput('test', null, 5, results);

    expect(output.result.tracks[0].match.year).toBeNull();
  });

  it('handles missing type with default', () => {
    const results = [{ id: 1, title: 'Test', uri: '/unknown/1' }];

    const output = buildSearchOutput('test', null, 5, results);

    expect(output.result.tracks[0].match.type).toBe('unknown');
  });

  it('builds correct URL from URI', () => {
    const results = [{ id: 456, title: 'Test', uri: '/release/456' }];

    const output = buildSearchOutput('test', null, 5, results);

    expect(output.result.tracks[0].match.url).toBe(
      'https://www.discogs.com/release/456',
    );
  });

  it('handles multiple results', () => {
    const results = [
      {
        id: 1,
        title: 'First - Artist',
        type: 'master',
        year: 2020,
        uri: '/master/1',
      },
      {
        id: 2,
        title: 'Second - Artist',
        type: 'release',
        year: 2021,
        uri: '/release/2',
      },
      {
        id: 3,
        title: 'Third - Artist',
        type: 'master',
        year: 2022,
        uri: '/master/3',
      },
    ];

    const output = buildSearchOutput('artist', 'master', 10, results);

    expect(output.result.tracks).toHaveLength(3);
    expect(output.result.tracks[0].match.id).toBe(1);
    expect(output.result.tracks[1].match.id).toBe(2);
    expect(output.result.tracks[2].match.id).toBe(3);
  });
});
