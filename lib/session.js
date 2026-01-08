import { input } from '@inquirer/prompts';
import { handleClean } from './commands/clean.js';
import { executeCommand } from './commands/index.js';
import {
  fileConfig,
  getDefaultTracksOutput,
  getDefaultTracksType,
  getDefaultType,
  getPerPage,
  isVerbose,
} from './config.js';
import { initLog, log, writeLog } from './logger.js';
import { ensureDistDir } from './output.js';
import { createClient } from './services/discogs.js';

/**
 * Session state - initialized from config
 */
function createSessionFlags() {
  return {
    type: getDefaultType(),
    per_page: getPerPage(),
    verbose: isVerbose(),
    tracks_type: getDefaultTracksType(),
    tracks_output: getDefaultTracksOutput(),
  };
}

/**
 * Start interactive REPL session
 * @param {Object} options - CLI options from Commander
 */
export async function startSession(options = {}) {
  const sessionFlags = createSessionFlags();

  // Create Discogs client
  const { db, token } = createClient(options.token);

  log.divider(true);
  log.header('Moozhak CLI - Interactive Session\n');

  // Check if ALWAYS_CLEAN is set in config
  if (fileConfig.ALWAYS_CLEAN && fileConfig.ALWAYS_CLEAN === true) {
    log.info('ALWAYS_CLEAN is enabled, cleaning dist folder and logs...');
    handleClean();
  }

  // Initialize logging and output directories
  ensureDistDir();
  initLog();

  writeLog('Session started');
  writeLog(`Token: ${token ? 'configured' : 'not configured'}`);

  if (!token) {
    log.warn('No Discogs token configured. Some features may not work.');
    log.warn('Set DISCOGS_TOKEN in .mzkconfig or environment.\n');
  } else {
    log.success('Discogs token configured');
  }

  if (sessionFlags.verbose) {
    log.success('Verbose mode enabled\n');
  }

  log.plain('\n');
  log.info("Type 'help' for available commands, 'exit' to quit.");
  log.divider(true);

  // Context object passed to command handlers
  const ctx = {
    db,
    sessionFlags,
    updatePrompt: () => {}, // No-op for now, prompt is regenerated each iteration
  };

  // REPL loop
  while (true) {
    try {
      const command = await input({
        message: `↳`,
        theme: {
          prefix: '',
          style: {
            message: (text) => text,
          },
        },
      });

      const shouldContinue = await executeCommand(command, ctx);

      if (!shouldContinue) {
        break;
      }
    } catch (error) {
      // Handle Ctrl+C gracefully
      if (error.name === 'ExitPromptError') {
        writeLog('Session ended by user (Ctrl+C)');
        log.plain('');
        log.success('Goodbye!');
        break;
      }

      // Log and display other errors
      log.error('uh oh');
      log.error(error.message);
      writeLog(`Error: ${error.message}`);
    }
  }

  process.exit(0);
}

/**
 * Run a single search command (non-interactive)
 * @param {string} query - Search query
 * @param {Object} options - Command options
 */
export async function runSearch(query, options = {}) {
  const { db } = createClient(options.token);
  const { handleSearch } = await import('./commands/search.js');

  const flags = {
    type: options.type || null,
    per_page: parseInt(options.limit, 10) || 5,
    verbose: options.verbose || false,
  };

  ensureDistDir();
  initLog();

  await handleSearch(db, query, flags);
}

/**
 * Run a single tracks command (non-interactive)
 * @param {string} id - Master or release ID
 * @param {Object} options - Command options
 */
export async function runTracks(id, options = {}) {
  const { db } = createClient(options.token);
  const { handleTracks } = await import('./commands/tracks.js');

  const type = options.type || 'master';
  const flags = {
    tracks_type: type,
    tracks_output: options.format || 'human',
    verbose: options.verbose || false,
  };

  ensureDistDir();
  initLog();

  await handleTracks(db, type, id, flags);
}

export { createSessionFlags };
