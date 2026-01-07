import { getMaster, getRelease, formatTrack } from '../discogs.js';
import { writeJsonOutput, writeTracksOutput } from '../output.js';
import { log } from '../logger.js';

/**
 * Parse tracks command arguments
 * @param {string[]} args - Command arguments
 * @param {string} defaultType - Default tracks type from session
 * @returns {{ type?: string, id?: string, error?: string, hint?: string }}
 */
function parseTracksArgs(args, defaultType) {
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
 * @param {number} id - Master or release ID
 * @param {Object} flags - CLI flags
 */
export { parseTracksArgs };

export async function handleTracks(db, tracksSearchType, id, flags) {
  const numId = parseInt(id, 10);
  
  if (isNaN(numId)) {
    log.error('Invalid ID. Please provide a numeric ID.');
    return;
  }

  const outputFormat = flags.tracks_output || 'human';
  log.plain('')
  log.info(`tracks search type: ${tracksSearchType}`);
  log.info(`output format: ${outputFormat}`);
  log.info(`Fetching ${tracksSearchType} #${numId} from Discogs...`);
  
  let data;
  if (tracksSearchType === 'master') {
    data = await getMaster(db, numId, flags.verbose);
  } else {
    data = await getRelease(db, numId, flags.verbose);
  }
  
  if (!data) {
    log.warn(`Could not fetch ${tracksSearchType} #${numId}.`);
    return;
  }

  const tracklist = data.tracklist || [];
  const artists = data.artists?.map(a => a.name).join(', ') || 'Unknown Artist';
  const title = data.title || 'Untitled';
  const year = data.year || null;
  const url = tracksSearchType === 'master' 
    ? `https://www.discogs.com/master/${numId}`
    : `https://www.discogs.com/release/${numId}`;

  // Build JSON output
  const output = {
    type: 'tracks',
    params: {
      sourceType: tracksSearchType,
      id: numId
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
  
  // Display results
  log.success(`Found: ${tracksSearchType} #${numId} - ${artists} - ${title}${year ? ` (${year})` : ''}`);
  log.info(`See: ${url}`);
  
  if (tracklist.length === 0) {
    log.warn('No tracks found.');
  } else {
    const lines = [];

    log.divider(true);
    
    if (outputFormat === 'human') {
      log.header(`Tracklist (${tracklist.length} tracks):\n`);
    } else if (outputFormat === 'csv') {
      const header = 'position,title,duration';
      log.plain(header);
      lines.push(header);
    } else if (outputFormat === 'markdown') {
      const header1 = '| Position | Title | Duration |';
      const header2 = '|----------|-------|----------|';
      log.plain(header1);
      log.plain(header2);
      lines.push(header1, header2);
    }
    
    // Display and collect tracks
    tracklist.forEach((track, idx) => {
      const line = formatTrack(track, idx, outputFormat);
      log.plain(line);
      lines.push(line);
    });
    log.plain('');
    log.divider();
    log.plain('');
    
    // Write tracks file
    writeTracksOutput(lines.join('\n'), numId, outputFormat, artists, title);
  }
  
  // Write JSON output
  writeJsonOutput(output);
}

