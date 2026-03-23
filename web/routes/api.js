import express from 'express';
import {
  createBoxSetItems,
  extractTracksFromSides,
  isBoxSet,
  mergeBpmIntoSides,
  mergeLibraryItemFromDiscogsRelease,
  normalizeLibraryItem,
} from '../../core/domain/library.js';
import {
  calculateSetStats,
  denormalizeTrackFromLibraryItem,
  findSetsContainingTrack,
  findSetsReferencingLibraryItemId,
  pickSetThumbUrls,
  validateSetNotes,
} from '../../core/domain/setlists.js';
import {
  getCollection,
  getMaster,
  getRelease,
  searchDiscogs,
} from '../../core/services/discogs.js';
import {
  findBpm,
  isConfigured as isBpmConfigured,
  lookupAlbumBpm,
} from '../../core/services/getsongbpm.js';
import {
  APP_SETTING_KEYS,
  getSettingsEditorShape,
  resolveDiscogsUsernameFromRequest,
  resolveGetSongBpmApiKeyFromRequest,
  setAppSettings,
} from '../lib/appSettings.js';
import {
  getCollectionMetadata,
  getCollectionReleases,
  hasCollection,
  loadCollection,
  replaceCollectionPayload,
  saveCollection,
} from '../lib/collection.js';
import { getDiscogsContext } from '../lib/discogsRuntime.js';
import {
  addToLibrary,
  buildLibraryData,
  getLibraryItem,
  loadLibrary,
  removeFromLibrary,
  replaceLibraryItems,
  updateLibraryItem,
} from '../lib/library.js';
import {
  addSetlist,
  generateSetlistId,
  getSetlist,
  loadSetlists,
  removeSetlist,
  updateSetlist,
} from '../lib/setlists.js';
import { logUserAction } from '../lib/webLogger.js';

const router = express.Router();

router.use((req, _res, next) => {
  req.discogs = getDiscogsContext(req);
  next();
});

// ============================================
// Error Handling Utilities
// ============================================

/**
 * Log error and send standardized response
 */
function handleError(res, error, message, statusCode = 500) {
  console.error(`${message}:`, error.message || error);
  res.status(statusCode).json({ error: message });
}

/**
 * Wrap async route handler with error handling
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      handleError(res, error, 'Internal server error');
    });
  };
}

// ============================================
// Validation Functions
// ============================================

/**
 * Validate search query params
 */
function validateSearchQuery(query) {
  if (!query) {
    return { valid: false, error: 'Query parameter "q" is required' };
  }
  return { valid: true };
}

/**
 * Validate library item for creation
 */
function validateLibraryItem(body) {
  const { discogsId, title } = body;
  if (!discogsId || !title) {
    return { valid: false, error: 'discogsId and title are required' };
  }
  return { valid: true };
}

// ============================================
// Search Routes
// ============================================

router.get(
  '/search',
  asyncHandler(async (req, res) => {
    const { q, limit = 20 } = req.query;
    const validation = validateSearchQuery(q);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    const { db, isAuthenticated } = req.discogs;
    const results = await searchDiscogs(db, q, {
      type: 'master',
      format: 'Vinyl',
      limit: parseInt(limit, 10),
      isAuthenticated,
    });

    res.json({ results });
  }),
);

router.get(
  '/release/:id',
  asyncHandler(async (req, res) => {
    const { db, isAuthenticated } = req.discogs;
    const release = await getRelease(db, parseInt(req.params.id, 10), {
      isAuthenticated,
    });

    if (!release) {
      return res.status(404).json({ error: 'Release not found' });
    }

    res.json(release);
  }),
);

router.get(
  '/master/:id',
  asyncHandler(async (req, res) => {
    const { db, isAuthenticated } = req.discogs;
    const master = await getMaster(db, parseInt(req.params.id, 10), {
      isAuthenticated,
    });

    if (!master) {
      return res.status(404).json({ error: 'Master not found' });
    }

    res.json(master);
  }),
);

// ============================================
// Collection Routes
// ============================================

