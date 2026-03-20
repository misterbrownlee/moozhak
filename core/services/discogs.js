import Disconnect from 'disconnect';
import { fileConfig } from '../config.js';
import { log, logApiResponse } from '../logger.js';
import { discogsAuthLimiter, discogsUnauthLimiter } from './rateLimiter.js';

const Discogs = Disconnect.Client;

const DISCOGS_BASE_URL = 'https://www.discogs.com';

/**
 * Get the appropriate rate limiter based on authentication status
 * @param {boolean} isAuthenticated - Whether request is authenticated
 * @returns {Object} Rate limiter instance
 */
function getDiscogsLimiter(isAuthenticated) {
  return isAuthenticated ? discogsAuthLimiter : discogsUnauthLimiter;
}

/**
 * Acquire rate limit slot for Discogs API
 * @param {boolean} isAuthenticated - Whether request is authenticated
 * @param {boolean} verbose - Whether to log verbose info
 * @returns {Promise<{allowed: boolean, error?: string}>}
 */
async function acquireDiscogsSlot(isAuthenticated, verbose = false) {
  const limiter = getDiscogsLimiter(isAuthenticated);
  const result = await limiter.acquireSlot(verbose);

  if (!result.allowed) {
    const waitTime = limiter.getTimeUntilSlotAvailable();
    const waitSeconds = Math.ceil(waitTime / 1000);
    const limit = isAuthenticated ? '60/minute' : '25/minute';
    return {
      allowed: false,
      error: `Discogs rate limit reached (${limit}). Try again in ~${waitSeconds} second(s).`,
    };
  }

  return { allowed: true };
}

/**
 * Get Discogs rate limit status
 * @param {boolean} isAuthenticated - Whether authenticated
 * @returns {Object} Status object
 */
export function getDiscogsRateLimitStatus(isAuthenticated) {
  return getDiscogsLimiter(isAuthenticated).getStatus();
}

/**
 * Build Discogs URL from type and ID
 * @param {string} type - Resource type ('master', 'release', 'artist', 'label')
 * @param {number|string} id - Resource ID
 * @returns {string} Full URL
 */
export function buildDiscogsUrl(type, id) {
  return `${DISCOGS_BASE_URL}/${type}/${id}`;
}

/**
 * Build Discogs URL from a URI path
 * @param {string} uri - URI path (e.g., '/master/12345')
 * @returns {string} Full URL
 */
export function buildDiscogsUrlFromUri(uri) {
  return `${DISCOGS_BASE_URL}${uri}`;
}

/**
 * Log verbose API request/response for debugging
 * @param {string} endpoint - API endpoint name
 * @param {Object} params - Request parameters
 * @param {Object} data - Response data or error
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.isError=false] - Whether this is an error response
 * @param {string} [options.errorStack] - Error stack trace (for errors)
 */
