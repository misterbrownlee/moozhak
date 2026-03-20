import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const COLLECTION_FILE = join(DATA_DIR, 'collection.json');

// ============================================
// I/O Functions (isolated)
// ============================================

/**
 * Ensure data directory exists
 */
function ensureDataDir() {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

/**
 * Read collection file from disk
 * @returns {string|null} File contents or null if not found
 */
function readCollectionFile() {
  ensureDataDir();
  if (!existsSync(COLLECTION_FILE)) return null;

  try {
    return readFileSync(COLLECTION_FILE, 'utf-8');
  } catch (error) {
    console.error('Error reading collection file:', error);
    return null;
  }
}

/**
 * Write collection data to disk
 */
function writeCollectionFile(data) {
  ensureDataDir();
  writeFileSync(COLLECTION_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ============================================
// Pure Functions (business logic)
// ============================================

/**
 * Parse collection file contents
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
  return {
    instanceId: release.instance_id,
    discogsId: info.id,
    title: info.title || 'Unknown Title',
    artist: info.artists
      ? info.artists.map((a) => a.name).join(', ')
      : 'Unknown Artist',
    year: info.year || '',
    format: info.formats ? info.formats.map((f) => f.name).join(', ') : '',
    thumb: info.thumb || '',
    cover: info.cover_image || info.thumb || '',
    dateAdded: release.date_added,
    // Keep original data for reference
    _raw: release,
  };
}

// ============================================
// Combined Functions (I/O + Logic)
// ============================================

/**
 * Load collection from JSON file
 * @returns {Object|null} Collection data or null if not found
 */
export function loadCollection() {
  const content = readCollectionFile();
  return parseCollectionData(content);
}

/**
 * Save collection to JSON file
 * @param {string} username - Discogs username
 * @param {Array} releases - Releases from Discogs API
 * @param {Object} pagination - Pagination info
 */
export function saveCollection(username, releases, pagination) {
  const data = buildCollectionData(username, releases, pagination);
  writeCollectionFile(data);
  return data;
}

/**
 * Get collection releases (normalized)
 * @returns {Array} Normalized releases or empty array
 */
export function getCollectionReleases() {
  const collection = loadCollection();
  if (!collection || !collection.releases) return [];
  return collection.releases.map(normalizeCollectionRelease);
}

/**
 * Get collection metadata
 * @returns {Object|null} Collection metadata
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
 * Check if collection has been synced
 * @returns {boolean}
 */
export function hasCollection() {
  const collection = loadCollection();
  return collection !== null && Array.isArray(collection.releases);
}
