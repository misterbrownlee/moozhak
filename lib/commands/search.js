import { searchDiscogs, formatResult } from '../discogs.js';
import { writeJsonOutput } from '../output.js';

/**
 * Handle search command
 * @param {Object} db - Discogs database instance
 * @param {string} query - Search query
 * @param {Object} flags - CLI flags
 */
export async function handleSearch(db, query, flags) {
  const type = flags.type;

  console.log(`\nSearching Discogs for: "${query}"${type ? ` (type: ${type})` : ''}...\n`);
  
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
    console.log('No results found.');
  } else {
    console.log(`Found ${results.length} result(s):\n`);
    results.forEach(result => {
      console.log(formatResult(result));
      console.log();
    });
  }
  
  // Write JSON output
  writeJsonOutput(output);
}

