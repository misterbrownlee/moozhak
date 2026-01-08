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

import { fileConfig } from './config.js';
import { log } from './logger.js';

const GETSONGBPM_BASE_URL = 'https://api.getsong.co';

/**
 * Get API key from config
 * @returns {string|null} API key or null if not configured
 */
function getApiKey() {
  return fileConfig.GETBPM_API_KEY || null;
}

/**
 * Make a request to the GetSongBPM API
 * @param {string} endpoint - API endpoint path
 * @param {Object} [params] - Query parameters
 * @returns {Promise<Object|null>} Response data or null on error
 */
async function makeRequest(endpoint, params = {}) {
  const apiKey = getApiKey();

  if (!apiKey) {
    log.error('GetSongBPM: No API key configured. Set GETBPM_API_KEY in .mzkconfig');
    return { error: 'no_api_key' };
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
      log.warn('GetSongBPM: Rate limit exceeded (3,000/hour). Try again later.');
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
  const { limit, verbose = false } = options;

  if (verbose) {
    log.debug(`GetSongBPM: Searching for "${artist}" - "${title}"`);
  }

  const lookup = `song:${title} artist:${artist}`;
  const params = { type: 'both', lookup };

  if (limit) {
    params.limit = limit;
  }

  const data = await makeRequest('/search/', params);

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
    log.debug(`GetSongBPM: Found "${data.song.title}" - ${data.song.tempo} BPM`);
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
 * @param {boolean} [verbose=false] - Whether to log verbose output
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
export async function findBpm(artist, title, verbose = false) {
  const searchResult = await searchSong(artist, title, { verbose });

  if (!searchResult || searchResult.error) {
    return {
      found: false,
      error: searchResult?.error || 'search_failed',
      bpm: null,
    };
  }

  const songs = searchResult.search || [];

  if (songs.length === 0) {
    return {
      found: false,
      error: 'no_results',
      bpm: null,
    };
  }

  // Find best match (prefer exact artist match)
  const artistLower = artist.toLowerCase();
  const bestMatch = songs.find((s) => {
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
 * @returns {boolean} True if API key is set
 */
export function isConfigured() {
  return Boolean(getApiKey());
}

// Export base URL for testing
export { GETSONGBPM_BASE_URL };

