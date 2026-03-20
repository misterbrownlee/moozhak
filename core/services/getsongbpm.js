/**
 * GetSongBPM API client
 * https://getsongbpm.com/api
 *
 * Provides BPM, key, time signature, and other audio features for songs.
 * Requires API key (free tier: 3,000 requests/hour)
 *
 * Endpoints implemented:
 * - /search/ - Search for songs by artist and title
 * - /song/ - Get song details by ID
 * - /artist/ - Get artist details by ID
 */

import { fileConfig } from '../config.js';
import { log } from '../logger.js';
import {
  acquireSlot,
  canMakeRequest,
  getStatus as getRateLimitStatus,
  getTimeUntilSlotAvailable,
} from './rateLimiter.js';

const GETSONGBPM_BASE_URL = 'https://api.getsong.co';

/**
 * @returns {string|null} API key from file config only
 */
function getApiKeyFromFile() {
  const v = fileConfig.GETBPM_API_KEY?.trim();
  return v || null;
}

/**
 * @param {string|null|undefined} explicitApiKey - If not `undefined`, sole source (trimmed). If `undefined`, use file config.
 * @returns {string|null}
 */
function resolveEffectiveApiKey(explicitApiKey) {
  if (explicitApiKey !== undefined) {
    if (explicitApiKey === null || explicitApiKey === '') return null;
    const t = String(explicitApiKey).trim();
    return t || null;
  }
  return getApiKeyFromFile();
}

/**
 * Make a request to the GetSongBPM API
 * @param {string} endpoint - API endpoint path
 * @param {Object} [params] - Query parameters
 * @param {Object} [options] - Request options
 * @param {boolean} [options.skipRateLimit=false] - Skip rate limiting (for internal use)
 * @param {boolean} [options.verbose=false] - Log rate limit info
 * @param {string|null|undefined} [options.apiKey] - Explicit key (web); omit for file config only
 * @returns {Promise<Object|null>} Response data or null on error
 */
