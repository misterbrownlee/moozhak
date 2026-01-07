import Disconnect from 'disconnect';
import { fileConfig } from './config.js';
import { logApiResponse, log } from './logger.js';

const Discogs = Disconnect.Client;

/**
 * Log verbose API request/response for debugging
 * @param {string} endpoint - API endpoint name
 * @param {Object} params - Request parameters
 * @param {Object} data - Response data or error
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.isError=false] - Whether this is an error response
 * @param {string} [options.errorStack] - Error stack trace (for errors)
 */
function logVerboseRequest(endpoint, params, data, { isError = false, errorStack = null } = {}) {
  const indent = (str) => str.split('\n').map(l => `│ ${l}`).join('\n');
  
  log.debug('\n┌─ HTTP Request ──────────────────────────────────────────');
  log.debug(`│ Endpoint: ${endpoint}`);
  log.debug('│ Params:');
  log.debug(indent(JSON.stringify(params, null, 2)));
  
  if (isError) {
    log.debug('├─ HTTP Error ────────────────────────────────────────────');
    log.debug(`│ ${data.message || data}`);
    if (errorStack) {
      log.debug(indent(errorStack));
    }
  } else {
    log.debug('├─ HTTP Response ─────────────────────────────────────────');
    log.debug(indent(JSON.stringify(data, null, 2)));
  }
  
  log.debug('└──────────────────────────────────────────────────────────\n');
}

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
    
    logApiResponse('database.search', params, data);
    
    if (verbose) {
      logVerboseRequest('database.search', params, data);
    }
    
    return data.results;
  } catch (error) {
    logApiResponse('database.search', params, { error: error.message });
    
    if (verbose) {
      logVerboseRequest('database.search', params, error, { 
        isError: true, 
        errorStack: error.stack 
      });
    }
    
    log.error('Error searching Discogs:', error.message);
    return [];
  }
}

/**
 * Format a Discogs result for display
 * @param {Object} result - Discogs result object
 * @returns {string} Formatted string
 */
export function formatResult(result) {
  const id = result.id || '';
  const title = result.title || 'Untitled';
  const year = result.year || '';
  const format = result.format ? result.format.join(', ') : '';
  const catno = result.catno || '';
  
  const parts = [id, title, year, format, catno].filter(Boolean);
  return `  ${parts.join(' | ')}`;
}

/**
 * Get master release details including tracklist
 * @param {Object} db - Discogs database instance
 * @param {number} masterId - Master release ID
 * @param {boolean} verbose - Whether to output verbose info
 * @returns {Promise<Object|null>} Master release data or null on error
 */
export async function getMaster(db, masterId, verbose = false) {
  const params = { masterId };
  
  try {
    const data = await db.getMaster(masterId);
    
    logApiResponse('database.getMaster', params, data);
    
    if (verbose) {
      logVerboseRequest('database.getMaster', params, data);
    }
    
    return data;
  } catch (error) {
    logApiResponse('database.getMaster', params, { error: error.message });
    
    if (verbose) {
      logVerboseRequest('database.getMaster', params, error, { isError: true });
    }
    
    log.error('Error fetching master:', error.message);
    return null;
  }
}

/**
 * Get release details including tracklist
 * @param {Object} db - Discogs database instance
 * @param {number} releaseId - Release ID
 * @param {boolean} verbose - Whether to output verbose info
 * @returns {Promise<Object|null>} Release data or null on error
 */
export async function getRelease(db, releaseId, verbose = false) {
  const params = { releaseId };
  
  try {
    const data = await db.getRelease(releaseId);
    
    logApiResponse('database.getRelease', params, data);
    
    if (verbose) {
      logVerboseRequest('database.getRelease', params, data);
    }
    
    return data;
  } catch (error) {
    logApiResponse('database.getRelease', params, { error: error.message });
    
    if (verbose) {
      logVerboseRequest('database.getRelease', params, error, { isError: true });
    }
    
    log.error('Error fetching release:', error.message);
    return null;
  }
}

/**
 * Format a track for display
 * @param {Object} track - Discogs track object
 * @param {number} index - Track index (0-based)
 * @param {string} format - Output format: human, csv, pipe, markdown
 * @returns {string} Formatted string
 */
export function formatTrack(track, index, format = 'human') {
  const position = track.position || String(index + 1);
  const title = track.title || 'Untitled';
  const duration = track.duration || '';
  
  switch (format) {
    case 'csv':
      // Escape quotes in title and wrap in quotes if contains comma
      const csvTitle = title.includes(',') || title.includes('"') 
        ? `"${title.replace(/"/g, '""')}"` 
        : title;
      return `${position},${csvTitle},${duration}`;
    
    case 'pipe':
      return `${position} | ${title} | ${duration}`;
    
    case 'markdown':
      return `| ${position} | ${title} | ${duration} |`;
    
    case 'human':
    default:
      const durationStr = duration ? ` (${duration})` : '';
      return `  ${position} ${title}${durationStr}`;
  }
}
