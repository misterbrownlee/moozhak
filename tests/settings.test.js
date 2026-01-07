/**
 * Tests for settings command handlers
 * Tests handleSet and showSettings with mocked logging
 */
import { jest } from '@jest/globals';

// Mock logger
const mockLog = {
  plain: jest.fn(),
  info: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  header: jest.fn(),
};

const mockWriteLog = jest.fn();

jest.unstable_mockModule('../lib/logger.js', () => ({
  log: mockLog,
  writeLog: mockWriteLog,
}));

// Import after mocking
const { handleSet, showSettings } = await import('../lib/commands/settings.js');

describe('handleSet', () => {
  let sessionFlags;
  let mockUpdatePrompt;

  beforeEach(() => {
    jest.clearAllMocks();
    sessionFlags = {
      type: null,
      per_page: 5,
      tracks_type: 'master',
      tracks_output: 'human',
      verbose: false,
    };
    mockUpdatePrompt = jest.fn();
  });

  describe('with no arguments', () => {
    it('shows current settings when no args provided', () => {
      handleSet([], sessionFlags, mockUpdatePrompt);

      expect(mockLog.header).toHaveBeenCalledWith('\nCurrent Settings:');
      expect(mockLog.plain).toHaveBeenCalled();
    });
  });

  describe('type setting', () => {
    it('sets type to artist', () => {
      handleSet(['type', 'artist'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.type).toBe('artist');
      expect(mockLog.success).toHaveBeenCalled();
    });

    it('sets type to master', () => {
      handleSet(['type', 'master'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.type).toBe('master');
    });

    it('sets type to release', () => {
      handleSet(['type', 'release'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.type).toBe('release');
    });

    it('sets type to label', () => {
      handleSet(['type', 'label'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.type).toBe('label');
    });

    it('clears type with "none"', () => {
      sessionFlags.type = 'master';
      handleSet(['type', 'none'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.type).toBeNull();
    });

    it('clears type with "all"', () => {
      sessionFlags.type = 'master';
      handleSet(['type', 'all'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.type).toBeNull();
    });

    it('rejects invalid type', () => {
      handleSet(['type', 'invalid'], sessionFlags, mockUpdatePrompt);

      expect(mockLog.error).toHaveBeenCalledWith("Invalid value 'invalid'");
      expect(sessionFlags.type).toBeNull(); // Unchanged
    });

    it('calls updatePrompt when type changes', () => {
      handleSet(['type', 'master'], sessionFlags, mockUpdatePrompt);

      expect(mockUpdatePrompt).toHaveBeenCalled();
    });

    it('normalizes type to lowercase', () => {
      handleSet(['type', 'MASTER'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.type).toBe('master');
    });
  });

  describe('per_page setting', () => {
    it('sets per_page to valid number', () => {
      handleSet(['per_page', '10'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.per_page).toBe(10);
      expect(mockLog.success).toHaveBeenCalled();
    });

    it('sets per_page to 1', () => {
      handleSet(['per_page', '1'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.per_page).toBe(1);
    });

    it('sets per_page to large number', () => {
      handleSet(['per_page', '100'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.per_page).toBe(100);
    });

    it('rejects zero', () => {
      handleSet(['per_page', '0'], sessionFlags, mockUpdatePrompt);

      expect(mockLog.error).toHaveBeenCalledWith("Invalid value '0'");
      expect(sessionFlags.per_page).toBe(5); // Unchanged
    });

    it('rejects negative numbers', () => {
      handleSet(['per_page', '-5'], sessionFlags, mockUpdatePrompt);

      expect(mockLog.error).toHaveBeenCalled();
      expect(sessionFlags.per_page).toBe(5);
    });

    it('rejects non-numeric strings', () => {
      handleSet(['per_page', 'abc'], sessionFlags, mockUpdatePrompt);

      expect(mockLog.error).toHaveBeenCalled();
      expect(sessionFlags.per_page).toBe(5);
    });
  });

  describe('tracks_type setting', () => {
    it('sets tracks_type to master', () => {
      sessionFlags.tracks_type = 'release';
      handleSet(['tracks_type', 'master'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.tracks_type).toBe('master');
    });

    it('sets tracks_type to release', () => {
      handleSet(['tracks_type', 'release'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.tracks_type).toBe('release');
    });

    it('rejects invalid tracks_type', () => {
      handleSet(['tracks_type', 'artist'], sessionFlags, mockUpdatePrompt);

      expect(mockLog.error).toHaveBeenCalled();
      expect(sessionFlags.tracks_type).toBe('master');
    });

    it('normalizes to lowercase', () => {
      handleSet(['tracks_type', 'RELEASE'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.tracks_type).toBe('release');
    });
  });

  describe('tracks_output setting', () => {
    it('sets tracks_output to human', () => {
      sessionFlags.tracks_output = 'csv';
      handleSet(['tracks_output', 'human'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.tracks_output).toBe('human');
    });

    it('sets tracks_output to csv', () => {
      handleSet(['tracks_output', 'csv'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.tracks_output).toBe('csv');
    });

    it('sets tracks_output to pipe', () => {
      handleSet(['tracks_output', 'pipe'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.tracks_output).toBe('pipe');
    });

    it('sets tracks_output to markdown', () => {
      handleSet(['tracks_output', 'markdown'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.tracks_output).toBe('markdown');
    });

    it('rejects invalid format', () => {
      handleSet(['tracks_output', 'json'], sessionFlags, mockUpdatePrompt);

      expect(mockLog.error).toHaveBeenCalled();
      expect(sessionFlags.tracks_output).toBe('human');
    });
  });

  describe('verbose setting', () => {
    it('sets verbose to on', () => {
      handleSet(['verbose', 'on'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.verbose).toBe(true);
    });

    it('sets verbose to off', () => {
      sessionFlags.verbose = true;
      handleSet(['verbose', 'off'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.verbose).toBe(false);
    });

    it('sets verbose with "true"', () => {
      handleSet(['verbose', 'true'], sessionFlags, mockUpdatePrompt);

      expect(sessionFlags.verbose).toBe(true);
    });
  });

  describe('error cases', () => {
    it('shows error for unknown option', () => {
      handleSet(['unknown', 'value'], sessionFlags, mockUpdatePrompt);

      expect(mockLog.error).toHaveBeenCalledWith('Unknown option: unknown');
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringContaining('Available options:'),
      );
    });

    it('shows error when value is missing', () => {
      handleSet(['type'], sessionFlags, mockUpdatePrompt);

      expect(mockLog.error).toHaveBeenCalledWith('Missing value for type');
      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringContaining('Current:'),
      );
    });

    it('shows available options when value missing for choice-based setting', () => {
      handleSet(['type'], sessionFlags, mockUpdatePrompt);

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringContaining('Options:'),
      );
    });
  });

  describe('logging', () => {
    it('writes to log file after successful change', () => {
      handleSet(['type', 'master'], sessionFlags, mockUpdatePrompt);

      expect(mockWriteLog).toHaveBeenCalledWith(
        expect.stringContaining('Settings updated:'),
      );
    });

    it('does not write to log on error', () => {
      handleSet(['type', 'invalid'], sessionFlags, mockUpdatePrompt);

      expect(mockWriteLog).not.toHaveBeenCalled();
    });
  });
});

describe('showSettings', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('displays header', () => {
    const sessionFlags = {
      type: null,
      per_page: 5,
      tracks_type: 'master',
      tracks_output: 'human',
      verbose: false,
    };

    showSettings(sessionFlags);

    expect(mockLog.header).toHaveBeenCalledWith('\nCurrent Settings:');
  });

  it('displays all settings', () => {
    const sessionFlags = {
      type: 'master',
      per_page: 10,
      tracks_type: 'release',
      tracks_output: 'csv',
      verbose: true,
    };

    showSettings(sessionFlags);

    // Check that plain was called for each setting (plus one empty line)
    const plainCalls = mockLog.plain.mock.calls.map((call) => call[0]);

    expect(
      plainCalls.some((c) => c.includes('Search Type') && c.includes('master')),
    ).toBe(true);
    expect(
      plainCalls.some(
        (c) => c.includes('Results Per Page') && c.includes('10'),
      ),
    ).toBe(true);
    expect(
      plainCalls.some(
        (c) => c.includes('Default Tracks Type') && c.includes('release'),
      ),
    ).toBe(true);
    expect(
      plainCalls.some(
        (c) => c.includes('Tracks Output Format') && c.includes('csv'),
      ),
    ).toBe(true);
    expect(
      plainCalls.some((c) => c.includes('Verbose Mode') && c.includes('on')),
    ).toBe(true);
  });

  it('displays "none (all)" for null type', () => {
    const sessionFlags = {
      type: null,
      per_page: 5,
      tracks_type: 'master',
      tracks_output: 'human',
      verbose: false,
    };

    showSettings(sessionFlags);

    const plainCalls = mockLog.plain.mock.calls.map((call) => call[0]);
    expect(plainCalls.some((c) => c.includes('none (all)'))).toBe(true);
  });

  it('displays "off" for verbose false', () => {
    const sessionFlags = {
      type: null,
      per_page: 5,
      tracks_type: 'master',
      tracks_output: 'human',
      verbose: false,
    };

    showSettings(sessionFlags);

    const plainCalls = mockLog.plain.mock.calls.map((call) => call[0]);
    expect(
      plainCalls.some((c) => c.includes('Verbose Mode') && c.includes('off')),
    ).toBe(true);
  });
});
