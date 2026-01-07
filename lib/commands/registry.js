import { handleSearch } from './search.js';
import { handleTracks } from './tracks.js';
import { handleClean } from './clean.js';
import { handleSettings, handleSet } from './settings.js';
import { showHelp } from './help.js';
import { log, writeLog } from '../logger.js';

/**
 * Parse tracks command arguments
 * @param {string[]} args - Command arguments
 * @param {string} defaultType - Default tracks type from session
 * @returns {{ type?: string, id?: string, error?: string, hint?: string }}
 */
function parseTracksArgs(args, defaultType) {
  if (args.length === 0) {
    return { error: 'Please provide an ID', hint: 'Usage: tracks <id> or tracks <master|release> <id>' };
  }

  // Check if first arg is numeric (just an ID)
  if (args.length === 1 || !isNaN(parseInt(args[0], 10))) {
    return { type: defaultType, id: args[0] };
  }

  // Type and ID provided
  const type = args[0].toLowerCase();
  if (type !== 'master' && type !== 'release') {
    return { error: `Invalid type '${args[0]}'`, hint: 'Valid types: master, release' };
  }

  return { type, id: args[1] };
}

/**
 * Command registry - maps command names to handlers
 */
const commands = {
  search: {
    aliases: ['s'],
    minArgs: 0,
    usage: 'search <query>',
    description: 'Search Discogs for releases or artists',
    handler: async (args, ctx) => {
      if (args.length === 0) {
        const type = ctx.sessionFlags.type || 'all';
        log.info(`Search Discogs with current settings\n`);
        log.plain(`  search type: ${type}`);
        log.plain(`  results per page: ${ctx.sessionFlags.per_page}`);
        log.plain('');
        log.plain('  usage: search <query>');
        log.plain('  example: search Daft Punk');
        return true;
      }
      await handleSearch(ctx.db, args.join(' '), ctx.sessionFlags);
      return true;
    },
  },

  tracks: {
    aliases: ['t'],
    minArgs: 1,
    usage: 'tracks [type] <id>',
    description: 'Get tracklist from a master or release',
    handler: async (args, ctx) => {
      const { type, id, error, hint } = parseTracksArgs(args, ctx.sessionFlags.tracks_type);
      if (error) {
        log.error(error);
        if (hint) log.info(hint);
        return true;
      }
      await handleTracks(ctx.db, type, id, ctx.sessionFlags);
      return true;
    },
  },

  settings: {
    aliases: [],
    minArgs: 0,
    usage: 'settings',
    description: 'Show or change current session settings',
    handler: async (_args, ctx) => {
      await handleSettings(ctx.sessionFlags, ctx.updatePrompt);
      return true;
    },
  },

  set: {
    aliases: [],
    minArgs: 0,
    usage: 'set [option] [value]',
    description: 'Quick set a session option (or show settings if no args)',
    handler: async (args, ctx) => {
      handleSet(args, ctx.sessionFlags, ctx.updatePrompt);
      return true;
    },
  },

  clean: {
    aliases: [],
    minArgs: 0,
    usage: 'clean',
    description: 'Delete all files in the dist folder',
    handler: async () => {
      handleClean();
      return true;
    },
  },

  help: {
    aliases: ['?', 'h'],
    minArgs: 0,
    usage: 'help',
    description: 'Show available commands',
    handler: async () => {
      showHelp();
      return true;
    },
  },

  exit: {
    aliases: ['quit', 'q'],
    minArgs: 0,
    usage: 'exit',
    description: 'Exit the session',
    handler: async () => {
      writeLog('Session ended by user');
      log.plain('');
      log.success('Goodbye!');
      return false; // Signal to exit REPL
    },
  },
};

/**
 * Find a command by name or alias
 * @param {string} name - Command name or alias
 * @returns {Object|null} Command object or null
 */
export function findCommand(name) {
  const lower = name.toLowerCase();
  
  // Direct match
  if (commands[lower]) {
    return { name: lower, ...commands[lower] };
  }
  
  // Alias match
  for (const [cmdName, cmd] of Object.entries(commands)) {
    if (cmd.aliases.includes(lower)) {
      return { name: cmdName, ...cmd };
    }
  }
  
  return null;
}

/**
 * Get list of all command names (for autocomplete)
 */
export function getCommandNames() {
  return Object.keys(commands);
}

export { commands };

