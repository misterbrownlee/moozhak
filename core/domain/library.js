/**
 * Pure library domain transforms (track grouping, box sets, BPM merge).
 * Safe for reuse from server, tests, and browser (synced copy in web/public).
 */

/**
 * @param {unknown} track
 * @returns {string}
 */
export function formatTrackArtistCredit(track) {
  if (!track || typeof track !== 'object') return '';
  if (typeof track.trackArtist === 'string' && track.trackArtist.trim()) {
    return track.trackArtist.trim();
  }
  const artists = track.artists;
  if (!Array.isArray(artists) || artists.length === 0) return '';
  return artists
    .map((a) => (a && typeof a.name === 'string' ? a.name.trim() : ''))
    .filter(Boolean)
    .join(', ');
}

/**
 * @param {unknown} track
 * @param {unknown} albumArtist
 * @returns {string}
 */
export function resolveTrackRowArtist(track, albumArtist) {
  const credit = formatTrackArtistCredit(track);
  if (credit) return credit;
  const album = String(albumArtist ?? '').trim();
  if (album) return album;
  return 'Unknown Artist';
}

/**
 * @param {Record<string, unknown>|null|undefined} discogsBody
 * @returns {boolean}
 */
export function isCompilationRelease(discogsBody) {
  if (!discogsBody || typeof discogsBody !== 'object') return false;
  const formats = discogsBody.formats;
  if (Array.isArray(formats)) {
    for (const f of formats) {
      if (!f || typeof f !== 'object') continue;
      const desc = f.descriptions;
      if (Array.isArray(desc)) {
        for (const d of desc) {
          if (typeof d === 'string' && d.toLowerCase().includes('compilation')) {
            return true;
          }
        }
      }
    }
  }
  for (const key of ['genres', 'styles']) {
    const arr = discogsBody[key];
    if (Array.isArray(arr)) {
      for (const g of arr) {
        if (
          typeof g === 'string' &&
          g.toLowerCase().includes('compilation')
        ) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * @param {Record<string, unknown>} track
 * @returns {Record<string, unknown>}
 */
export function enrichTrackWithArtistCredit(track) {
  const credit = formatTrackArtistCredit(track);
  const out = { ...track };
  if (credit) out.trackArtist = credit;
  return out;
}

/**
 * @param {Record<string, unknown>} item
 * @param {Record<string, unknown>} release Discogs getRelease JSON
 * @returns {Record<string, unknown>}
 */
export function mergeLibraryItemFromDiscogsRelease(item, release) {
  if (!item || typeof item !== 'object') return item;
  if (!release || typeof release !== 'object') return { ...item };

  const next = { ...item };
  const formats = release.formats;
  const formatStr = Array.isArray(formats)
    ? formats.map((f) => (f && f.name ? f.name : '')).filter(Boolean).join(', ')
    : '';
  const images = release.images;
  const firstImg = Array.isArray(images) && images[0] ? images[0] : null;
  const cover =
    (firstImg && typeof firstImg.uri === 'string' && firstImg.uri) ||
    (typeof release.thumb === 'string' && release.thumb) ||
    next.cover ||
    '';
  const thumb =
    (firstImg && typeof firstImg.uri150 === 'string' && firstImg.uri150) ||
    (typeof release.thumb === 'string' && release.thumb) ||
    cover ||
    next.thumb ||
    '';

  if (typeof release.title === 'string' && release.title) next.title = release.title;
  if (release.year != null && release.year !== '') next.year = String(release.year);
  if (formatStr) next.format = formatStr;
  next.thumb = thumb;
  next.cover = cover;
  next.compilation = isCompilationRelease(release);
  next.type = 'release';
  if (release.id != null) next.discogsId = release.id;
  if (release.master_id != null && release.master_id !== '') {
    const m = Number(release.master_id);
    if (Number.isFinite(m)) next.masterDiscogsId = m;
  }

  const remoteList = release.tracklist;
  if (!Array.isArray(remoteList) || remoteList.length === 0) {
    return next;
  }

  const localFlat = extractTracksFromSides(item.sides);
  const consumed = new Set();

  /**
   * @param {string} pos
   * @param {string} titleLower
   * @returns {number}
   */
  function findLocalIndex(pos, titleLower) {
    const p = pos.trim();
    if (p) {
      for (let i = 0; i < localFlat.length; i++) {
        if (consumed.has(i)) continue;
        const lt = localFlat[i];
        if (String(lt?.position ?? '').trim() === p) return i;
      }
    }
    if (titleLower) {
      for (let i = 0; i < localFlat.length; i++) {
        if (consumed.has(i)) continue;
        const lt = localFlat[i];
        const t = String(lt?.title ?? '')
          .trim()
          .toLowerCase();
        if (t && t === titleLower) return i;
      }
    }
    return -1;
  }

  const mergedTracklist = [];
  for (const entry of remoteList) {
    if (!entry || typeof entry !== 'object') continue;
    const type_ = entry.type_;
    if (type_ === 'heading') {
      mergedTracklist.push({ ...entry });
      continue;
    }
    const pos = String(entry.position ?? '').trim();
    const titleLower = String(entry.title ?? '')
      .trim()
      .toLowerCase();
    const li = findLocalIndex(pos, titleLower);
    const local = li >= 0 ? localFlat[li] : null;
    if (li >= 0) consumed.add(li);

    const credit = formatTrackArtistCredit(entry);
    /** @type {Record<string, unknown>} */
    const merged = {
      ...entry,
      ...(credit ? { trackArtist: credit } : {}),
    };
    if (local && typeof local === 'object') {
      if (Object.prototype.hasOwnProperty.call(local, 'bpm')) {
        merged.bpm = local.bpm;
      }
      if (Object.prototype.hasOwnProperty.call(local, 'key')) {
        merged.key = local.key;
      }
      if (Object.prototype.hasOwnProperty.call(local, 'timeSignature')) {
        merged.timeSignature = local.timeSignature;
      }
      if (Object.prototype.hasOwnProperty.call(local, 'openKey')) {
        merged.openKey = local.openKey;
      }
    }
    mergedTracklist.push(merged);
  }

  for (let i = 0; i < localFlat.length; i++) {
    if (!consumed.has(i)) {
      mergedTracklist.push({ ...localFlat[i] });
    }
  }

  next.sides = groupTracksBySide(mergedTracklist);
  return next;
}

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
 * @returns {number|undefined}
 */
export function resolveMasterDiscogsIdFromBody(body) {
  if (!body || typeof body !== 'object') return undefined;
  if (body.masterDiscogsId != null && body.masterDiscogsId !== '') {
    const n = Number(body.masterDiscogsId);
    return Number.isFinite(n) ? n : undefined;
  }
  if (body.master_id != null && body.master_id !== '') {
    const n = Number(body.master_id);
    return Number.isFinite(n) ? n : undefined;
  }
  return undefined;
}

/**
 * Build POST-shaped library body from a Discogs getRelease JSON (server add path).
 * @param {Record<string, unknown>} release
 * @returns {Record<string, unknown>}
 */
export function libraryPostBodyFromDiscogsRelease(release) {
  if (!release || typeof release !== 'object') {
    throw new Error('release required');
  }
  const artists = Array.isArray(release.artists)
    ? release.artists
        .map((a) => (a && typeof a.name === 'string' ? a.name : ''))
        .filter(Boolean)
        .join(', ')
    : '';
  const formats = Array.isArray(release.formats)
    ? release.formats
        .map((f) => (f && f.name ? f.name : ''))
        .filter(Boolean)
        .join(', ')
    : '';
  const images = release.images;
  const firstImg = Array.isArray(images) && images[0] ? images[0] : null;
  const cover =
    (firstImg && typeof firstImg.uri === 'string' && firstImg.uri) ||
    (typeof release.thumb === 'string' && release.thumb) ||
    '';
  const thumb =
    (firstImg && typeof firstImg.uri150 === 'string' && firstImg.uri150) ||
    (typeof release.thumb === 'string' && release.thumb) ||
    cover;

  const masterDiscogsId = resolveMasterDiscogsIdFromBody(
    /** @type {Record<string, unknown>} */ (release),
  );

  /** @type {Record<string, unknown>} */
  const out = {
    discogsId: release.id,
    type: 'release',
    title: release.title || 'Unknown Title',
    artist: artists || 'Unknown Artist',
    year: release.year != null ? String(release.year) : '',
    format: formats,
    thumb,
    cover,
    tracklist: release.tracklist || [],
    compilation: isCompilationRelease(release),
  };
  if (masterDiscogsId != null) {
    out.masterDiscogsId = masterDiscogsId;
  }
  return out;
}

/**
 * @param {Record<string, unknown>} body
 * @param {string|null} [boxSetTitle]
 * @returns {Record<string, unknown>}
 */
export function normalizeLibraryItem(body, boxSetTitle = null) {
  const rawList = body.tracklist || [];
  const tracklist = rawList.map((t) =>
    t && typeof t === 'object' ? enrichTrackWithArtistCredit(t) : t,
  );

  let compilation;
  if (typeof body.compilation === 'boolean') {
    compilation = body.compilation;
  } else {
    compilation = isCompilationRelease(body);
  }

  const itemType = body.type || 'release';
  const masterDiscogsId = resolveMasterDiscogsIdFromBody(body);

  /** @type {Record<string, unknown>} */
  const item = {
    discogsId: body.discogsId,
    type: itemType,
    title: body.title,
    artist: body.artist || 'Unknown Artist',
    year: body.year || '',
    format: body.format || '',
    thumb: body.thumb || '',
    cover: body.cover || body.thumb || '',
    sides: groupTracksBySide(tracklist),
    notes: body.notes || '',
    compilation,
  };

  if (itemType === 'release' && masterDiscogsId != null) {
    item.masterDiscogsId = masterDiscogsId;
  }

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

  const boxCompilation =
    typeof body.compilation === 'boolean'
      ? body.compilation
      : isCompilationRelease(body);

  const masterDiscogsId = resolveMasterDiscogsIdFromBody(body);

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
        compilation: boxCompilation,
        ...(masterDiscogsId != null ? { masterDiscogsId } : {}),
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

/**
 * Parse track BPM for edit/save: empty → null, finite number or numeric string → number, else invalid.
 * @param {unknown} raw
 * @returns {{ valid: false } | { valid: true, value: number | null }}
 */
export function parseTrackBpm(raw) {
  if (raw == null || raw === '') return { valid: true, value: null };
  if (typeof raw === 'number') {
    return Number.isFinite(raw) ? { valid: true, value: raw } : { valid: false };
  }
  const s = String(raw).trim();
  if (s === '') return { valid: true, value: null };
  const n = Number(s);
  if (!Number.isFinite(n)) return { valid: false };
  return { valid: true, value: n };
}

/**
 * Coerce stored track BPM to a finite number for sorting/stats, or null if missing/invalid.
 * @param {unknown} raw
 * @returns {number|null}
 */
export function numericBpmOrNull(raw) {
  const p = parseTrackBpm(raw);
  if (!p.valid || p.value == null) return null;
  return p.value;
}

/**
 * Comparable value for BPM column sort (library UI). Missing/invalid sort to end for both directions.
 * @param {unknown} raw
 * @param {boolean} ascending
 * @returns {number}
 */
export function bpmSortComparable(raw, ascending) {
  const n = numericBpmOrNull(raw);
  if (n != null) return n;
  return ascending ? Infinity : -Infinity;
}

/**
 * BPM value suitable for JSON persistence: finite number or null (invalid/empty).
 * @param {unknown} raw
 * @returns {number|null}
 */
export function normalizeStoredBpmValue(raw) {
  const p = parseTrackBpm(raw);
  if (!p.valid) return null;
  return p.value;
}

/**
 * Mutates library item `sides[].tracks[].bpm` to normalized number|null.
 * @param {Record<string, unknown>} item
 * @returns {boolean} true if any track was updated
 */
export function normalizeLibraryItemTrackBpms(item) {
  if (!item || typeof item !== 'object') return false;
  const sides = item.sides;
  if (!Array.isArray(sides)) return false;
  let changed = false;
  for (const side of sides) {
    if (!side || typeof side !== 'object') continue;
    const tracks = side.tracks;
    if (!Array.isArray(tracks)) continue;
    for (const track of tracks) {
      if (!track || typeof track !== 'object') continue;
      if (!Object.prototype.hasOwnProperty.call(track, 'bpm')) continue;
      const before = track.bpm;
      const next = normalizeStoredBpmValue(before);
      if (!Object.is(before, next)) {
        track.bpm = next;
        changed = true;
      }
    }
  }
  return changed;
}

/**
 * Mutates setlist `tracks[].bpm` to normalized number|null.
 * @param {Record<string, unknown>} doc
 * @returns {boolean} true if any track was updated
 */
export function normalizeSetlistTrackBpms(doc) {
  if (!doc || typeof doc !== 'object') return false;
  const tracks = doc.tracks;
  if (!Array.isArray(tracks)) return false;
  let changed = false;
  for (const track of tracks) {
    if (!track || typeof track !== 'object') continue;
    if (!Object.prototype.hasOwnProperty.call(track, 'bpm')) continue;
    const before = track.bpm;
    const next = normalizeStoredBpmValue(before);
    if (!Object.is(before, next)) {
      track.bpm = next;
      changed = true;
    }
  }
  return changed;
}