router.get(
  '/collection',
  asyncHandler(async (_req, res) => {
    // Return locally cached collection
    if (!hasCollection()) {
      return res.json({
        releases: [],
        metadata: null,
        message:
          'No collection synced. Click "Update Collection" to fetch from Discogs.',
      });
    }

    const releases = getCollectionReleases();
    const metadata = getCollectionMetadata();

    res.json({ releases, metadata });
  }),
);

router.post(
  '/collection/sync',
  asyncHandler(async (req, res) => {
    const username = resolveDiscogsUsernameFromRequest(req);

    if (!username) {
      return res.status(400).json({
        error:
          'Discogs username not configured. Set it in Settings or send the x-moozhak-discogs-username header.',
      });
    }

    const { user, isAuthenticated } = req.discogs;

    // Fetch all pages from Discogs
    let allReleases = [];
    let page = 1;
    let pagination = null;

    do {
      const data = await getCollection(user, username, {
        page,
        perPage: 100,
        sort: 'added',
        sortOrder: 'desc',
        isAuthenticated,
      });

      if (!data) {
        return res
          .status(500)
          .json({ error: 'Failed to fetch collection from Discogs' });
      }

      allReleases = allReleases.concat(data.releases || []);
      pagination = data.pagination;
      page++;
    } while (pagination && page <= pagination.pages);

    // Save to local storage
    saveCollection(username, allReleases, pagination);

    logUserAction('collection_sync', { username, count: allReleases.length });

    res.json({
      success: true,
      username,
      count: allReleases.length,
      syncedAt: new Date().toISOString(),
    });
  }),
);

router.get(
  '/collection/export',
  asyncHandler(async (_req, res) => {
    const data = loadCollection();
    if (!data) {
      return res.status(404).json({ error: 'No collection data to export' });
    }
    res.json(data);
  }),
);

router.post(
  '/collection/import',
  asyncHandler(async (req, res) => {
    const body = req.body;
    if (!body || typeof body !== 'object') {
      return res.status(400).json({ error: 'JSON body required' });
    }
    if (!Array.isArray(body.releases)) {
      return res.status(400).json({
        error: 'Body must include a "releases" array (collection shape)',
      });
    }
    replaceCollectionPayload(body);
    logUserAction('collection_import', {
      username: body.username,
      count: body.releases?.length ?? 0,
    });
    res.json({ success: true, count: body.releases.length });
  }),
);

// ============================================
// Library Routes
// ============================================

router.get(
  '/library',
  asyncHandler(async (_req, res) => {
    const library = loadLibrary();
    res.json({ items: library });
  }),
);

router.get(
  '/library/export',
  asyncHandler(async (_req, res) => {
    const items = loadLibrary();
    res.json(buildLibraryData(items));
  }),
);

router.post(
  '/library/import',
  asyncHandler(async (req, res) => {
    const body = req.body;
    const items = Array.isArray(body?.items) ? body.items : null;
    if (!items) {
      return res
        .status(400)
        .json({ error: 'Request body must include an "items" array' });
    }
    replaceLibraryItems(items);
    logUserAction('library_import', { count: items.length });
    res.json({ success: true, count: items.length });
  }),
);

router.get(
  '/library/:id/set-usage',
  asyncHandler(async (req, res) => {
    const { id } = req.params;
    if (!getLibraryItem(id)) {
      return res.status(404).json({ error: 'Item not found' });
    }
    const sets = loadSetlists();
    const affected = findSetsReferencingLibraryItemId(sets, id);
    res.json({ sets: affected });
  }),
);

router.get(
  '/library/:id',
  asyncHandler(async (req, res) => {
    const item = getLibraryItem(req.params.id);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  }),
);

