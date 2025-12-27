import { searchDiscogs, formatResult } from '../discogs.js';
import { writeJsonOutput } from '../output.js';
import { log } from '../logger.js';

/**
 * Handle search command
 * @param {Object} db - Discogs database instance
 * @param {string} query - Search query
 * @param {Object} flags - CLI flags
 */
export async function handleSearch(db, query, flags) {
  const type = flags.type;

  log.info(`Searching Discogs for: "${query}"${type ? ` (type: ${type})` : ''}...\n`);
  
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
    log.warn('No results found.');
  } else {
    log.success(`Found ${results.length} result(s):\n`);
    results.forEach(result => {
      log.plain(formatResult(result));
      log.plain('');
    });
  }
  
  // Write JSON output
  writeJsonOutput(output);
}

