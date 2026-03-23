import { getDb } from './persistence/sqlite/db.js';

// ============================================
// Pure Functions (business logic)
// ============================================

/**
 * Parse collection file contents (legacy JSON)
 */
export function parseCollectionData(content) {
  if (!content) return null;

  try {
    return JSON.parse(content);
  } catch (error) {
    console.error('Error parsing collection data:', error);
    return null;
  }
}

/**
 * Build collection file structure from Discogs API response
 * @param {string} username - Discogs username
 * @param {Array} releases - Releases from Discogs API
 * @param {Object} pagination - Pagination info from API
 */
export function buildCollectionData(username, releases, pagination) {
  return {
    version: 1,
    username,
    syncedAt: new Date().toISOString(),
    pagination,
    releases,
  };
}

/**
 * Normalize a Discogs collection release for consistent access
 * @param {Object} release - Raw release from Discogs collection API
 */
export function normalizeCollectionRelease(release) {
  const info = release.basic_information || {};
  const masterRaw = info.master_id;
  const masterId =
    masterRaw != null && masterRaw !== '' ? Number(masterRaw) : undefined;
  return {
    instanceId: release.instance_id,
    discogsId: info.id,
    masterId: Number.isFinite(masterId) ? masterId : undefined,
    title: info.title || 'Unknown Title',
    artist: info.artists
      ? info.artists.map((a) => a.name).join(', ')
      : 'Unknown Artist',
    year: info.year || '',
    format: info.formats ? info.formats.map((f) => f.name).join(', ') : '',
    thumb: info.thumb || '',
    cover: info.cover_image || info.thumb || '',
    dateAdded: release.date_added,
    _raw: release,
  };
}

// ============================================
// SQLite persistence
// ============================================

function readPayload(db) {
  const row = db
    .prepare('SELECT payload_json FROM collection_cache WHERE singleton = 1')
    .get();
  if (!row?.payload_json) return null;
  try {
    return JSON.parse(row.payload_json);
  } catch {
    return null;
  }
}

/**
 * Load collection from DB
 * @returns {Object|null}
 */
export function loadCollection() {
  return readPayload(getDb());
}

/**
 * Save collection to DB
 * @param {string} username
 * @param {Array} releases
 * @param {Object} pagination
 */
export function saveCollection(username, releases, pagination) {
  const data = buildCollectionData(username, releases, pagination);
  const db = getDb();
  db.prepare(
    `INSERT INTO collection_cache (singleton, payload_json) VALUES (1, ?)
     ON CONFLICT(singleton) DO UPDATE SET payload_json = excluded.payload_json`,
  ).run(JSON.stringify(data));
  return data;
}

/**
 * Replace collection payload (e.g. import). Entire JSON object as stored for GET /collection.
 * @param {object} payload - Same shape as buildCollectionData output
 */
export function replaceCollectionPayload(payload) {
  const db = getDb();
  db.prepare(
    `INSERT INTO collection_cache (singleton, payload_json) VALUES (1, ?)
     ON CONFLICT(singleton) DO UPDATE SET payload_json = excluded.payload_json`,
  ).run(JSON.stringify(payload));
}

/**
 * @returns {Array}
 */
export function getCollectionReleases() {
  const collection = loadCollection();
  if (!collection || !collection.releases) return [];
  return collection.releases.map(normalizeCollectionRelease);
}

/**
 * @returns {Object|null}
 */
export function getCollectionMetadata() {
  const collection = loadCollection();
  if (!collection) return null;

  return {
    username: collection.username,
    syncedAt: collection.syncedAt,
    totalItems:
      collection.pagination?.items || collection.releases?.length || 0,
    pages: collection.pagination?.pages || 1,
  };
}

/**
 * @returns {boolean}
 */
export function hasCollection() {
  const collection = loadCollection();
  return collection !== null && Array.isArray(collection.releases);
}