router.post(
  '/library/:id/refresh-discogs',
  asyncHandler(async (req, res) => {
    const item = getLibraryItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }
    if (item.discogsId == null || item.discogsId === '') {
      return res.status(400).json({
        error: 'discogsId is required to refresh from Discogs',
      });
    }

    const { db, isAuthenticated } = req.discogs;
    let releaseId = parseInt(String(item.discogsId), 10);
    if (Number.isNaN(releaseId)) {
      return res.status(400).json({ error: 'Invalid discogsId' });
    }

    if (item.type === 'master') {
      const master = await getMaster(db, releaseId, { isAuthenticated });
      if (!master) {
        return res.status(404).json({ error: 'Master not found' });
      }
      const mr = master.main_release;
      if (mr == null) {
        return res
          .status(404)
          .json({ error: 'No main release linked for this master' });
      }
      releaseId =
        typeof mr === 'object' && mr != null && mr.id != null
          ? parseInt(String(mr.id), 10)
          : parseInt(String(mr), 10);
      if (Number.isNaN(releaseId)) {
        return res.status(400).json({ error: 'Invalid main release id' });
      }
    }

    const release = await getRelease(db, releaseId, { isAuthenticated });
    if (!release) {
      return res
        .status(502)
        .json({ error: 'Could not fetch release from Discogs' });
    }

    const merged = mergeLibraryItemFromDiscogsRelease(item, release);
    const updated = updateLibraryItem(req.params.id, merged);
    logUserAction('library_refresh_discogs', { id: req.params.id });
    res.json({ item: updated });
  }),
);

router.post(
  '/library',
  asyncHandler(async (req, res) => {
    const validation = validateLibraryItem(req.body);

    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }

    // Check if this is a box set with multiple albums
    if (isBoxSet(req.body.format)) {
      const items = createBoxSetItems(req.body);

      // Add all albums from the box set
      const addedItems = items.map((item) => addToLibrary(item));

      res.status(201).json({
        boxSet: true,
        count: addedItems.length,
        items: addedItems,
      });
    } else {
      // Regular single album
      const normalizedItem = normalizeLibraryItem(req.body);
      const item = addToLibrary(normalizedItem);
      res.status(201).json(item);
    }
  }),
);

router.put(
  '/library/:id',
  asyncHandler(async (req, res) => {
    const item = updateLibraryItem(req.params.id, req.body);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json(item);
  }),
);

router.delete(
  '/library/:id',
  asyncHandler(async (req, res) => {
    const success = removeFromLibrary(req.params.id);

    if (!success) {
      return res.status(404).json({ error: 'Item not found' });
    }

    res.json({ success: true });
  }),
);

// ============================================
// Settings
// ============================================

router.get(
  '/settings',
  asyncHandler(async (_req, res) => {
    res.json(getSettingsEditorShape());
  }),
);

router.put(
  '/settings',
  asyncHandler(async (req, res) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const patch = {};
    if ('discogsToken' in body) {
      patch[APP_SETTING_KEYS.DISCOGS_TOKEN] = body.discogsToken ?? '';
    }
    if ('discogsUsername' in body) {
      patch[APP_SETTING_KEYS.DISCOGS_USERNAME] = body.discogsUsername ?? '';
    }
    if ('getBpmApiKey' in body) {
      patch[APP_SETTING_KEYS.GETBPM_API_KEY] = body.getBpmApiKey ?? '';
    }
    if (Object.keys(patch).length === 0) {
      return res.status(400).json({
        error:
          'Provide at least one of: discogsToken, discogsUsername, getBpmApiKey',
      });
    }
    setAppSettings(patch);
    logUserAction('settings_update', { keys: Object.keys(patch) });
    res.json({ success: true, settings: getSettingsEditorShape() });
  }),
);

// ============================================
// BPM Lookup Routes
// ============================================

