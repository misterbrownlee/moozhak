/**
 * Tests for pure functions in command modules
 * No mocks required - these are pure data transformations
 */
import { parseInput, findCommand, getCommandNames } from '../lib/commands/index.js';
import { parseTracksArgs } from '../lib/commands/tracks.js';
import { SETTINGS_SCHEMA } from '../lib/commands/settings.js';

describe('parseInput', () => {
  it('parses simple command with no args', () => {
    const result = parseInput('help');
    expect(result).toEqual({ command: 'help', args: [] });
  });

  it('parses command with single arg', () => {
    const result = parseInput('tracks 12345');
    expect(result).toEqual({ command: 'tracks', args: ['12345'] });
  });

  it('parses command with multiple args', () => {
    const result = parseInput('tracks master 12345');
    expect(result).toEqual({ command: 'tracks', args: ['master', '12345'] });
  });

  it('handles quoted strings as single arg', () => {
    const result = parseInput('search "Daft Punk"');
    expect(result).toEqual({ command: 'search', args: ['Daft Punk'] });
  });

  it('handles mixed quoted and unquoted args', () => {
    const result = parseInput('search "Daft Punk" --type master');
    expect(result).toEqual({ command: 'search', args: ['Daft Punk', '--type', 'master'] });
  });

  it('normalizes command to lowercase', () => {
    const result = parseInput('SEARCH query');
    expect(result).toEqual({ command: 'search', args: ['query'] });
  });

  it('trims whitespace', () => {
    const result = parseInput('  search  query  ');
    expect(result).toEqual({ command: 'search', args: ['query'] });
  });

  it('returns empty command for empty input', () => {
    const result = parseInput('');
    expect(result).toEqual({ command: '', args: [] });
  });

  it('returns empty command for whitespace only', () => {
    const result = parseInput('   ');
    expect(result).toEqual({ command: '', args: [] });
  });

  it('handles multi-word search query without quotes', () => {
    const result = parseInput('search Daft Punk Discovery');
    expect(result).toEqual({ command: 'search', args: ['Daft', 'Punk', 'Discovery'] });
  });

  it('preserves content inside quotes', () => {
    const result = parseInput('search "Artist - Album (2020)"');
    expect(result).toEqual({ command: 'search', args: ['Artist - Album (2020)'] });
  });
});

describe('findCommand', () => {
  it('finds command by exact name', () => {
    const cmd = findCommand('search');
    expect(cmd).not.toBeNull();
    expect(cmd.name).toBe('search');
  });

  it('finds command by alias', () => {
    const cmd = findCommand('s');
    expect(cmd).not.toBeNull();
    expect(cmd.name).toBe('search');
  });

  it('finds tracks command by alias t', () => {
    const cmd = findCommand('t');
    expect(cmd).not.toBeNull();
    expect(cmd.name).toBe('tracks');
  });

  it('finds help command by alias ?', () => {
    const cmd = findCommand('?');
    expect(cmd).not.toBeNull();
    expect(cmd.name).toBe('help');
  });

  it('finds help command by alias h', () => {
    const cmd = findCommand('h');
    expect(cmd).not.toBeNull();
    expect(cmd.name).toBe('help');
  });

  it('finds exit command by alias q', () => {
    const cmd = findCommand('q');
    expect(cmd).not.toBeNull();
    expect(cmd.name).toBe('exit');
  });

  it('finds exit command by alias quit', () => {
    const cmd = findCommand('quit');
    expect(cmd).not.toBeNull();
    expect(cmd.name).toBe('exit');
  });

  it('is case insensitive', () => {
    const cmd = findCommand('SEARCH');
    expect(cmd).not.toBeNull();
    expect(cmd.name).toBe('search');
  });

  it('returns null for unknown command', () => {
    const cmd = findCommand('unknown');
    expect(cmd).toBeNull();
  });

  it('returns null for empty string', () => {
    const cmd = findCommand('');
    expect(cmd).toBeNull();
  });

  it('returns command with handler function', () => {
    const cmd = findCommand('search');
    expect(typeof cmd.handler).toBe('function');
  });

  it('returns command with usage string', () => {
    const cmd = findCommand('tracks');
    expect(cmd.usage).toBe('tracks [type] <id>');
  });
});

describe('getCommandNames', () => {
  it('returns array of command names', () => {
    const names = getCommandNames();
    expect(Array.isArray(names)).toBe(true);
  });

  it('includes all expected commands', () => {
    const names = getCommandNames();
    expect(names).toContain('search');
    expect(names).toContain('tracks');
    expect(names).toContain('settings');
    expect(names).toContain('set');
    expect(names).toContain('clean');
    expect(names).toContain('help');
    expect(names).toContain('exit');
  });

  it('returns 7 commands', () => {
    const names = getCommandNames();
    expect(names.length).toBe(7);
  });
});

