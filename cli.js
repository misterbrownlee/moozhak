#!/usr/bin/env node
import readline from 'readline';
import meow from 'meow';
import ansis from 'ansis';
import { fileConfig, isVerbose, getPerPage, getDefaultType } from './lib/config.js';
import { initLog, writeLog, log } from './lib/logger.js';
import { ensureDistDir } from './lib/output.js';
import { createClient } from './lib/discogs.js';
import { handleSearch } from './lib/commands/search.js';
import { handleClean } from './lib/commands/clean.js';

const cli = meow(`

  Usage
    $ muzak [options]

  Options
    --token, -t        Discogs personal access token (or set DISCOGS_TOKEN env var)

  Starts an interactive session. Type 'help' for available commands.

`, {
  importMeta: import.meta,
  flags: {
    token: {
      type: 'string',
      shortFlag: 't'
    }
  }
});

// Valid search types
const VALID_TYPES = ['artist', 'release', 'master', 'label'];

// Session state
let sessionFlags = {
  type: getDefaultType(), // Initialize from config (default: null)
  per_page: getPerPage(), // Initialize from config (default: 5)
  verbose: isVerbose() // Initialize from config
};

// Create Discogs client
const { db, token } = createClient(cli.flags.token);

// Readline interface (set in startSession)
let mzk = null;

/**
 * Get the current prompt string
 */
function getPrompt() {
  const mode = sessionFlags.type || 'all';
  return `↳ moozhak [search-type: ${mode}] > `;
}

/**
 * Update the prompt to reflect current settings
 */
function updatePrompt() {
  if (mzk) {
    mzk.setPrompt(getPrompt());
  }
}

/**
 * Display help for session commands
 */
function showSessionHelp() {
  log.plain(`
  Available Commands:
    search <query>       Search Discogs for a release or artist
    settings             Show current session settings
    clean                Delete all files in the dist folder
    help                 Show this help message
    exit                 Exit the session

  Search Options (set before search):
    set type <t>         Filter by type: artist, release, master, label, none
    set per_page <n>     Set results per page (default: 5)
    set verbose <on|off> Echo commands and HTTP responses

  Examples:
    search Daft Punk
    set type master
    search Bonobo
    set per_page 10
    search "Pretty Lights"
`);
}

/**
 * Parse and execute a session command
 * @param {string} input - User input
 * @returns {Promise<boolean>} - true to continue, false to exit
 */
async function executeCommand(input) {
  const trimmed = input.trim();
  if (!trimmed) return true;

  // Log the command
  writeLog(`Command: ${trimmed}`);

  // Verbose command echo
  if (sessionFlags.verbose) {
    log.debug(`\n┌─ Command ────────────────────────────────────────────────`);
    log.debug(`│ Input: ${trimmed}`);
    log.debug('└──────────────────────────────────────────────────────────');
  }

  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const command = parts[0]?.toLowerCase();
  const args = parts.slice(1).map(arg => arg.replace(/^"|"$/g, '')); // Remove quotes

  switch (command) {
    case 'exit':
    case 'quit':
    case 'q':
      writeLog('Session ended by user');
      log.success('\nGoodbye!');
      return false;

    case 'help':
    case '?':
      showSessionHelp();
      return true;

    case 'clean':
      handleClean();
      return true;

    case 'settings':
      showSettings();
      return true;

    case 'search':
      if (args.length === 0) {
        log.error('Please provide a search query');
        log.info('Usage: search <query>');
        return true;
      }
      await handleSearch(db, args.join(' '), sessionFlags);
      return true;

    case 'set':
      return handleSet(args);

    default:
      log.error(`Unknown command: ${command}`);
      log.info("Type 'help' for available commands.");
      return true;
  }
}

/**
 * Display current session settings
 */
function showSettings() {
  log.header('\nSession Settings:');
  log.plain('───────────────────────────────────');
  log.plain(`  type:      ${sessionFlags.type || 'none (all)'}`);
  log.plain(`  per_page:  ${sessionFlags.per_page}`);
  log.plain(`  verbose:   ${sessionFlags.verbose ? 'on' : 'off'}`);
  log.plain('');
}

/**
 * Handle 'set' commands for session options
 */
function handleSet(args) {
  const [option, value] = args;

  if (!option) {
    log.header('Current settings:');
    log.plain(`  type: ${sessionFlags.type || 'none (all)'}`);
    log.plain(`  per_page: ${sessionFlags.per_page}`);
    log.plain(`  verbose: ${sessionFlags.verbose ? 'on' : 'off'}`);
    return true;
  }

  switch (option.toLowerCase()) {
    case 'type':
      const typeVal = value?.toLowerCase();
      if (!typeVal || typeVal === 'none' || typeVal === 'all') {
        sessionFlags.type = null;
        log.success('Search type: none (all)');
      } else if (VALID_TYPES.includes(typeVal)) {
        sessionFlags.type = typeVal;
        log.success(`Search type: ${sessionFlags.type}`);
      } else {
        log.error(`Invalid type '${value}'`);
        log.info(`Valid types: ${VALID_TYPES.join(', ')}, none`);
      }
      updatePrompt();
      break;

    case 'per_page':
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        log.error('per_page must be a positive number');
      } else {
        sessionFlags.per_page = num;
        log.success(`Results per page: ${sessionFlags.per_page}`);
      }
      break;

    case 'verbose':
      sessionFlags.verbose = value?.toLowerCase() === 'on' || value === 'true';
      log.success(`Verbose mode: ${sessionFlags.verbose ? 'on' : 'off'}`);
      break;

    default:
      log.error(`Unknown option: ${option}`);
      log.info('Available options: type, per_page, verbose');
  }

  writeLog(`Settings updated: ${JSON.stringify(sessionFlags)}`);
  return true;
}

/**
 * Start interactive session
 */
async function startSession() {

  log.divider(true);
  log.header('Moohack CLI - Interactive Session\n');


  // Check if ALWAYS_CLEAN is set in config
  if (fileConfig.ALWAYS_CLEAN) {
    log.info('ALWAYS_CLEAN is enabled, cleaning dist folder and logs...');
    handleClean();
  }

  // Initialize log file for this session
  // Ensure dist folder exists
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

  log.info("Type 'help' for available commands, 'exit' to quit.\n");

  log.divider(true);

  mzk = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: getPrompt()
  });

  mzk.prompt();

  mzk.on('line', async (line) => {
    try {
      const shouldContinue = await executeCommand(line);
      if (!shouldContinue) {
        mzk.close();
        return;
      }
    } catch (error) {
      log.error(error.message);
      writeLog(`Error: ${error.message}`);
    }
    mzk.prompt();
  });

  mzk.on('close', () => {
    process.exit(0);
  });
}

// Start the session
startSession();
