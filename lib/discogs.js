import Disconnect from 'disconnect';
import { fileConfig } from './config.js';
import { logApiResponse, log } from './logger.js';

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
      log.debug('\n┌─ HTTP Request ──────────────────────────────────────────');
      log.debug(`│ Endpoint: database.search`);
      log.debug('│ Payload:');
      log.debug(JSON.stringify(params, null, 2).split('\n').map(l => `│   ${l}`).join('\n'));
      log.debug('├─ HTTP Response ─────────────────────────────────────────');
      log.debug(JSON.stringify(data, null, 2).split('\n').map(l => `│ ${l}`).join('\n'));
      log.debug('└──────────────────────────────────────────────────────────\n');
    }
    
    return data.results;
  } catch (error) {
    // Log error
    logApiResponse('database.search', params, { error: error.message });
    
    // Verbose error output
    if (verbose) {
      log.debug('\n┌─ HTTP Request ──────────────────────────────────────────');
      log.debug(`│ Endpoint: database.search`);
      log.debug('│ Payload:');
      log.debug(JSON.stringify(params, null, 2).split('\n').map(l => `│   ${l}`).join('\n'));
      log.debug('├─ HTTP Error ────────────────────────────────────────────');
      log.debug(`│ ${error.message}`);
      if (error.stack) {
        log.debug(error.stack.split('\n').map(l => `│ ${l}`).join('\n'));
      }
      log.debug('└──────────────────────────────────────────────────────────\n');
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
  try {
    const data = await db.getMaster(masterId);
    
    logApiResponse('database.getMaster', { masterId }, data);
    
    if (verbose) {
      log.debug('\n┌─ HTTP Request ──────────────────────────────────────────');
      log.debug(`│ Endpoint: database.getMaster`);
      log.debug(`│ Master ID: ${masterId}`);
      log.debug('├─ HTTP Response ─────────────────────────────────────────');
      log.debug(JSON.stringify(data, null, 2).split('\n').map(l => `│ ${l}`).join('\n'));
      log.debug('└──────────────────────────────────────────────────────────\n');
    }
    
    return data;
  } catch (error) {
    logApiResponse('database.getMaster', { masterId }, { error: error.message });
    
    if (verbose) {
      log.debug('\n┌─ HTTP Request ──────────────────────────────────────────');
      log.debug(`│ Endpoint: database.getMaster`);
      log.debug(`│ Master ID: ${masterId}`);
      log.debug('├─ HTTP Error ────────────────────────────────────────────');
      log.debug(`│ ${error.message}`);
      log.debug('└──────────────────────────────────────────────────────────\n');
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
  try {
    const data = await db.getRelease(releaseId);
    
    logApiResponse('database.getRelease', { releaseId }, data);
    
    if (verbose) {
      log.debug('\n┌─ HTTP Request ──────────────────────────────────────────');
      log.debug(`│ Endpoint: database.getRelease`);
      log.debug(`│ Release ID: ${releaseId}`);
      log.debug('├─ HTTP Response ─────────────────────────────────────────');
      log.debug(JSON.stringify(data, null, 2).split('\n').map(l => `│ ${l}`).join('\n'));
      log.debug('└──────────────────────────────────────────────────────────\n');
    }
    
    return data;
  } catch (error) {
    logApiResponse('database.getRelease', { releaseId }, { error: error.message });
    
    if (verbose) {
      log.debug('\n┌─ HTTP Request ──────────────────────────────────────────');
      log.debug(`│ Endpoint: database.getRelease`);
      log.debug(`│ Release ID: ${releaseId}`);
      log.debug('├─ HTTP Error ────────────────────────────────────────────');
      log.debug(`│ ${error.message}`);
      log.debug('└──────────────────────────────────────────────────────────\n');
    }
    
    log.error('Error fetching release:', error.message);
    return null;
  }
}

/**
 * Format a track for display
 * @param {Object} track - Discogs track object
 * @param {number} index - Track index (0-based)
 * @returns {string} Formatted string
 */
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

