#!/usr/bin/env node
import readline from 'readline';
import meow from 'meow';
import { fileConfig, isVerbose, getPerPage, getDefaultType } from './lib/config.js';
import { initLog, writeLog } from './lib/logger.js';
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
  return `muzak [${mode}]> `;
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
  console.log(`
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
    console.log(`\n┌─ Command ────────────────────────────────────────────────`);
    console.log(`│ Input: ${trimmed}`);
    console.log('└──────────────────────────────────────────────────────────');
  }

  const parts = trimmed.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
  const command = parts[0]?.toLowerCase();
  const args = parts.slice(1).map(arg => arg.replace(/^"|"$/g, '')); // Remove quotes

  switch (command) {
    case 'exit':
    case 'quit':
    case 'q':
      writeLog('Session ended by user');
      console.log('Goodbye!');
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
        console.error('Error: Please provide a search query');
        console.log('Usage: search <query>');
        return true;
      }
      await handleSearch(db, args.join(' '), sessionFlags);
      return true;

    case 'set':
      return handleSet(args);

    default:
      console.error(`Unknown command: ${command}`);
      console.log("Type 'help' for available commands.");
      return true;
  }
}

/**
 * Display current session settings
 */
function showSettings() {
  console.log('\nSession Settings:');
  console.log('───────────────────────────────────');
  console.log(`  type:      ${sessionFlags.type || 'none (all)'}`);
  console.log(`  per_page:  ${sessionFlags.per_page}`);
  console.log(`  verbose:   ${sessionFlags.verbose ? 'on' : 'off'}`);
  console.log();
}

/**
 * Handle 'set' commands for session options
 */
function handleSet(args) {
  const [option, value] = args;

  if (!option) {
    console.log('Current settings:');
    console.log(`  type: ${sessionFlags.type || 'none (all)'}`);
    console.log(`  per_page: ${sessionFlags.per_page}`);
    console.log(`  verbose: ${sessionFlags.verbose ? 'on' : 'off'}`);
    return true;
  }

  switch (option.toLowerCase()) {
    case 'type':
      const typeVal = value?.toLowerCase();
      if (!typeVal || typeVal === 'none' || typeVal === 'all') {
        sessionFlags.type = null;
        console.log('Search type: none (all)');
      } else if (VALID_TYPES.includes(typeVal)) {
        sessionFlags.type = typeVal;
        console.log(`Search type: ${sessionFlags.type}`);
      } else {
        console.error(`Error: invalid type '${value}'`);
        console.log(`Valid types: ${VALID_TYPES.join(', ')}, none`);
      }
      updatePrompt();
      break;

    case 'per_page':
      const num = parseInt(value, 10);
      if (isNaN(num) || num < 1) {
        console.error('Error: per_page must be a positive number');
      } else {
        sessionFlags.per_page = num;
        console.log(`Results per page: ${sessionFlags.per_page}`);
      }
      break;

    case 'verbose':
      sessionFlags.verbose = value?.toLowerCase() === 'on' || value === 'true';
      console.log(`Verbose mode: ${sessionFlags.verbose ? 'on' : 'off'}`);
      break;

    default:
      console.error(`Unknown option: ${option}`);
      console.log('Available options: type, per_page, verbose');
  }

  writeLog(`Settings updated: ${JSON.stringify(sessionFlags)}`);
  return true;
}

/**
 * Start interactive session
 */
async function startSession() {
  // Check if ALWAYS_CLEAN is set in config
  if (fileConfig.ALWAYS_CLEAN) {
    console.log('ALWAYS_CLEAN is enabled, cleaning dist folder and logs...');
    handleClean();
  }

  // Ensure dist folder exists
  ensureDistDir();

  // Initialize log file for this session
  initLog();
  writeLog('Session started');
  writeLog(`Token: ${token ? 'configured' : 'not configured'}`);

  console.log('\n🎵 Muzak CLI - Interactive Session');
  console.log('───────────────────────────────────');
  
  if (!token) {
    console.warn('⚠️  No Discogs token configured. Some features may not work.');
    console.warn('   Set DISCOGS_TOKEN in .mzkconfig or environment.\n');
  } else {
    console.log('✓ Discogs token configured\n');
  }

  if (sessionFlags.verbose) {
    console.log('📢 Verbose mode enabled\n');
  }

  console.log("Type 'help' for available commands, 'exit' to quit.\n");

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
      console.error('Error:', error.message);
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
