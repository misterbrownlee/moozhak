/**
 * Pure library domain transforms (track grouping, box sets, BPM merge).
 * Safe for reuse from server, tests, and browser (synced copy in web/public).
 */

/**
 * @param {string} position
 * @returns {string}
 */
export function getTrackSide(position) {
  if (!position) return '';
  const match = String(position).match(/^([A-Za-z]+)/);
  return match ? match[1].toUpperCase() : '';
}

/**
 * @param {Array<{ position?: string }>} tracklist
 * @returns {Array<{ label: string, tracks: unknown[] }>}
 */
export function groupTracksBySide(tracklist) {
  if (!tracklist || tracklist.length === 0) return [];

  const sides = [];
  let currentSide = null;
  let currentTracks = [];

  for (const track of tracklist) {
    const side = getTrackSide(track.position);

    if (side !== currentSide) {
      if (currentTracks.length > 0) {
        sides.push({ label: currentSide || '', tracks: currentTracks });
      }
      currentSide = side;
      currentTracks = [track];
    } else {
      currentTracks.push(track);
    }
  }

  if (currentTracks.length > 0) {
    sides.push({ label: currentSide || '', tracks: currentTracks });
  }

  return sides;
}

/**
 * @param {string|Array|unknown} format
 * @returns {boolean}
 */
export function isBoxSet(format) {
  if (!format) return false;
  const formatStr =
    typeof format === 'string' ? format : JSON.stringify(format);
  return formatStr.toLowerCase().includes('box set');
}

/**
 * @param {Array<{ type_?: string, title?: string }>} tracklist
 * @returns {Array<{ title: string, tracks: unknown[] }>}
 */
export function parseBoxSetAlbums(tracklist) {
  if (!tracklist || tracklist.length === 0) return [];

  const albums = [];
  let currentAlbum = null;
  let currentTracks = [];

  for (const track of tracklist) {
    if (track.type_ === 'heading') {
      if (currentAlbum && currentTracks.length > 0) {
        albums.push({ title: currentAlbum, tracks: currentTracks });
      }
      currentAlbum = track.title;
      currentTracks = [];
    } else if (track.type_ === 'track' || !track.type_) {
      currentTracks.push(track);
    }
  }

  if (currentAlbum && currentTracks.length > 0) {
    albums.push({ title: currentAlbum, tracks: currentTracks });
  }

  return albums;
}

/**
 * @param {Record<string, unknown>} body
 * @param {string|null} [boxSetTitle]
 * @returns {Record<string, unknown>}
 */
export function normalizeLibraryItem(body, boxSetTitle = null) {
  const tracklist = body.tracklist || [];

  const item = {
    discogsId: body.discogsId,
    type: body.type || 'release',
    title: body.title,
    artist: body.artist || 'Unknown Artist',
    year: body.year || '',
    format: body.format || '',
    thumb: body.thumb || '',
    cover: body.cover || body.thumb || '',
    sides: groupTracksBySide(tracklist),
    notes: body.notes || '',
  };

  if (boxSetTitle) {
    item.boxSet = boxSetTitle;
  }

  return item;
}

/**
 * @param {Record<string, unknown>} body
 * @returns {Record<string, unknown>[]}
 */
export function createBoxSetItems(body) {
  const albums = parseBoxSetAlbums(body.tracklist || []);

  if (albums.length === 0) {
    return [normalizeLibraryItem(body)];
  }

  const boxSetTitle = body.title;

  return albums.map((album) => {
    return normalizeLibraryItem(
      {
        discogsId: body.discogsId,
        type: body.type || 'release',
        title: album.title,
        artist: body.artist,
        year: body.year,
        format: body.format,
        thumb: body.thumb,
        tracklist: album.tracks,
        notes: body.notes || '',
      },
      boxSetTitle,
    );
  });
}

/**
 * @param {Array<{ tracks?: unknown[] }>|null|undefined} sides
 * @returns {unknown[]}
 */
export function extractTracksFromSides(sides) {
  if (!sides || !Array.isArray(sides)) return [];
  return sides.flatMap((side) => side.tracks || []);
}

/**
 * @param {Array<{ label: string, tracks: unknown[] }>} sides
 * @param {Array<{ position?: string, title?: string, found?: boolean, bpm?: number, key?: string, timeSignature?: string, openKey?: string }>} bpmTracks
 * @returns {Array<{ label: string, tracks: unknown[] }>}
 */
export function mergeBpmIntoSides(sides, bpmTracks) {
  if (!sides || !bpmTracks) return sides;

  const bpmMap = new Map();
  for (const track of bpmTracks) {
    const key = track.position || track.title;
    bpmMap.set(key, track);
  }

  return sides.map((side) => ({
    ...side,
    tracks: (side.tracks || []).map((track) => {
      const bpmData = bpmMap.get(track.position) || bpmMap.get(track.title);
      if (bpmData?.found) {
        return {
          ...track,
          bpm: bpmData.bpm,
          key: bpmData.key,
          timeSignature: bpmData.timeSignature,
          openKey: bpmData.openKey,
        };
      }
      return track;
    }),
  }));
}
