import { getMaster, getRelease, formatTrack } from '../discogs.js';
import { writeJsonOutput, writeTracksOutput } from '../output.js';
import { log } from '../logger.js';

/**
 * Handle tracks command - fetch tracklist from a master or release
 * @param {Object} db - Discogs database instance
 * @param {string} tracksSearchType - 'master' or 'release'
 * @param {number} id - Master or release ID
 * @param {Object} flags - CLI flags
 */
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

