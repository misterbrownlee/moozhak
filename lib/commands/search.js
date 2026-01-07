import { searchDiscogs, formatResult } from '../discogs.js';
import { writeJsonOutput } from '../output.js';
import { log } from '../logger.js';

/**
 * Search command definition
 */
export const searchCommand = {
  name: 'search',
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
};

/**
 * Handle search command
 * @param {Object} db - Discogs database instance
 * @param {string} query - Search query
 * @param {Object} flags - CLI flags
 */
export async function handleSearch(db, query, flags) {
  const type = flags.type;
  log.plain('');
  log.info(`Starting${type ? ` \'${type}\'` : ''} search on Discogs for: "${query}" ...`);
  log.plain(`  results per page: ${flags.per_page}`);
  log.plain(`  verbose mode: ${flags.verbose ? 'on' : 'off'}\n`);
  
  const results = await searchDiscogs(db, query, type, flags.per_page, flags.verbose);
  
  // Build JSON output
  const output = {
    type: 'search',
    params: {
      query,
      searchType: type,
      per_page: flags.per_page
    },
    result: {
      tracks: results.map(result => ({
        title: result.title || '',  
        artist: result.title?.split(' - ')[0] || '',
        album: '',
        isrc: '',
        match: {
          type: result.type || 'unknown',
          year: result.year || null,
          url: `https://www.discogs.com${result.uri}`,
          id: result.id
        }
      }))
    }
  };
  
  if (results.length === 0) {
    log.warn('No results found :(');
  } else {
    log.success(`Found ${results.length} result(s):`);
    log.divider(true);
    results.forEach(result => {
      log.plain(formatResult(result));
      log.plain('');
    });
    log.divider();
    log.plain('');

    // Write JSON output
    writeJsonOutput(output);
  }
  

}

