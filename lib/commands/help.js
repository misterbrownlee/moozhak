import { log } from '../logger.js';

/**
 * Display help for all commands
 */
export function showHelp() {
  log.plain(`
  Available Commands:
    search               Show current search settings
    search <query>       Search Discogs for a release or artist
    tracks <id>          Get tracklist using current tracks_type setting
    tracks <type> <id>   Get tracklist (type: master or release)
    settings             Interactive settings menu
    set [option] [val]   Quick set: type, per_page, tracks_type, tracks_output, verbose
    clean                Delete all files in the dist folder
    help                 Show this help message
    exit                 Exit the session

  Examples:
    search Daft Punk
    tracks 1234
    tracks release 249504
    set type master
    set verbose on`);
}

/**
 * Help command definition
 */
export const helpCommand = {
  name: 'help',
  aliases: ['?', 'h'],
  minArgs: 0,
  usage: 'help',
  description: 'Show available commands',
  handler: async () => {
    showHelp();
    return true;
  },
};
