/**
 * Tests for config.js getter functions
 * No mocks required - tests validation/parsing logic via exported fileConfig object
 */
import {
  fileConfig,
  getPerPage,
  getDefaultType,
  getDefaultTracksType,
  getDefaultTracksOutput,
} from '../lib/config.js';

// Helper to save and restore fileConfig state between tests
const originalConfig = { ...fileConfig };

afterEach(() => {
  // Restore original config after each test
  Object.keys(fileConfig).forEach((key) => delete fileConfig[key]);
  Object.assign(fileConfig, originalConfig);
});

describe('getPerPage', () => {
  beforeEach(() => {
    delete fileConfig.PER_PAGE;
  });

  it('returns 5 as default when PER_PAGE is not set', () => {
    expect(getPerPage()).toBe(5);
  });

  it('parses valid integer string', () => {
    fileConfig.PER_PAGE = '10';
    expect(getPerPage()).toBe(10);
  });

  it('parses single digit', () => {
    fileConfig.PER_PAGE = '1';
    expect(getPerPage()).toBe(1);
  });

  it('returns 5 for non-numeric string', () => {
    fileConfig.PER_PAGE = 'abc';
    expect(getPerPage()).toBe(5);
  });

  it('returns 5 for zero', () => {
    fileConfig.PER_PAGE = '0';
    expect(getPerPage()).toBe(5);
  });

  it('returns 5 for negative numbers', () => {
    fileConfig.PER_PAGE = '-5';
    expect(getPerPage()).toBe(5);
  });

  it('returns 5 for empty string', () => {
    fileConfig.PER_PAGE = '';
    expect(getPerPage()).toBe(5);
  });

  it('parses integer from string with trailing text', () => {
    fileConfig.PER_PAGE = '15abc';
    expect(getPerPage()).toBe(15);
  });

  it('handles large numbers', () => {
    fileConfig.PER_PAGE = '100';
    expect(getPerPage()).toBe(100);
  });
});

describe('getDefaultType', () => {
  beforeEach(() => {
    delete fileConfig.DEFAULT_TYPE;
  });

  it('returns null when DEFAULT_TYPE is not set', () => {
    expect(getDefaultType()).toBeNull();
  });

  it('accepts "artist" type', () => {
    fileConfig.DEFAULT_TYPE = 'artist';
    expect(getDefaultType()).toBe('artist');
  });

  it('accepts "release" type', () => {
    fileConfig.DEFAULT_TYPE = 'release';
    expect(getDefaultType()).toBe('release');
  });

  it('accepts "master" type', () => {
    fileConfig.DEFAULT_TYPE = 'master';
    expect(getDefaultType()).toBe('master');
  });

  it('accepts "label" type', () => {
    fileConfig.DEFAULT_TYPE = 'label';
    expect(getDefaultType()).toBe('label');
  });

  it('normalizes uppercase to lowercase', () => {
    fileConfig.DEFAULT_TYPE = 'ARTIST';
    expect(getDefaultType()).toBe('artist');
  });

  it('normalizes mixed case to lowercase', () => {
    fileConfig.DEFAULT_TYPE = 'MaStEr';
    expect(getDefaultType()).toBe('master');
  });

  it('returns null for invalid type', () => {
    fileConfig.DEFAULT_TYPE = 'invalid';
    expect(getDefaultType()).toBeNull();
  });

  it('returns null for empty string', () => {
    fileConfig.DEFAULT_TYPE = '';
    expect(getDefaultType()).toBeNull();
  });

  it('returns null for partial match', () => {
    fileConfig.DEFAULT_TYPE = 'art';
    expect(getDefaultType()).toBeNull();
  });
});

describe('getDefaultTracksType', () => {
  beforeEach(() => {
    delete fileConfig.DEFAULT_TRACKS_TYPE;
  });

  it('returns "master" as default when not set', () => {
    expect(getDefaultTracksType()).toBe('master');
  });

  it('accepts "master" type', () => {
    fileConfig.DEFAULT_TRACKS_TYPE = 'master';
    expect(getDefaultTracksType()).toBe('master');
  });

  it('accepts "release" type', () => {
    fileConfig.DEFAULT_TRACKS_TYPE = 'release';
    expect(getDefaultTracksType()).toBe('release');
  });

  it('normalizes uppercase to lowercase', () => {
    fileConfig.DEFAULT_TRACKS_TYPE = 'RELEASE';
    expect(getDefaultTracksType()).toBe('release');
  });

  it('normalizes mixed case to lowercase', () => {
    fileConfig.DEFAULT_TRACKS_TYPE = 'MaStEr';
    expect(getDefaultTracksType()).toBe('master');
  });

  it('returns "master" for invalid type', () => {
    fileConfig.DEFAULT_TRACKS_TYPE = 'invalid';
    expect(getDefaultTracksType()).toBe('master');
  });

  it('returns "master" for empty string', () => {
    fileConfig.DEFAULT_TRACKS_TYPE = '';
    expect(getDefaultTracksType()).toBe('master');
  });

  it('returns "master" for artist (not valid tracks type)', () => {
    fileConfig.DEFAULT_TRACKS_TYPE = 'artist';
    expect(getDefaultTracksType()).toBe('master');
  });
});

describe('getDefaultTracksOutput', () => {
  beforeEach(() => {
    delete fileConfig.DEFAULT_TRACKS_OUTPUT;
  });

  it('returns "human" as default when not set', () => {
    expect(getDefaultTracksOutput()).toBe('human');
  });

  it('accepts "human" format', () => {
    fileConfig.DEFAULT_TRACKS_OUTPUT = 'human';
    expect(getDefaultTracksOutput()).toBe('human');
  });

  it('accepts "csv" format', () => {
    fileConfig.DEFAULT_TRACKS_OUTPUT = 'csv';
    expect(getDefaultTracksOutput()).toBe('csv');
  });

  it('accepts "pipe" format', () => {
    fileConfig.DEFAULT_TRACKS_OUTPUT = 'pipe';
    expect(getDefaultTracksOutput()).toBe('pipe');
  });

  it('accepts "markdown" format', () => {
    fileConfig.DEFAULT_TRACKS_OUTPUT = 'markdown';
    expect(getDefaultTracksOutput()).toBe('markdown');
  });

  it('normalizes uppercase to lowercase', () => {
    fileConfig.DEFAULT_TRACKS_OUTPUT = 'CSV';
    expect(getDefaultTracksOutput()).toBe('csv');
  });

  it('normalizes mixed case to lowercase', () => {
    fileConfig.DEFAULT_TRACKS_OUTPUT = 'MarkDown';
    expect(getDefaultTracksOutput()).toBe('markdown');
  });

  it('returns "human" for invalid format', () => {
    fileConfig.DEFAULT_TRACKS_OUTPUT = 'json';
    expect(getDefaultTracksOutput()).toBe('human');
  });

  it('returns "human" for empty string', () => {
    fileConfig.DEFAULT_TRACKS_OUTPUT = '';
    expect(getDefaultTracksOutput()).toBe('human');
  });

  it('returns "human" for partial match', () => {
    fileConfig.DEFAULT_TRACKS_OUTPUT = 'hum';
    expect(getDefaultTracksOutput()).toBe('human');
  });
});

