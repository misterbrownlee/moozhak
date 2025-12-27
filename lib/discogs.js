import Disconnect from 'disconnect';
import { fileConfig } from './config.js';
import { logApiResponse } from './logger.js';

const Discogs = Disconnect.Client;

/**
 * Create and configure Discogs client
 * @param {string|null} token - Optional token override
 * @returns {Object} { client, db, token }
 */
export function createClient(token = null) {
  const resolvedToken = token || process.env.DISCOGS_TOKEN || fileConfig.DISCOGS_TOKEN;
  
  const client = resolvedToken
    ? new Discogs('muzak/1.0.0', { userToken: resolvedToken })
    : new Discogs('muzak/1.0.0');
  
  const db = client.database();
  
  return { client, db, token: resolvedToken };
}

/**
 * Search Discogs database
 * @param {Object} db - Discogs database instance
 * @param {string} query - Search query
 * @param {string|null} type - Filter by type (artist, release, etc.)
 * @param {number} limit - Results per page
 * @param {boolean} verbose - Whether to output verbose info
 * @returns {Promise<Array>} Search results
 */
export async function searchDiscogs(db, query, type = null, limit = 5, verbose = false) {
  const params = { q: query, per_page: limit };
  
  if (type) {
    params.type = type;
  }

  try {
    const data = await db.search(params);
    
    // Log raw API response
    logApiResponse('database.search', params, data);
    
    // Verbose output
    if (verbose) {
      console.log('\n┌─ HTTP Request ──────────────────────────────────────────');
      console.log(`│ Endpoint: database.search`);
      console.log('│ Payload:');
      console.log(JSON.stringify(params, null, 2).split('\n').map(l => `│   ${l}`).join('\n'));
      console.log('├─ HTTP Response ─────────────────────────────────────────');
      console.log(JSON.stringify(data, null, 2).split('\n').map(l => `│ ${l}`).join('\n'));
      console.log('└──────────────────────────────────────────────────────────\n');
    }
    
    return data.results;
  } catch (error) {
    // Log error
    logApiResponse('database.search', params, { error: error.message });
    
    // Verbose error output
    if (verbose) {
      console.log('\n┌─ HTTP Request ──────────────────────────────────────────');
      console.log(`│ Endpoint: database.search`);
      console.log('│ Payload:');
      console.log(JSON.stringify(params, null, 2).split('\n').map(l => `│   ${l}`).join('\n'));
      console.log('├─ HTTP Error ────────────────────────────────────────────');
      console.log(`│ ${error.message}`);
      if (error.stack) {
        console.log(error.stack.split('\n').map(l => `│ ${l}`).join('\n'));
      }
      console.log('└──────────────────────────────────────────────────────────\n');
    }
    
    console.error('Error searching Discogs:', error.message);
    return [];
  }
}

/**
 * Format a Discogs result for display
 * @param {Object} result - Discogs result object
 * @returns {string} Formatted string
 */
export function formatResult(result) {
  const type = result.type || 'unknown';
  const title = result.title || 'Untitled';
  const year = result.year ? ` (${result.year})` : '';
  const catno = result.catno ? ` [${result.catno}]` : '';
  const url = `https://www.discogs.com${result.uri}`;
  
  return `  [${type}] ${title}${year}${catno}\n         ${url}`;
}

