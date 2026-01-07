import { getMaster, getRelease, formatTrack, buildDiscogsUrl } from '../discogs.js';
import { writeJsonOutput, writeTracksOutput } from '../output.js';
import { log } from '../logger.js';

/**
 * Format-specific header lines for track output
 * null = no static header (human format uses dynamic header with track count)
 */
const FORMAT_HEADERS = {
  human: null,
  csv: ['position,title,duration'],
  pipe: null,
  markdown: [
    '| Position | Title | Duration |',
    '|----------|-------|----------|',
  ],
};

/**
 * Get header lines for a given format
 * @param {string} format - Output format
 * @returns {string[]} Header lines (empty array if none)
 */
function getFormatHeader(format) {
  return FORMAT_HEADERS[format] || [];
}

/**
 * Extract release info from API response (pure function)
 * @param {Object} data - API response data
 * @param {string} type - 'master' or 'release'
 * @param {number} id - Resource ID
 * @returns {Object} Extracted release info
 */
export function extractReleaseInfo(data, type, id) {
  return {
    artists: data.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
    title: data.title || 'Untitled',
    year: data.year || null,
    url: buildDiscogsUrl(type, id),
    tracklist: data.tracklist || [],
  };
}

/**
 * Build tracks output JSON structure (pure function)
 * @param {string} type - 'master' or 'release'
 * @param {number} id - Resource ID
 * @param {Object} releaseInfo - Extracted release info
 * @returns {Object} Structured output for JSON file
 */
export function buildTracksOutput(type, id, releaseInfo) {
  const { artists, title, year, url, tracklist } = releaseInfo;
  
  return {
    type: 'tracks',
    params: {
      sourceType: type,
      id: id
    },
    result: {
      artist: artists,
      title: title,
      year: year,
      url: url,
      tracks: tracklist.map((track, idx) => ({
        position: track.position || String(idx + 1),
        title: track.title || '',
        duration: track.duration || '',
        type_: track.type_ || 'track'
      }))
    }
  };
}

/**
 * Parse tracks command arguments
 * @param {string[]} args - Command arguments
 * @param {string} defaultType - Default tracks type from session
 * @returns {{ type?: string, id?: string, error?: string, hint?: string }}
 */
export function parseTracksArgs(args, defaultType) {
  if (args.length === 0) {
    return { error: 'Please provide an ID', hint: 'Usage: tracks <id> or tracks <master|release> <id>' };
  }

  // Check if first arg is numeric (just an ID)
  if (args.length === 1 || !isNaN(parseInt(args[0], 10))) {
    return { type: defaultType, id: args[0] };
  }

  // Type and ID provided
  const type = args[0].toLowerCase();
  if (type !== 'master' && type !== 'release') {
    return { error: `Invalid type '${args[0]}'`, hint: 'Valid types: master, release' };
  }

  return { type, id: args[1] };
}

/**
 * Tracks command definition
 */
export const tracksCommand = {
  name: 'tracks',
  aliases: ['t'],
  minArgs: 1,
  usage: 'tracks [type] <id>',
  description: 'Get tracklist from a master or release',
  handler: async (args, ctx) => {
    const { type, id, error, hint } = parseTracksArgs(args, ctx.sessionFlags.tracks_type);
    if (error) {
      log.error(error);
      if (hint) log.info(hint);
      return true;
    }
    await handleTracks(ctx.db, type, id, ctx.sessionFlags);
    return true;
  },
};

/**
 * Handle tracks command - fetch tracklist from a master or release
 * @param {Object} db - Discogs database instance
 * @param {string} tracksSearchType - 'master' or 'release'
 * @param {string} id - Master or release ID
 * @param {Object} flags - CLI flags
 */
export async function handleTracks(db, tracksSearchType, id, flags) {
  const numId = parseInt(id, 10);
  
  if (isNaN(numId)) {
    log.error('Invalid ID. Please provide a numeric ID.');
    return;
  }

  const outputFormat = flags.tracks_output || 'human';
  log.plain('');
  log.info(`tracks search type: ${tracksSearchType}`);
  log.info(`output format: ${outputFormat}`);
  log.info(`Fetching ${tracksSearchType} #${numId} from Discogs...`);
  
  // Fetch data from API
  const data = tracksSearchType === 'master'
    ? await getMaster(db, numId, flags.verbose)
    : await getRelease(db, numId, flags.verbose);
  
  if (!data) {
    log.warn(`Could not fetch ${tracksSearchType} #${numId}.`);
    return;
  }

  // Extract release info and build output
  const releaseInfo = extractReleaseInfo(data, tracksSearchType, numId);
  const { artists, title, year, url, tracklist } = releaseInfo;
  
  // Display results header
  log.success(`Found: ${tracksSearchType} #${numId} - ${artists} - ${title}${year ? ` (${year})` : ''}`);
  log.info(`See: ${url}`);
  
  if (tracklist.length === 0) {
    log.warn('No tracks found.');
  } else {
    displayTracklist(tracklist, outputFormat);
    writeTracksOutput(formatTracksForFile(tracklist, outputFormat), numId, outputFormat, artists, title);
  }
  
  // Write JSON output
  const output = buildTracksOutput(tracksSearchType, numId, releaseInfo);
  writeJsonOutput(output);
}

/**
 * Display tracklist to console
 * @param {Array} tracklist - Track list from API
 * @param {string} format - Output format
 */
function displayTracklist(tracklist, format) {
  log.divider(true);
  
  // Human format gets dynamic header with track count
  if (format === 'human') {
    log.header(`Tracklist (${tracklist.length} tracks):\n`);
  } else {
    getFormatHeader(format).forEach(line => log.plain(line));
  }
  
  tracklist.forEach((track, idx) => {
    log.plain(formatTrack(track, idx, format));
  });
  
  log.plain('');
  log.divider();
  log.plain('');
}

/**
 * Format tracklist for file output
 * @param {Array} tracklist - Track list from API
 * @param {string} format - Output format
 * @returns {string} Formatted content for file
 */
function formatTracksForFile(tracklist, format) {
  const lines = [...getFormatHeader(format)];
  
  tracklist.forEach((track, idx) => {
    lines.push(formatTrack(track, idx, format));
  });
  
  return lines.join('\n');
}
