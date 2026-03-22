/**
 * Pure set / setlist domain helpers (library-backed tracks, stats, thumbnails).
 * Server-only; not copied to moozhak-domain.js by default.
 */

import { extractTracksFromSides, parseTrackBpm } from './library.js';

/** @typedef {{ id: string, name?: string, tracks?: unknown[] }} SetDocument */

export const SET_NOTES_MAX_LENGTH = 300;

/**
 * @param {string|undefined|null} libraryItemId
 * @param {string|undefined|null} trackPosition
 * @returns {string}
 */
export function trackMembershipKey(libraryItemId, trackPosition) {
  return `${String(libraryItemId)}::${String(trackPosition ?? '').trim()}`;
}

/**
 * @param {SetDocument[]} sets
 * @returns {Set<string>}
 */
export function buildTrackSetMembershipIndex(sets) {
  const index = new Set();
  if (!sets?.length) return index;
  for (const s of sets) {
    const tracks = s.tracks || [];
    for (const t of tracks) {
      const lid = t.libraryItemId;
      if (lid == null || lid === '') continue;
      index.add(trackMembershipKey(lid, t.trackPosition));
    }
  }
  return index;
}

/**
 * @param {SetDocument[]} sets
 * @param {string} libraryItemId
 * @returns {{ id: string, name: string }[]}
 */
export function findSetsReferencingLibraryItemId(sets, libraryItemId) {
  const want = String(libraryItemId);
  const out = [];
  const seen = new Set();
  if (!sets?.length) return out;
  for (const s of sets) {
    if (!s?.id || seen.has(s.id)) continue;
    const tracks = s.tracks || [];
    for (const t of tracks) {
      if (String(t.libraryItemId) === want) {
        seen.add(s.id);
        out.push({
          id: s.id,
          name:
            typeof s.name === 'string' && s.name.trim()
              ? s.name.trim()
              : 'Untitled set',
        });
        break;
      }
    }
  }
  return out;
}

/**
 * Ordered unique album thumb URLs from track snapshots (first occurrence per libraryItemId).
 * @param {Array<{ libraryItemId?: string, thumb?: string, cover?: string }>} tracks
 * @returns {string[]}
 */
export function orderedUniqueAlbumThumbUrls(tracks) {
  const seen = new Set();
  const urls = [];
  if (!tracks?.length) return urls;
  for (const t of tracks) {
    const lid = t.libraryItemId;
    if (lid == null || lid === '' || seen.has(lid)) continue;
    const url = String(t.thumb || t.cover || '').trim();
    if (!url) continue;
    seen.add(lid);
    urls.push(url);
  }
  return urls;
}

/**
 * @param {Array<{ libraryItemId?: string, thumb?: string, cover?: string }>} tracks
 * @param {() => number} [rng] returns [0, 1)
 * @returns {string[]}
 */
export function pickSetThumbUrls(tracks, rng = Math.random) {
  const n = tracks?.length ?? 0;
  if (n < 4) return [];
  const urls = orderedUniqueAlbumThumbUrls(tracks);
  if (urls.length < 4) return [];
  if (n >= 10) {
    const copy = [...urls];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = copy[i];
      copy[i] = copy[j];
      copy[j] = tmp;
    }
    return copy.slice(0, 4);
  }
  return urls.slice(0, 4);
}

/**
 * @param {Array<{ bpm?: number|string|null }>} tracks
 * @returns {{ trackCount: number, bpmMin: number|null, bpmMax: number|null, bpmAverage: number|null }}
 */
export function calculateSetStats(tracks) {
  const trackCount = tracks?.length ?? 0;
  const bpms = (tracks || [])
    .map((t) => parseTrackBpm(t.bpm))
    .filter((p) => p.valid && p.value != null)
    .map((p) => p.value);
  if (bpms.length === 0) {
    return {
      trackCount,
      bpmMin: null,
      bpmMax: null,
      bpmAverage: null,
    };
  }
  const sum = bpms.reduce((a, b) => a + b, 0);
  return {
    trackCount,
    bpmMin: Math.min(...bpms),
    bpmMax: Math.max(...bpms),
    bpmAverage: Math.round((sum / bpms.length) * 10) / 10,
  };
}

/**
 * @param {Record<string, unknown>} item library item with id, sides, title, artist, discogsId, thumb, cover
 * @param {string} trackPosition
 * @returns {Record<string, unknown>|null}
 */
export function denormalizeTrackFromLibraryItem(item, trackPosition) {
  if (!item || !item.id) return null;
  const tracks = extractTracksFromSides(item.sides);
  const posNorm = String(trackPosition ?? '').trim();
  const track =
    tracks.find((tr) => String(tr.position ?? '').trim() === posNorm) || null;
  const t = track || {};
  return {
    libraryItemId: item.id,
    trackPosition: t.position != null ? t.position : trackPosition,
    discogsId: item.discogsId,
    title: t.title || 'Untitled',
    artist: item.artist || 'Unknown Artist',
    albumTitle: item.title || '',
    bpm: t.bpm ?? null,
    key: t.key ?? null,
    duration: t.duration || '',
    timeSignature: t.timeSignature ?? null,
    openKey: t.openKey ?? null,
    thumb: item.thumb || '',
    cover: item.cover || item.thumb || '',
  };
}

/**
 * @param {Record<string, unknown>[]} items
 * @returns {Record<string, unknown>[]}
 */
export function flattenLibraryToTrackRows(items) {
  if (!items?.length) return [];
  const rows = [];
  for (const item of items) {
    const tracks = extractTracksFromSides(item.sides);
    for (const t of tracks) {
      rows.push({
        libraryItemId: item.id,
        position: t.position ?? '',
        albumTitle: item.title || '',
        artist: item.artist || 'Unknown Artist',
        trackTitle: t.title || 'Untitled',
        bpm: t.bpm ?? null,
        key: t.key ?? null,
        duration: t.duration || '',
        discogsId: item.discogsId,
        thumb: item.thumb || '',
        cover: item.cover || item.thumb || '',
      });
    }
  }
  return rows;
}

/**
 * @param {string|undefined|null} notes
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
export function validateSetNotes(notes) {
  if (notes == null || notes === '') return { ok: true, value: '' };
  const t = String(notes).trim();
  if (t.length > SET_NOTES_MAX_LENGTH) {
    return {
      ok: false,
      error: `notes must be at most ${SET_NOTES_MAX_LENGTH} characters`,
    };
  }
  return { ok: true, value: t };
}