router.post(
  '/library/:id/bpm',
  asyncHandler(async (req, res) => {
    const bpmKey = resolveGetSongBpmApiKeyFromRequest(req);
    if (!isBpmConfigured(bpmKey)) {
      return res.status(400).json({
        error:
          'GetSongBPM API key not configured. Set it in Settings or send the x-moozhak-getsongbpm-key header.',
      });
    }

    // Get the library item
    const item = getLibraryItem(req.params.id);
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Extract tracks from sides
    const tracks = extractTracksFromSides(item.sides);
    if (tracks.length === 0) {
      return res.status(400).json({ error: 'No tracks found in library item' });
    }

    // Look up BPM for all tracks
    const bpmResults = await lookupAlbumBpm(item.artist, tracks, {
      delayMs: 100,
      verbose: false,
      apiKey: bpmKey,
    });

    if (!bpmResults.success) {
      return res.status(500).json({
        error: bpmResults.message || 'BPM lookup failed',
      });
    }

    // Merge BPM data back into the sides structure
    const updatedSides = mergeBpmIntoSides(item.sides, bpmResults.tracks);

    // Update the library item with BPM data
    const updatedItem = updateLibraryItem(req.params.id, {
      sides: updatedSides,
      bpmLookupAt: new Date().toISOString(),
    });

    logUserAction('bpm_lookup', {
      itemId: req.params.id,
      title: item.title,
      artist: item.artist,
      tracksFound: bpmResults.summary.found,
      tracksTotal: bpmResults.summary.total,
    });

    res.json({
      success: true,
      item: updatedItem,
      bpmResults: {
        summary: bpmResults.summary,
        tracks: bpmResults.tracks,
      },
    });
  }),
);

// ============================================
// Single Track BPM Lookup
// ============================================

router.post(
  '/bpm/lookup',
  asyncHandler(async (req, res) => {
    const bpmKey = resolveGetSongBpmApiKeyFromRequest(req);
    if (!isBpmConfigured(bpmKey)) {
      return res.status(400).json({
        error:
          'GetSongBPM API key not configured. Set it in Settings or send the x-moozhak-getsongbpm-key header.',
      });
    }

    const { artist, title } = req.body;

    if (!artist || !title) {
      return res.status(400).json({ error: 'artist and title are required' });
    }

    // Look up BPM for the track
    const result = await findBpm(artist, title, {
      verbose: false,
      apiKey: bpmKey,
    });

    logUserAction('bpm_track_lookup', {
      artist,
      title,
      found: result.found,
    });

    if (!result.found) {
      return res.json({
        success: false,
        error: result.error || 'not_found',
        message:
          result.error === 'rate_limited'
            ? 'Rate limit reached. Try again later.'
            : 'No BPM data found for this track.',
      });
    }

    res.json({
      success: true,
      data: {
        bpm: result.bpm,
        key: result.song.key || null,
        timeSignature: result.song.timeSignature || null,
        openKey: result.song.openKey || null,
        // Additional info for display
        matchedTitle: result.song.title,
        matchedArtist: result.song.artist,
        album: result.song.album,
        year: result.song.year,
      },
    });
  }),
);

// ============================================
// Sets (setlists) — tracks updated via PUT with full document
// ============================================

function normalizeSetTracksFromBody(bodyTracks) {
  if (!Array.isArray(bodyTracks)) {
    const e = new Error('tracks must be an array');
    e.statusCode = 400;
    throw e;
  }
  const out = [];
  for (let i = 0; i < bodyTracks.length; i++) {
    const row = bodyTracks[i];
    const lid = row.libraryItemId;
    const pos =
      row.trackPosition !== undefined && row.trackPosition !== null
        ? row.trackPosition
        : row.position;
    if (!lid || pos === undefined || pos === null) {
      const e = new Error(
        `tracks[${i}]: libraryItemId and trackPosition are required`,
      );
      e.statusCode = 400;
      throw e;
    }
    const item = getLibraryItem(String(lid));
    if (!item) {
      const e = new Error(`Library item not found: ${lid}`);
      e.statusCode = 400;
      throw e;
    }
    const snap = denormalizeTrackFromLibraryItem(item, String(pos));
    if (!snap) {
      const e = new Error(
        `Track position "${pos}" not found on library item ${lid}`,
      );
      e.statusCode = 400;
      throw e;
    }
    out.push(snap);
  }
  return out;
}