async function makeRequest(endpoint, params = {}, options = {}) {
  const { skipRateLimit = false, verbose = false, apiKey: apiKeyOpt } = options;
  const apiKey = resolveEffectiveApiKey(apiKeyOpt);

  if (!apiKey) {
    log.error(
      'GetSongBPM: No API key configured. Set it in app Settings or pass the client header.',
    );
    return { error: 'no_api_key' };
  }

  // Check rate limit before making request
  if (!skipRateLimit) {
    const slot = await acquireSlot(verbose);

    if (!slot.allowed) {
      const waitTime = getTimeUntilSlotAvailable();
      const waitMinutes = Math.ceil(waitTime / 60000);
      log.error(
        `GetSongBPM: Rate limit reached (3,000/hour). Try again in ~${waitMinutes} minute(s).`,
      );
      return { error: 'rate_limited', retryAfterMs: waitTime };
    }
  }

  const url = new URL(`${GETSONGBPM_BASE_URL}${endpoint}`);
  url.searchParams.set('api_key', apiKey);

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': 'moozhak/2.0.0',
      },
    });

    if (response.status === 401) {
      log.error('GetSongBPM: Invalid API key');
      return { error: 'invalid_api_key' };
    }

    if (response.status === 429) {
      log.warn(
        'GetSongBPM: Rate limit exceeded by API (3,000/hour). Try again later.',
      );
      return { error: 'rate_limited' };
    }

    if (!response.ok) {
      log.error(`GetSongBPM API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    log.error(`GetSongBPM request failed: ${error.message}`);
    return null;
  }
}

/**
 * Search for songs by artist and title
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @param {Object} [options] - Search options
 * @param {number} [options.limit] - Max results to return
 * @param {boolean} [options.verbose=false] - Whether to log verbose output
 * @returns {Promise<Object>} Search results with songs array
 *
 * @example
 * const results = await searchSong('Rick Astley', 'Never Gonna Give You Up');
 * // Returns: { search: [{ id, title, tempo, artist, ... }] }
 */
export async function searchSong(artist, title, options = {}) {
  const { limit, verbose = false, apiKey } = options;

  if (verbose) {
    log.debug(`GetSongBPM: Searching for "${artist}" - "${title}"`);
  }

  const lookup = `song:${title} artist:${artist}`;
  const params = { type: 'both', lookup };

  if (limit) {
    params.limit = limit;
  }

  const data = await makeRequest('/search/', params, { verbose, apiKey });

  if (verbose && data && !data.error) {
    const count = data.search?.length || 0;
    log.debug(`GetSongBPM: Found ${count} result(s)`);
  }

  return data;
}

/**
 * Search for songs by title only
 * @param {string} title - Song title
 * @param {Object} [options] - Search options
 * @param {number} [options.limit] - Max results to return
 * @param {boolean} [options.verbose=false] - Whether to log verbose output
 * @returns {Promise<Object>} Search results
 */
export async function searchByTitle(title, options = {}) {
  const { limit, verbose = false } = options;

  if (verbose) {
    log.debug(`GetSongBPM: Searching for song "${title}"`);
  }

  const params = { type: 'song', lookup: title };

  if (limit) {
    params.limit = limit;
  }

  return await makeRequest('/search/', params);
}

/**
 * Search for artists by name
 * @param {string} name - Artist name
 * @param {Object} [options] - Search options
 * @param {number} [options.limit] - Max results to return
 * @param {boolean} [options.verbose=false] - Whether to log verbose output
 * @returns {Promise<Object>} Search results
 */
export async function searchArtist(name, options = {}) {
  const { limit, verbose = false } = options;

  if (verbose) {
    log.debug(`GetSongBPM: Searching for artist "${name}"`);
  }

  const params = { type: 'artist', lookup: name };

  if (limit) {
    params.limit = limit;
  }

  return await makeRequest('/search/', params);
}

/**
 * GetSongBPM /search/ usually returns `search` as an array; some responses use a single object.
 * @param {unknown} search - `data.search` from API JSON
 * @returns {Array<Record<string, unknown>>}
 */
function normalizeSearchSongs(search) {
  if (search == null) return [];
  if (Array.isArray(search)) return search;
  if (typeof search === 'object') return [search];
  return [];
}

/**
 * Get song details by ID
 * @param {string} songId - GetSongBPM song ID
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} Song data or null on error
 *
 * @example
 * const song = await getSong('qZPp7');
 * // Returns: { song: { id, title, tempo, time_sig, key_of, artist, ... } }
 */
export async function getSong(songId, verbose = false) {
  if (verbose) {
    log.debug(`GetSongBPM: Fetching song ${songId}`);
  }

  const data = await makeRequest('/song/', { id: songId });

  if (verbose && data?.song) {
    log.debug(
      `GetSongBPM: Found "${data.song.title}" - ${data.song.tempo} BPM`,
    );
  }

  return data;
}

/**
 * Get artist details by ID
 * @param {string} artistId - GetSongBPM artist ID
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} Artist data or null on error
 *
 * @example
 * const artist = await getArtist('MKkm');
 * // Returns: { artist: { id, name, genres, from, mbid, similar, ... } }
 */
export async function getArtist(artistId, verbose = false) {
  if (verbose) {
    log.debug(`GetSongBPM: Fetching artist ${artistId}`);
  }

  const data = await makeRequest('/artist/', { id: artistId });

  if (verbose && data?.artist) {
    log.debug(`GetSongBPM: Found artist "${data.artist.name}"`);
  }

  return data;
}

/**
 * Find BPM for a track by artist and title
 * Convenience method that searches and returns the best match with BPM
 * @param {string} artist - Artist name
 * @param {string} title - Song title
 * @param {boolean|Object} [third=false] - Verbose flag, or `{ verbose?, apiKey? }` for web overrides
 * @returns {Promise<Object>} Result with BPM info or error
 *
 * @example
 * const result = await findBpm('Daft Punk', 'Around the World');
 * // Returns: {
 * //   found: true,
 * //   bpm: 121,
 * //   song: { id, title, tempo, key_of, time_sig, ... }
 * // }
 */
export async function findBpm(artist, title, third = false) {
  const opts = typeof third === 'boolean' ? { verbose: third } : third || {};
  const { verbose = false, apiKey } = opts;
  const searchResult = await searchSong(artist, title, { verbose, apiKey });

  if (!searchResult || searchResult.error) {
    return {
      found: false,
      error: searchResult?.error || 'search_failed',
      bpm: null,
    };
  }

  const songs = normalizeSearchSongs(searchResult.search);

  if (songs.length === 0) {
    return {
      found: false,
      error: 'no_results',
      bpm: null,
    };
  }

  // Find best match (prefer exact artist match)
  const artistLower = artist.toLowerCase();
  const bestMatch =
    songs.find((s) => {
      const songArtist = s.artist?.name?.toLowerCase() || '';
      return songArtist === artistLower || songArtist.includes(artistLower);
    }) || songs[0];

  const bpm = bestMatch.tempo ? parseInt(bestMatch.tempo, 10) : null;

  return {
    found: true,
    bpm,
    song: {
      id: bestMatch.id,
      title: bestMatch.title,
      artist: bestMatch.artist?.name,
      tempo: bestMatch.tempo,
      key: bestMatch.key_of,
      timeSignature: bestMatch.time_sig,
      openKey: bestMatch.open_key,
      danceability: bestMatch.danceability,
      acousticness: bestMatch.acousticness,
      uri: bestMatch.uri,
      album: bestMatch.album?.title,
      year: bestMatch.album?.year,
    },
  };
}

/**
 * Format BPM result for display
 * @param {Object} result - Result from findBpm()
 * @param {string} [format='human'] - Output format: human, csv, pipe, markdown
 * @returns {string} Formatted string
 */
export function formatBpmResult(result, format = 'human') {
  if (!result.found) {
    return format === 'csv' ? ',,,' : 'BPM not found';
  }

  const { song } = result;
  const bpm = song.tempo || 'N/A';
  const key = song.key || 'N/A';
  const timeSig = song.timeSignature || 'N/A';

  switch (format) {
    case 'csv':
      return `${bpm},${key},${timeSig}`;

    case 'pipe':
      return `${bpm} BPM | Key: ${key} | Time: ${timeSig}`;

    case 'markdown':
      return `| ${bpm} | ${key} | ${timeSig} |`;

    default:
      return `${bpm} BPM  Key: ${key}  Time: ${timeSig}`;
  }
}

/**
 * Check if API key is configured
 * @param {string|null|undefined} [apiKey] - If not `undefined`, check this key only; else file config
 * @returns {boolean} True if API key is set
 */
export function isConfigured(apiKey) {
  return Boolean(resolveEffectiveApiKey(apiKey));
}

/**
 * Look up BPM for multiple tracks from an album
 * @param {string} artist - Artist name for all tracks
 * @param {Array<{title: string, position?: string}>} tracks - Array of track objects with title
 * @param {Object} [options] - Options
 * @param {boolean} [options.verbose=false] - Whether to log verbose output
 * @param {string|null|undefined} [options.apiKey] - Explicit key (web); omit for file config only
 * @returns {Promise<Object>} Results object with track BPM data
 *
 * @example
 * const results = await lookupAlbumBpm('Daft Punk', [
 *   { title: 'Around the World', position: 'A1' },
 *   { title: 'Da Funk', position: 'A2' }
 * ]);
 * // Returns: {
 * //   success: true,
 * //   artist: 'Daft Punk',
 * //   tracks: [
 * //     { position: 'A1', title: 'Around the World', found: true, bpm: 121, key: 'Am', ... },
 * //     { position: 'A2', title: 'Da Funk', found: true, bpm: 116, key: 'Gm', ... }
 * //   ],
 * //   summary: { total: 2, found: 2, notFound: 0, rateLimited: 0 }
 * // }
 */
export async function lookupAlbumBpm(artist, tracks, options = {}) {
  const { verbose = false, apiKey } = options;

  if (!isConfigured(apiKey)) {
    return {
      success: false,
      error: 'no_api_key',
      message: 'GetSongBPM API key not configured',
    };
  }

  if (!artist || !tracks || tracks.length === 0) {
    return {
      success: false,
      error: 'invalid_input',
      message: 'Artist and tracks are required',
    };
  }

  // Check if we can make any requests before starting
  if (!canMakeRequest()) {
    const waitTime = getTimeUntilSlotAvailable();
    const waitMinutes = Math.ceil(waitTime / 60000);
    return {
      success: false,
      error: 'rate_limited',
      message: `Rate limit reached. Try again in ~${waitMinutes} minute(s).`,
      retryAfterMs: waitTime,
    };
  }

  if (verbose) {
    const status = getRateLimitStatus();
    log.debug(
      `GetSongBPM: Looking up BPM for ${tracks.length} tracks by "${artist}"`,
    );
    log.debug(
      `GetSongBPM: Rate limit status: ${status.count}/${status.limit} requests used`,
    );
  }

  const results = [];
  let foundCount = 0;
  let notFoundCount = 0;
  let rateLimitedCount = 0;

  for (const track of tracks) {
    // Skip tracks without titles
    if (!track.title) {
      results.push({
        position: track.position || null,
        title: null,
        found: false,
        error: 'no_title',
      });
      notFoundCount++;
      continue;
    }

    const bpmResult = await findBpm(artist, track.title, { verbose, apiKey });

    if (bpmResult.error === 'rate_limited') {
      // Rate limited - record and continue (don't fail the whole batch)
      rateLimitedCount++;
      results.push({
        position: track.position || null,
        title: track.title,
        found: false,
        error: 'rate_limited',
      });
      // If we hit rate limit, remaining tracks will also be rate limited
      // So we can skip them instead of waiting
      if (verbose) {
        log.warn(
          `GetSongBPM: Rate limit reached, skipping remaining ${tracks.length - results.length} tracks`,
        );
      }
      // Fill remaining tracks with rate_limited error
      const remaining = tracks.slice(results.length);
      for (const t of remaining) {
        results.push({
          position: t.position || null,
          title: t.title || null,
          found: false,
          error: 'rate_limited',
        });
        rateLimitedCount++;
      }
      break;
    }

    if (bpmResult.found) {
      foundCount++;
      results.push({
        position: track.position || null,
        title: track.title,
        found: true,
        bpm: bpmResult.bpm,
        key: bpmResult.song.key || null,
        timeSignature: bpmResult.song.timeSignature || null,
        openKey: bpmResult.song.openKey || null,
      });
    } else {
      notFoundCount++;
      results.push({
        position: track.position || null,
        title: track.title,
        found: false,
        error: bpmResult.error || 'not_found',
      });
    }
  }

  if (verbose) {
    log.debug(
      `GetSongBPM: Completed - ${foundCount}/${tracks.length} tracks found`,
    );
    if (rateLimitedCount > 0) {
      log.warn(
        `GetSongBPM: ${rateLimitedCount} tracks skipped due to rate limit`,
      );
    }
  }

  return {
    success: true,
    artist,
    tracks: results,
    summary: {
      total: tracks.length,
      found: foundCount,
      notFound: notFoundCount,
      rateLimited: rateLimitedCount,
    },
  };
}

// Export rate limit status for external use
export { getRateLimitStatus };

// Export base URL for testing
export { GETSONGBPM_BASE_URL };
