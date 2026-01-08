import { log } from '../logger.js';
import { writeJsonOutput } from '../output.js';
import {
  buildDiscogsUrlFromUri,
  formatResult,
  searchDiscogs,
} from '../services/discogs.js';

/**
 * Build search output JSON structure (pure function)
 * @param {string} query - Search query
 * @param {string|null} type - Search type filter
 * @param {number} perPage - Results per page
 * @param {Array} results - Search results from API
 * @returns {Object} Structured output for JSON file
 */
export function buildSearchOutput(query, type, perPage, results) {
  return {
    type: 'search',
    params: {
      query,
      searchType: type,
      per_page: perPage,
    },
    result: {
      tracks: results.map((result) => ({
        title: result.title || '',
        artist: result.title?.split(' - ')[0] || '',
        album: '',
        isrc: '',
        match: {
          type: result.type || 'unknown',
          year: result.year || null,
          url: buildDiscogsUrlFromUri(result.uri),
          id: result.id,
        },
      })),
    },
  };
}

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
  const { type, per_page, verbose } = flags;

  log.plain('');
  log.info(
    `Starting${type ? ` '${type}'` : ''} search on Discogs for: "${query}" ...`,
  );
  log.plain(`  results per page: ${per_page}`);
  log.plain(`  verbose mode: ${verbose ? 'on' : 'off'}\n`);

  const results = await searchDiscogs(db, query, type, per_page, verbose);

  if (results.length === 0) {
    log.warn('No results found :(');
    return;
  }

  // Display results
  log.success(`Found ${results.length} result(s):`);
  log.divider(true);
  results.forEach((result) => {
    log.plain(formatResult(result));
    log.plain('');
  });
  log.divider();
  log.plain('');

  // Build and write JSON output
  const output = buildSearchOutput(query, type, per_page, results);
  writeJsonOutput(output);
}
