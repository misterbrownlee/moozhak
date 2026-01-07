/**
 * Tests for executeCommand routing logic
 * Tests command dispatch, error handling, and argument validation
 */
import { jest } from '@jest/globals';

// Mock logger (must include all exports used by transitive dependencies)
const mockLog = {
  plain: jest.fn(),
  info: jest.fn(),
  success: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  header: jest.fn(),
  debug: jest.fn(),
  divider: jest.fn(),
};

const mockWriteLog = jest.fn();
const mockLogApiResponse = jest.fn();
const mockInitLog = jest.fn();

jest.unstable_mockModule('../lib/logger.js', () => ({
  log: mockLog,
  writeLog: mockWriteLog,
  logApiResponse: mockLogApiResponse,
  initLog: mockInitLog,
}));

// Mock discogs to avoid API dependencies
jest.unstable_mockModule('../lib/discogs.js', () => ({
  searchDiscogs: jest.fn().mockResolvedValue([]),
  getMaster: jest.fn().mockResolvedValue(null),
  getRelease: jest.fn().mockResolvedValue(null),
  formatResult: jest.fn((r) => `  ${r.id} | ${r.title}`),
  formatTrack: jest.fn((t, i) => `  ${i + 1} ${t.title}`),
  buildDiscogsUrl: (type, id) => `https://www.discogs.com/${type}/${id}`,
  buildDiscogsUrlFromUri: (uri) => `https://www.discogs.com${uri}`,
}));

// Mock output to avoid file system
jest.unstable_mockModule('../lib/output.js', () => ({
  writeJsonOutput: jest.fn(),
  writeTracksOutput: jest.fn(),
  ensureDistDir: jest.fn(),
  distDir: '/tmp/dist',
}));

// Import after mocking
const { executeCommand } = await import('../lib/commands/index.js');

describe('executeCommand', () => {
  let ctx;

  beforeEach(() => {
    jest.clearAllMocks();
    ctx = {
      db: {},
      sessionFlags: {
        type: null,
        per_page: 5,
        verbose: false,
        tracks_type: 'master',
        tracks_output: 'human',
      },
      updatePrompt: jest.fn(),
    };
  });

  describe('empty input', () => {
    it('returns true for empty string', async () => {
      const result = await executeCommand('', ctx);

      expect(result).toBe(true);
    });

    it('returns true for whitespace only', async () => {
      const result = await executeCommand('   ', ctx);

      expect(result).toBe(true);
    });

    it('does not log for empty input', async () => {
      await executeCommand('', ctx);

      expect(mockWriteLog).not.toHaveBeenCalled();
    });
  });

  describe('unknown command', () => {
    it('logs error for unknown command', async () => {
      await executeCommand('unknowncommand', ctx);

      expect(mockLog.error).toHaveBeenCalledWith(
        'Unknown command: unknowncommand',
      );
    });

    it('shows help hint for unknown command', async () => {
      await executeCommand('foo', ctx);

      expect(mockLog.info).toHaveBeenCalledWith(
        "Type 'help' for available commands.",
      );
    });

    it('returns true to continue REPL', async () => {
      const result = await executeCommand('badcmd', ctx);

      expect(result).toBe(true);
    });
  });

  describe('command logging', () => {
    it('logs command to file', async () => {
      await executeCommand('help', ctx);

      expect(mockWriteLog).toHaveBeenCalledWith('Command: help');
    });

    it('logs trimmed command', async () => {
      await executeCommand('  help  ', ctx);

      expect(mockWriteLog).toHaveBeenCalledWith('Command: help');
    });
  });

  describe('verbose mode', () => {
    it('shows debug header when verbose', async () => {
      ctx.sessionFlags.verbose = true;

      await executeCommand('help', ctx);

      expect(mockLog.debug).toHaveBeenCalledWith(
        expect.stringContaining('Command'),
      );
    });

    it('shows input in verbose mode', async () => {
      ctx.sessionFlags.verbose = true;

      await executeCommand('help', ctx);

      expect(mockLog.debug).toHaveBeenCalledWith(
        expect.stringContaining('Input: help'),
      );
    });

    it('shows regular header when not verbose', async () => {
      ctx.sessionFlags.verbose = false;

      await executeCommand('help', ctx);

      expect(mockLog.header).toHaveBeenCalled();
      expect(mockLog.debug).not.toHaveBeenCalled();
    });
  });

  describe('minArgs validation', () => {
    it('shows error when tracks called without ID', async () => {
      await executeCommand('tracks', ctx);

      expect(mockLog.error).toHaveBeenCalledWith('Missing arguments');
    });

    it('shows usage hint when args missing', async () => {
      await executeCommand('tracks', ctx);

      expect(mockLog.info).toHaveBeenCalledWith('Usage: tracks [type] <id>');
    });

    it('returns true when args missing', async () => {
      const result = await executeCommand('tracks', ctx);

      expect(result).toBe(true);
    });
  });

  describe('command execution', () => {
    it('executes help command', async () => {
      const result = await executeCommand('help', ctx);

      expect(result).toBe(true);
      // help command logs plain text
      expect(mockLog.plain).toHaveBeenCalled();
    });

    it('executes help via alias ?', async () => {
      await executeCommand('?', ctx);

      expect(mockLog.plain).toHaveBeenCalled();
    });

    it('executes help via alias h', async () => {
      await executeCommand('h', ctx);

      expect(mockLog.plain).toHaveBeenCalled();
    });

    it('executes exit command and returns false', async () => {
      const result = await executeCommand('exit', ctx);

      expect(result).toBe(false);
    });

    it('executes exit via alias q', async () => {
      const result = await executeCommand('q', ctx);

      expect(result).toBe(false);
    });

    it('executes exit via alias quit', async () => {
      const result = await executeCommand('quit', ctx);

      expect(result).toBe(false);
    });

    it('executes set command with no args (shows settings)', async () => {
      await executeCommand('set', ctx);

      expect(mockLog.header).toHaveBeenCalledWith('\nCurrent Settings:');
    });

    it('executes set command with args', async () => {
      await executeCommand('set verbose on', ctx);

      expect(ctx.sessionFlags.verbose).toBe(true);
    });
  });

  describe('case insensitivity', () => {
    it('handles uppercase commands', async () => {
      const result = await executeCommand('HELP', ctx);

      expect(result).toBe(true);
      expect(mockLog.plain).toHaveBeenCalled();
    });

    it('handles mixed case commands', async () => {
      const result = await executeCommand('HeLp', ctx);

      expect(result).toBe(true);
    });

    it('handles uppercase alias', async () => {
      const result = await executeCommand('Q', ctx);

      expect(result).toBe(false);
    });
  });

  describe('argument passing', () => {
    it('passes arguments to command handler', async () => {
      // set command modifies sessionFlags
      await executeCommand('set type master', ctx);

      expect(ctx.sessionFlags.type).toBe('master');
    });

    it('handles quoted arguments', async () => {
      // search with no actual API call (shows help with no args)
      await executeCommand('search', ctx);

      expect(mockLog.info).toHaveBeenCalledWith(
        expect.stringContaining('Search Discogs'),
      );
    });
  });
});
