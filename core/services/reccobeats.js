/**
 * ReccoBeats API client
 * Free tier endpoints only (no authentication required)
 *
 * Available endpoints:
 * - GET /v1/track/:id - Get track details
 * - GET /v1/track?ids=id1,id2 - Batch get tracks
 * - GET /v1/track/:id/audio-features - Get audio features (BPM, energy, etc.)
 * - GET /v1/artist/:id - Get artist details
 */

import { log } from '../logger.js';

const RECCOBEATS_BASE_URL = 'https://api.reccobeats.com/v1';

/**
 * Default request options
 */
const DEFAULT_OPTIONS = {
  headers: {
    Accept: 'application/json',
    'User-Agent': 'moozhak/2.0.0',
  },
};

/**
 * Make a request to the ReccoBeats API
 * @param {string} endpoint - API endpoint path
 * @param {Object} [options] - Additional fetch options
 * @returns {Promise<Object|null>} Response data or null on error
 */
async function makeRequest(endpoint, options = {}) {
  const url = `${RECCOBEATS_BASE_URL}${endpoint}`;

  try {
    const response = await fetch(url, {
      ...DEFAULT_OPTIONS,
      ...options,
    });

    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After') || '60';
      log.warn(`ReccoBeats rate limit exceeded. Retry after ${retryAfter}s`);
      return { error: 'rate_limited', retryAfter: parseInt(retryAfter, 10) };
    }

    if (response.status === 401) {
      log.error('ReccoBeats: This endpoint requires authentication');
      return { error: 'auth_required' };
    }

    if (!response.ok) {
      log.error(`ReccoBeats API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    log.error(`ReccoBeats request failed: ${error.message}`);
    return null;
  }
}

/**
 * Get track details by ReccoBeats ID
 * @param {string} trackId - ReccoBeats track UUID
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} Track data or null on error
 *
 * @example
 * const track = await getTrack('8212bab8-5911-48a0-b177-24923ef2329a');
 * // Returns: { id, trackTitle, artists, durationMs, isrc, href, popularity, ... }
 */
export async function getTrack(trackId, verbose = false) {
  if (verbose) {
    log.debug(`ReccoBeats: Fetching track ${trackId}`);
  }

  const data = await makeRequest(`/track/${trackId}`);

  if (verbose && data && !data.error) {
    log.debug(`ReccoBeats: Found track "${data.trackTitle}"`);
  }

  return data;
}

/**
 * Get multiple tracks by ReccoBeats IDs
 * @param {string[]} trackIds - Array of ReccoBeats track UUIDs
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} Response with content array or null on error
 *
 * @example
 * const result = await getTracks(['id1', 'id2']);
 * // Returns: { content: [{ id, trackTitle, ... }, ...] }
 */
export async function getTracks(trackIds, verbose = false) {
  if (!trackIds || trackIds.length === 0) {
    return { content: [] };
  }

  if (verbose) {
    log.debug(`ReccoBeats: Fetching ${trackIds.length} tracks`);
  }

  const ids = trackIds.join(',');
  const data = await makeRequest(`/track?ids=${ids}`);

  if (verbose && data && !data.error) {
    log.debug(`ReccoBeats: Found ${data.content?.length || 0} tracks`);
  }

  return data;
}

/**
 * Get audio features for a track (includes BPM/tempo)
 * @param {string} trackId - ReccoBeats track UUID
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} Audio features or null on error
 *
 * @example
 * const features = await getAudioFeatures('8212bab8-5911-48a0-b177-24923ef2329a');
 * // Returns: { id, tempo, acousticness, danceability, energy, valence, ... }
 */
export async function getAudioFeatures(trackId, verbose = false) {
  if (verbose) {
    log.debug(`ReccoBeats: Fetching audio features for ${trackId}`);
  }

  const data = await makeRequest(`/track/${trackId}/audio-features`);

  if (verbose && data && !data.error) {
    log.debug(`ReccoBeats: BPM = ${data.tempo}`);
  }

  return data;
}

/**
 * Get artist details by ReccoBeats ID
 * @param {string} artistId - ReccoBeats artist UUID
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} Artist data or null on error
 *
 * @example
 * const artist = await getArtist('9451b6b2-8746-4d43-abd7-c355ed1e3048');
 * // Returns: { id, name, href }
 */
export async function getArtist(artistId, verbose = false) {
  if (verbose) {
    log.debug(`ReccoBeats: Fetching artist ${artistId}`);
  }

  const data = await makeRequest(`/artist/${artistId}`);

  if (verbose && data && !data.error) {
    log.debug(`ReccoBeats: Found artist "${data.name}"`);
  }

  return data;
}

/**
 * Get track with audio features combined
 * @param {string} trackId - ReccoBeats track UUID
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} Combined track and audio features or null on error
 *
 * @example
 * const track = await getTrackWithFeatures('8212bab8-5911-48a0-b177-24923ef2329a');
 * // Returns: { id, trackTitle, artists, audioFeatures: { tempo, energy, ... } }
 */
export async function getTrackWithFeatures(trackId, verbose = false) {
  const [track, features] = await Promise.all([
    getTrack(trackId, verbose),
    getAudioFeatures(trackId, verbose),
  ]);

  if (!track || track.error) {
    return track;
  }

  return {
    ...track,
    audioFeatures: features?.error ? null : features,
  };
}

/**
 * Format BPM value for display
 * @param {number|null} tempo - BPM value from audio features
 * @returns {string} Formatted BPM string
 */
export function formatBpm(tempo) {
  if (tempo === null || tempo === undefined) {
    return 'N/A';
  }
  return Math.round(tempo).toString();
}

/**
 * Format audio features for display
 * @param {Object} features - Audio features object
 * @param {string} [format='human'] - Output format: human, csv, pipe, markdown
 * @returns {string} Formatted string
 */
export function formatAudioFeatures(features, format = 'human') {
  if (!features || features.error) {
    return format === 'csv' ? ',,,,' : 'Audio features unavailable';
  }

  const bpm = formatBpm(features.tempo);
  const energy =
    features.energy !== undefined ? Math.round(features.energy * 100) : 'N/A';
  const danceability =
    features.danceability !== undefined
      ? Math.round(features.danceability * 100)
      : 'N/A';
  const valence =
    features.valence !== undefined ? Math.round(features.valence * 100) : 'N/A';

  switch (format) {
    case 'csv':
      return `${bpm},${energy},${danceability},${valence}`;

    case 'pipe':
      return `${bpm} | ${energy}% | ${danceability}% | ${valence}%`;

    case 'markdown':
      return `| ${bpm} | ${energy}% | ${danceability}% | ${valence}% |`;

    default:
      return `BPM: ${bpm}  Energy: ${energy}%  Danceability: ${danceability}%  Mood: ${valence}%`;
  }
}

/**
 * Check if an ID looks like a valid ReccoBeats UUID
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid UUID format
 */
export function isValidReccoBeatsId(id) {
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

// Export base URL for testing
export { RECCOBEATS_BASE_URL };