describe('parseTracksArgs', () => {
  const defaultType = 'master';

  describe('with no arguments', () => {
    it('returns error when no args provided', () => {
      const result = parseTracksArgs([], defaultType);
      expect(result.error).toBe('Please provide an ID');
      expect(result.hint).toContain('Usage:');
    });
  });

  describe('with single argument (ID only)', () => {
    it('uses default type when only ID provided', () => {
      const result = parseTracksArgs(['12345'], defaultType);
      expect(result).toEqual({ type: 'master', id: '12345' });
    });

    it('uses provided default type', () => {
      const result = parseTracksArgs(['12345'], 'release');
      expect(result).toEqual({ type: 'release', id: '12345' });
    });
  });

  describe('with type and ID', () => {
    it('parses master type with ID', () => {
      const result = parseTracksArgs(['master', '12345'], defaultType);
      expect(result).toEqual({ type: 'master', id: '12345' });
    });

    it('parses release type with ID', () => {
      const result = parseTracksArgs(['release', '67890'], defaultType);
      expect(result).toEqual({ type: 'release', id: '67890' });
    });

    it('normalizes type to lowercase', () => {
      const result = parseTracksArgs(['MASTER', '12345'], defaultType);
      expect(result).toEqual({ type: 'master', id: '12345' });
    });

    it('normalizes mixed case type', () => {
      const result = parseTracksArgs(['Release', '12345'], defaultType);
      expect(result).toEqual({ type: 'release', id: '12345' });
    });
  });

  describe('with invalid type', () => {
    it('returns error for invalid type', () => {
      const result = parseTracksArgs(['artist', '12345'], defaultType);
      expect(result.error).toBe("Invalid type 'artist'");
      expect(result.hint).toBe('Valid types: master, release');
    });

    it('returns error for unknown type', () => {
      const result = parseTracksArgs(['album', '12345'], defaultType);
      expect(result.error).toBe("Invalid type 'album'");
    });
  });

  describe('edge cases', () => {
    it('treats numeric first arg as ID, not type', () => {
      // If first arg looks like a number, treat as ID
      const result = parseTracksArgs(['99999'], defaultType);
      expect(result).toEqual({ type: 'master', id: '99999' });
    });

    it('handles ID with leading zeros', () => {
      const result = parseTracksArgs(['00123'], defaultType);
      expect(result).toEqual({ type: 'master', id: '00123' });
    });
  });
});

describe('SETTINGS_SCHEMA validators', () => {
  describe('type validator', () => {
    const { validate, transform } = SETTINGS_SCHEMA.type;

    it('accepts valid types', () => {
      expect(validate('artist')).toBe(true);
      expect(validate('release')).toBe(true);
      expect(validate('master')).toBe(true);
      expect(validate('label')).toBe(true);
    });

    it('accepts "none" and "all" to clear type', () => {
      expect(validate('none')).toBe(true);
      expect(validate('all')).toBe(true);
    });

    it('accepts empty string', () => {
      expect(validate('')).toBe(true);
    });

    it('rejects invalid types', () => {
      expect(validate('invalid')).toBe(false);
      expect(validate('album')).toBe(false);
    });

    it('transforms "none" to null', () => {
      expect(transform('none')).toBeNull();
    });

    it('transforms "all" to null', () => {
      expect(transform('all')).toBeNull();
    });

    it('transforms empty to null', () => {
      expect(transform('')).toBeNull();
    });

    it('transforms valid type to lowercase', () => {
      expect(transform('MASTER')).toBe('master');
    });
  });

  describe('per_page validator', () => {
    const { validate, transform } = SETTINGS_SCHEMA.per_page;

    it('accepts positive integers', () => {
      expect(validate('1')).toBe(true);
      expect(validate('10')).toBe(true);
      expect(validate('100')).toBe(true);
    });

    it('rejects zero', () => {
      expect(validate('0')).toBe(false);
    });

    it('rejects negative numbers', () => {
      expect(validate('-5')).toBe(false);
    });

    it('rejects non-numeric strings', () => {
      expect(validate('abc')).toBe(false);
    });

    it('transforms string to integer', () => {
      expect(transform('10')).toBe(10);
    });
  });

  describe('tracks_type validator', () => {
    const { validate, transform } = SETTINGS_SCHEMA.tracks_type;

    it('accepts master', () => {
      expect(validate('master')).toBe(true);
    });

    it('accepts release', () => {
      expect(validate('release')).toBe(true);
    });

    it('rejects invalid types', () => {
      expect(validate('artist')).toBe(false);
      expect(validate('label')).toBe(false);
    });

    it('transforms to lowercase', () => {
      expect(transform('MASTER')).toBe('master');
    });
  });

  describe('tracks_output validator', () => {
    const { validate, transform } = SETTINGS_SCHEMA.tracks_output;

    it('accepts all valid formats', () => {
      expect(validate('human')).toBe(true);
      expect(validate('csv')).toBe(true);
      expect(validate('pipe')).toBe(true);
      expect(validate('markdown')).toBe(true);
    });

    it('rejects invalid formats', () => {
      expect(validate('json')).toBe(false);
      expect(validate('xml')).toBe(false);
    });

    it('transforms to lowercase', () => {
      expect(transform('CSV')).toBe('csv');
    });
  });

  describe('verbose validator', () => {
    const { validate, transform } = SETTINGS_SCHEMA.verbose;

    it('always validates (accepts any input)', () => {
      expect(validate('anything')).toBe(true);
    });

    it('transforms "on" to true', () => {
      expect(transform('on')).toBe(true);
    });

    it('transforms "true" to true', () => {
      expect(transform('true')).toBe(true);
    });

    it('transforms boolean true to true', () => {
      expect(transform(true)).toBe(true);
    });

    it('transforms "off" to false', () => {
      expect(transform('off')).toBe(false);
    });

    it('transforms other values to false', () => {
      expect(transform('false')).toBe(false);
      expect(transform('yes')).toBe(false);
    });
  });
});