function enrichSetlist(doc) {
  if (!doc) return null;
  const stats = calculateSetStats(doc.tracks || []);
  return { ...doc, stats };
}

function persistSetFromBody(id, body, existing) {
  const notesSource =
    body.notes !== undefined ? body.notes : (existing?.notes ?? '');
  const notesCheck = validateSetNotes(notesSource);
  if (!notesCheck.ok) {
    const e = new Error(notesCheck.error);
    e.statusCode = 400;
    throw e;
  }
  const name =
    typeof body.name === 'string' && body.name.trim()
      ? body.name.trim()
      : existing?.name && String(existing.name).trim()
        ? String(existing.name).trim()
        : 'Untitled set';
  let tracks;
  if (body.tracks !== undefined) {
    tracks = normalizeSetTracksFromBody(body.tracks);
  } else {
    tracks = Array.isArray(existing?.tracks) ? existing.tracks : [];
  }
  const thumbUrls = pickSetThumbUrls(tracks);
  const now = new Date().toISOString();
  const createdAt = existing?.createdAt || now;
  return {
    id,
    name,
    notes: notesCheck.value,
    tracks,
    thumbUrls,
    createdAt,
    updatedAt: now,
  };
}

router.get(
  '/setlists',
  asyncHandler(async (_req, res) => {
    const list = loadSetlists().map((doc) => enrichSetlist(doc));
    res.json({ setlists: list });
  }),
);

router.get(
  '/setlists/by-track',
  asyncHandler(async (req, res) => {
    const libraryItemId = req.query.libraryItemId;
    const qtp = req.query.trackPosition;
    const qp = req.query.position;
    const trackPosition =
      qtp != null && String(qtp).trim() !== ''
        ? qtp
        : qp != null && String(qp).trim() !== ''
          ? qp
          : null;
    if (
      libraryItemId == null ||
      String(libraryItemId).trim() === '' ||
      trackPosition == null
    ) {
      return res.status(400).json({
        error: 'libraryItemId and trackPosition (or position) are required',
      });
    }
    const sets = findSetsContainingTrack(
      loadSetlists(),
      String(libraryItemId),
      trackPosition,
    );
    res.json({ sets });
  }),
);

router.get(
  '/setlists/:id',
  asyncHandler(async (req, res) => {
    const doc = getSetlist(req.params.id);
    if (!doc) {
      return res.status(404).json({ error: 'Set not found' });
    }
    res.json(enrichSetlist(doc));
  }),
);

router.post(
  '/setlists',
  asyncHandler(async (req, res) => {
    const id = generateSetlistId();
    let doc;
    try {
      doc = persistSetFromBody(id, req.body, null);
    } catch (e) {
      return res.status(e.statusCode || 400).json({ error: e.message });
    }
    addSetlist(doc);
    logUserAction('setlist_create', { id });
    res.status(201).json(enrichSetlist(doc));
  }),
);

router.put(
  '/setlists/:id',
  asyncHandler(async (req, res) => {
    const existing = getSetlist(req.params.id);
    if (!existing) {
      return res.status(404).json({ error: 'Set not found' });
    }
    let doc;
    try {
      doc = persistSetFromBody(req.params.id, req.body, existing);
    } catch (e) {
      return res.status(e.statusCode || 400).json({ error: e.message });
    }
    updateSetlist(req.params.id, doc);
    logUserAction('setlist_update', { id: req.params.id });
    res.json(enrichSetlist(doc));
  }),
);

router.delete(
  '/setlists/:id',
  asyncHandler(async (req, res) => {
    const ok = removeSetlist(req.params.id);
    if (!ok) {
      return res.status(404).json({ error: 'Set not found' });
    }
    logUserAction('setlist_delete', { id: req.params.id });
    res.json({ success: true });
  }),
);

// ============================================
// Logging Routes
// ============================================

router.post('/log', (req, res) => {
  const { action, details } = req.body;

  if (!action) {
    return res.status(400).json({ error: 'action is required' });
  }

  logUserAction(action, details);
  res.json({ success: true });
});

export default router;
