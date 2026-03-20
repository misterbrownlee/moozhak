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
const MIN_REQUEST_INTERVAL = 1100;

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
 * Look up a MusicBrainz entity by external URL
 */
export async function lookupByUrl(resourceUrl, verbose = false) {
  if (verbose) log.debug(`MusicBrainz: Looking up URL ${resourceUrl}`);

  const data = await makeRequest('/url', { resource: resourceUrl });
  if (!data || data.error) return data;

  const urlId = data.id;
  if (!urlId) return null;

  const urlData = await makeRequest(`/url/${urlId}`, { inc: 'release-rels' });

  if (verbose && urlData && !urlData.error) {
    const releases = urlData.relations?.filter((r) => r.release) || [];
    log.debug(`MusicBrainz: Found ${releases.length} linked release(s)`);
  }

  return urlData;
}

/**
 * Look up a MusicBrainz release by Discogs release ID
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
 */
export async function getRelease(releaseId, verbose = false) {
  if (verbose) log.debug(`MusicBrainz: Fetching release ${releaseId}`);

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
 */
export async function getRecording(recordingId, verbose = false) {
  if (verbose) log.debug(`MusicBrainz: Fetching recording ${recordingId}`);

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
 */
export async function searchRecordings(artist, title, options = {}) {
  const { limit = 5, verbose = false } = options;

  if (verbose) log.debug(`MusicBrainz: Searching for "${artist}" - "${title}"`);

  const query = `recording:"${title}" AND artistname:"${artist}"`;
  const data = await makeRequest('/recording', { query, limit });

  if (verbose && data && !data.error) {
    log.debug(`MusicBrainz: Found ${data.count || 0} recording(s)`);
  }

  return data;
}

// ============================================
// Helper functions for complex operations
// ============================================

/**
 * Extract release ID from URL lookup data (pure function)
 */
function extractReleaseIdFromUrlData(urlData) {
  if (!urlData || urlData.error) {
    return { error: urlData?.error || 'not_found' };
  }

  const releaseRelation = urlData.relations?.find((r) => r.release);
  if (!releaseRelation) {
    return { error: 'no_release_linked' };
  }

  return {
    mbReleaseId: releaseRelation.release.id,
    releaseTitle: releaseRelation.release.title,
  };
}

/**
 * Extract tracks with ISRCs from release data (pure function)
 */
function extractTracksWithIsrcs(release) {
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

  return tracks;
}

/**
 * Find best matching recording from search results (pure function)
 */
function findBestMatchingRecording(recordings, artist) {
  const artistLower = artist.toLowerCase();

  return (
    recordings.find((rec) => {
      const recArtist =
        rec['artist-credit']?.[0]?.artist?.name?.toLowerCase() || '';
      return recArtist.includes(artistLower) || artistLower.includes(recArtist);
    }) || recordings[0]
  );
}

// ============================================
// High-level functions
// ============================================

/**
 * Get ISRCs for a Discogs release
 */
export async function getIsrcsForDiscogsRelease(
  discogsReleaseId,
  verbose = false,
) {
  const urlData = await lookupByDiscogsRelease(discogsReleaseId, verbose);
  const releaseInfo = extractReleaseIdFromUrlData(urlData);

  if (releaseInfo.error) {
    return { found: false, error: releaseInfo.error, tracks: [] };
  }

  const { mbReleaseId, releaseTitle } = releaseInfo;
  const release = await getRelease(mbReleaseId, verbose);

  if (!release || release.error) {
    return {
      found: false,
      error: release?.error || 'release_fetch_failed',
      releaseTitle,
      tracks: [],
    };
  }

  return {
    found: true,
    releaseTitle: release.title,
    mbReleaseId,
    tracks: extractTracksWithIsrcs(release),
  };
}

/**
 * Search for a track and get its ISRCs
 */
export async function findTrackIsrcs(artist, title, verbose = false) {
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

  const bestMatch = findBestMatchingRecording(searchResults.recordings, artist);
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
 */
export function isValidMbid(id) {
  const mbidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return mbidRegex.test(id);
}

export { MUSICBRAINZ_BASE_URL, USER_AGENT };