function logVerboseRequest(
  endpoint,
  params,
  data,
  { isError = false, errorStack = null } = {},
) {
  const indent = (str) =>
    str
      .split('\n')
      .map((l) => `│ ${l}`)
      .join('\n');

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
 * @returns {Object} { client, db, user, token, isAuthenticated }
 */
export function createClient(token = null) {
  const resolvedToken =
    token || process.env.DISCOGS_TOKEN || fileConfig.DISCOGS_TOKEN;

  const client = resolvedToken
    ? new Discogs('muzak/1.0.0', { userToken: resolvedToken })
    : new Discogs('muzak/1.0.0');

  const db = client.database();
  const user = client.user();
  const isAuthenticated = Boolean(resolvedToken);

  return { client, db, user, token: resolvedToken, isAuthenticated };
}

/**
 * Get the authenticated user's identity
 * @param {Object} client - Discogs client instance
 * @param {Object} options - Options
 * @param {boolean} options.verbose - Whether to output verbose info
 * @param {boolean} options.isAuthenticated - Whether client is authenticated (for rate limiting)
 * @returns {Promise<Object|null>} User identity or null
 */
export async function getIdentity(
  client,
  { verbose = false, isAuthenticated = true } = {},
) {
  // Acquire rate limit slot
  const slot = await acquireDiscogsSlot(isAuthenticated, verbose);
  if (!slot.allowed) {
    log.error(slot.error);
    return null;
  }

  try {
    const data = await client.getIdentity();

    if (verbose) {
      logVerboseRequest('client.getIdentity', {}, data);
    }

    return data;
  } catch (error) {
    if (verbose) {
      logVerboseRequest('client.getIdentity', {}, error, { isError: true });
    }
    log.error('Error getting identity:', error.message);
    return null;
  }
}

/**
 * Get a user's collection
 * @param {Object} user - Discogs user instance
 * @param {string} username - Discogs username
 * @param {Object} options - Options
 * @param {number} options.folder - Folder ID (0 = All)
 * @param {number} options.page - Page number
 * @param {number} options.perPage - Items per page
 * @param {string} options.sort - Sort field (artist, title, added, year)
 * @param {string} options.sortOrder - Sort order (asc, desc)
 * @param {boolean} options.verbose - Verbose output
 * @param {boolean} options.isAuthenticated - Whether client is authenticated (for rate limiting)
 * @returns {Promise<Object|null>} Collection data or null
 */
export async function getCollection(
  user,
  username,
  {
    folder = 0,
    page = 1,
    perPage = 50,
    sort = 'added',
    sortOrder = 'desc',
    verbose = false,
    isAuthenticated = true,
  } = {},
) {
  // Acquire rate limit slot
  const slot = await acquireDiscogsSlot(isAuthenticated, verbose);
  if (!slot.allowed) {
    log.error(slot.error);
    return null;
  }

  const params = {
    folder,
    page,
    per_page: perPage,
    sort,
    sort_order: sortOrder,
  };

  try {
    const collection = user.collection();
    const data = await collection.getReleases(username, folder, {
      page,
      per_page: perPage,
      sort,
      sort_order: sortOrder,
    });

    logApiResponse('user.collection.getReleases', params, data);

    if (verbose) {
      logVerboseRequest('user.collection.getReleases', params, data);
    }

    return data;
  } catch (error) {
    logApiResponse('user.collection.getReleases', params, {
      error: error.message,
    });

    if (verbose) {
      logVerboseRequest('user.collection.getReleases', params, error, {
        isError: true,
        errorStack: error.stack,
      });
    }

    log.error('Error fetching collection:', error.message);
    return null;
  }
}

/**
 * Search Discogs database
 * @param {Object} db - Discogs database instance
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @param {string|null} options.type - Filter by type (artist, release, master, label)
 * @param {string|null} options.format - Filter by format (Vinyl, CD, etc.)
 * @param {number} options.limit - Results per page
 * @param {boolean} options.verbose - Whether to output verbose info
 * @param {boolean} options.isAuthenticated - Whether client is authenticated (for rate limiting)
 * @returns {Promise<Array>} Search results
 */
export async function searchDiscogs(
  db,
  query,
  {
    type = null,
    format = null,
    limit = 5,
    verbose = false,
    isAuthenticated = true,
  } = {},
) {
  // Acquire rate limit slot
  const slot = await acquireDiscogsSlot(isAuthenticated, verbose);
  if (!slot.allowed) {
    log.error(slot.error);
    return [];
  }

  const params = { q: query, per_page: limit };

  if (type) {
    params.type = type;
  }

  if (format) {
    params.format = format;
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
        errorStack: error.stack,
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
 * @param {Object} options - Options
 * @param {boolean} options.verbose - Whether to output verbose info
 * @param {boolean} options.isAuthenticated - Whether client is authenticated (for rate limiting)
 * @returns {Promise<Object|null>} Master release data or null on error
 */
export async function getMaster(
  db,
  masterId,
  { verbose = false, isAuthenticated = true } = {},
) {
  // Acquire rate limit slot
  const slot = await acquireDiscogsSlot(isAuthenticated, verbose);
  if (!slot.allowed) {
    log.error(slot.error);
    return null;
  }

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
 * @param {Object} options - Options
 * @param {boolean} options.verbose - Whether to output verbose info
 * @param {boolean} options.isAuthenticated - Whether client is authenticated (for rate limiting)
 * @returns {Promise<Object|null>} Release data or null on error
 */
export async function getRelease(
  db,
  releaseId,
  { verbose = false, isAuthenticated = true } = {},
) {
  // Acquire rate limit slot
  const slot = await acquireDiscogsSlot(isAuthenticated, verbose);
  if (!slot.allowed) {
    log.error(slot.error);
    return null;
  }

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
      logVerboseRequest('database.getRelease', params, error, {
        isError: true,
      });
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
    case 'csv': {
      // Escape quotes in title and wrap in quotes if contains comma
      const csvTitle =
        title.includes(',') || title.includes('"')
          ? `"${title.replace(/"/g, '""')}"`
          : title;
      return `${position},${csvTitle},${duration}`;
    }

    case 'pipe':
      return `${position} | ${title} | ${duration}`;

    case 'markdown':
      return `| ${position} | ${title} | ${duration} |`;
    default: {
      const durationStr = duration ? ` (${duration})` : '';
      return `  ${position} ${title}${durationStr}`;
    }
  }
}
