/**
 * MusicBrainz API client
 * Free API - no authentication required
 * Rate limit: 1 request per second (be respectful)
 *
 * Used to bridge Discogs data to other services via:
 * - ISRC codes (International Standard Recording Code)
 * - MusicBrainz IDs (MBIDs)
 * - External URL lookups (Discogs, Spotify, etc.)
 */

import { log } from '../logger.js';

const MUSICBRAINZ_BASE_URL = 'https://musicbrainz.org/ws/2';
const USER_AGENT = 'moozhak/2.0.0 (https://github.com/user/moozhak)';

/**
 * Rate limiting - MusicBrainz requires max 1 request/second
 */
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL = 1100; // 1.1 seconds to be safe

/**
 * Wait if needed to respect rate limits
 */
async function respectRateLimit() {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL) {
    const waitTime = MIN_REQUEST_INTERVAL - timeSinceLastRequest;
    await new Promise((resolve) => setTimeout(resolve, waitTime));
  }

  lastRequestTime = Date.now();
}

/**
 * Make a request to the MusicBrainz API
 * @param {string} endpoint - API endpoint path
 * @param {Object} [params] - Query parameters
 * @returns {Promise<Object|null>} Response data or null on error
 */
async function makeRequest(endpoint, params = {}) {
  await respectRateLimit();

  const url = new URL(`${MUSICBRAINZ_BASE_URL}${endpoint}`);
  url.searchParams.set('fmt', 'json');

  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }

  try {
    const response = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    });

    if (response.status === 503) {
      log.warn('MusicBrainz: Rate limit exceeded, please wait');
      return { error: 'rate_limited' };
    }

    if (!response.ok) {
      log.error(`MusicBrainz API error: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    log.error(`MusicBrainz request failed: ${error.message}`);
    return null;
  }
}

/**
 * Look up a MusicBrainz entity by external URL (e.g., Discogs URL)
 * @param {string} resourceUrl - External URL to look up
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} URL entity data or null
 *
 * @example
 * const result = await lookupByUrl('https://www.discogs.com/release/249504');
 * // Returns: { id, resource, relations: [{ release: { id, title, ... } }] }
 */
export async function lookupByUrl(resourceUrl, verbose = false) {
  if (verbose) {
    log.debug(`MusicBrainz: Looking up URL ${resourceUrl}`);
  }

  const data = await makeRequest('/url', { resource: resourceUrl });

  if (!data || data.error) {
    return data;
  }

  // Get the URL entity with release relations
  const urlId = data.id;
  if (!urlId) {
    return null;
  }

  const urlData = await makeRequest(`/url/${urlId}`, { inc: 'release-rels' });

  if (verbose && urlData && !urlData.error) {
    const releases = urlData.relations?.filter((r) => r.release) || [];
    log.debug(`MusicBrainz: Found ${releases.length} linked release(s)`);
  }

  return urlData;
}

/**
 * Look up a MusicBrainz release by Discogs release ID
 * @param {number|string} discogsReleaseId - Discogs release ID
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} Release data with relations or null
 *
 * @example
 * const result = await lookupByDiscogsRelease(249504);
 * // Returns: { id, title, relations: [{ release: { id, title, ... } }] }
 */
export async function lookupByDiscogsRelease(
  discogsReleaseId,
  verbose = false,
) {
  const discogsUrl = `https://www.discogs.com/release/${discogsReleaseId}`;
  return lookupByUrl(discogsUrl, verbose);
}

/**
 * Get a release with recordings and ISRCs
 * @param {string} releaseId - MusicBrainz release ID (MBID)
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} Release data with recordings and ISRCs
 *
 * @example
 * const release = await getRelease('dc919562-19c7-42c8-961c-7ed5520f00bb');
 * // Returns: { id, title, media: [{ tracks: [{ recording: { isrcs: [...] } }] }] }
 */
export async function getRelease(releaseId, verbose = false) {
  if (verbose) {
    log.debug(`MusicBrainz: Fetching release ${releaseId}`);
  }

  const data = await makeRequest(`/release/${releaseId}`, {
    inc: 'recordings+isrcs',
  });

  if (verbose && data && !data.error) {
    log.debug(`MusicBrainz: Found release "${data.title}"`);
  }

  return data;
}

/**
 * Get a recording with ISRCs
 * @param {string} recordingId - MusicBrainz recording ID (MBID)
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} Recording data with ISRCs
 *
 * @example
 * const recording = await getRecording('8f3471b5-7e6a-48da-86a9-c1c07a0f47ae');
 * // Returns: { id, title, isrcs: ['GBARL8700052', ...] }
 */
export async function getRecording(recordingId, verbose = false) {
  if (verbose) {
    log.debug(`MusicBrainz: Fetching recording ${recordingId}`);
  }

  const data = await makeRequest(`/recording/${recordingId}`, { inc: 'isrcs' });

  if (verbose && data && !data.error) {
    log.debug(
      `MusicBrainz: Found recording "${data.title}" with ${data.isrcs?.length || 0} ISRC(s)`,
    );
  }

  return data;
}

/**
 * Search for recordings by artist and title
 * @param {string} artist - Artist name
 * @param {string} title - Track title
 * @param {Object} [options] - Search options
 * @param {number} [options.limit=5] - Max results to return
 * @param {boolean} [options.verbose=false] - Whether to log verbose output
 * @returns {Promise<Object|null>} Search results
 *
 * @example
 * const results = await searchRecordings('Rick Astley', 'Never Gonna Give You Up');
 * // Returns: { count, recordings: [{ id, title, artist-credit, ... }] }
 */
export async function searchRecordings(artist, title, options = {}) {
  const { limit = 5, verbose = false } = options;

  if (verbose) {
    log.debug(`MusicBrainz: Searching for "${artist}" - "${title}"`);
  }

  // Build Lucene query
  const query = `recording:"${title}" AND artistname:"${artist}"`;

  const data = await makeRequest('/recording', { query, limit });

  if (verbose && data && !data.error) {
    log.debug(`MusicBrainz: Found ${data.count || 0} recording(s)`);
  }

  return data;
}

/**
 * Get ISRCs for a Discogs release
 * Combines lookupByDiscogsRelease and getRelease to extract all ISRCs
 * @param {number|string} discogsReleaseId - Discogs release ID
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object>} Object with tracks and their ISRCs
 *
 * @example
 * const result = await getIsrcsForDiscogsRelease(249504);
 * // Returns: {
 * //   found: true,
 * //   releaseTitle: 'Never Gonna Give You Up',
 * //   tracks: [{ position: 'A', title: '...', isrcs: ['GBARL8700052', ...] }]
 * // }
 */
export async function getIsrcsForDiscogsRelease(
  discogsReleaseId,
  verbose = false,
) {
  // Step 1: Look up Discogs URL in MusicBrainz
  const urlData = await lookupByDiscogsRelease(discogsReleaseId, verbose);

  if (!urlData || urlData.error) {
    return {
      found: false,
      error: urlData?.error || 'not_found',
      tracks: [],
    };
  }

  // Step 2: Extract MusicBrainz release ID from relations
  const releaseRelation = urlData.relations?.find((r) => r.release);
  if (!releaseRelation) {
    return {
      found: false,
      error: 'no_release_linked',
      tracks: [],
    };
  }

  const mbReleaseId = releaseRelation.release.id;
  const releaseTitle = releaseRelation.release.title;

  // Step 3: Get full release with recordings and ISRCs
  const release = await getRelease(mbReleaseId, verbose);

  if (!release || release.error) {
    return {
      found: false,
      error: release?.error || 'release_fetch_failed',
      releaseTitle,
      tracks: [],
    };
  }

  // Step 4: Extract tracks with ISRCs
  const tracks = [];
  for (const medium of release.media || []) {
    for (const track of medium.tracks || []) {
      const recording = track.recording || {};
      tracks.push({
        position: track.number || track.position,
        title: track.title || recording.title,
        duration: track.length || recording.length,
        recordingId: recording.id,
        isrcs: recording.isrcs || [],
      });
    }
  }

  return {
    found: true,
    releaseTitle: release.title,
    mbReleaseId,
    tracks,
  };
}

/**
 * Search for a track and get its ISRCs
 * @param {string} artist - Artist name
 * @param {string} title - Track title
 * @param {boolean} [verbose=false] - Whether to log verbose output
 * @returns {Promise<Object>} Best match with ISRCs
 *
 * @example
 * const result = await findTrackIsrcs('Rick Astley', 'Never Gonna Give You Up');
 * // Returns: { found: true, recording: { id, title, ... }, isrcs: [...] }
 */
export async function findTrackIsrcs(artist, title, verbose = false) {
  // Search for recordings
  const searchResults = await searchRecordings(artist, title, {
    limit: 5,
    verbose,
  });

  if (
    !searchResults ||
    searchResults.error ||
    !searchResults.recordings?.length
  ) {
    return {
      found: false,
      error: searchResults?.error || 'no_results',
      isrcs: [],
    };
  }

  // Find best match (highest score with matching artist)
  const artistLower = artist.toLowerCase();
  const bestMatch =
    searchResults.recordings.find((rec) => {
      const recArtist =
        rec['artist-credit']?.[0]?.artist?.name?.toLowerCase() || '';
      return recArtist.includes(artistLower) || artistLower.includes(recArtist);
    }) || searchResults.recordings[0];

  // Get ISRCs for the best match
  const recording = await getRecording(bestMatch.id, verbose);

  if (!recording || recording.error) {
    return {
      found: true,
      recording: bestMatch,
      isrcs: [],
      error: 'isrc_fetch_failed',
    };
  }

  return {
    found: true,
    recording: {
      id: recording.id,
      title: recording.title,
      artist: bestMatch['artist-credit']?.[0]?.artist?.name,
      length: recording.length,
    },
    isrcs: recording.isrcs || [],
  };
}

/**
 * Check if a string is a valid MusicBrainz ID (MBID)
 * @param {string} id - ID to validate
 * @returns {boolean} True if valid MBID format
 */
export function isValidMbid(id) {
  const mbidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return mbidRegex.test(id);
}

// Export base URL for testing
export { MUSICBRAINZ_BASE_URL, USER_AGENT };
