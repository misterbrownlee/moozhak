import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, '../../data');
const LIBRARY_FILE = join(DATA_DIR, 'library.json');

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
 * Read library file from disk
 * @returns {string|null} File contents or null if not found
 */
function readLibraryFile() {
  ensureDataDir();
  if (!existsSync(LIBRARY_FILE)) return null;

  try {
    return readFileSync(LIBRARY_FILE, 'utf-8');
  } catch (error) {
    console.error('Error reading library file:', error);
    return null;
  }
}

/**
 * Write library data to disk
 */
function writeLibraryFile(data) {
  ensureDataDir();
  writeFileSync(LIBRARY_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

// ============================================
// Pure Functions (business logic)
// ============================================

/**
 * Generate unique ID for library items
 */
export function generateId() {
  return `lib_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Parse library file contents
 */
export function parseLibraryData(content) {
  if (!content) return [];

  try {
    const data = JSON.parse(content);
    return data.items || [];
  } catch (error) {
    console.error('Error parsing library data:', error);
    return [];
  }
}

/**
 * Build library file structure
 */
export function buildLibraryData(items) {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    items,
  };
}

/**
 * Create a new library item with metadata
 */
export function createLibraryItem(item) {
  return {
    id: generateId(),
    ...item,
    addedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Apply updates to an item (pure)
 */
export function applyItemUpdates(item, updates) {
  const { id: _id, addedAt: _addedAt, ...safeUpdates } = updates;
  return {
    ...item,
    ...safeUpdates,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Find item by ID in items array
 */
export function findItemById(items, id) {
  return items.find((item) => item.id === id) || null;
}

/**
 * Find item by Discogs ID in items array
 */
export function findItemByDiscogsId(items, discogsId) {
  return (
    items.find((item) => String(item.discogsId) === String(discogsId)) || null
  );
}

// ============================================
// Combined Functions (I/O + Logic)
// ============================================

/**
 * Load library from JSON file
 */
export function loadLibrary() {
  const content = readLibraryFile();
  return parseLibraryData(content);
}

/**
 * Save library to JSON file
 */
export function saveLibrary(items) {
  const data = buildLibraryData(items);
  writeLibraryFile(data);
}

/**
 * Add item to library
 */
export function addToLibrary(item) {
  const library = loadLibrary();
  const newItem = createLibraryItem(item);
  library.push(newItem);
  saveLibrary(library);
  return newItem;
}

/**
 * Update library item
 */
export function updateLibraryItem(id, updates) {
  const library = loadLibrary();
  const index = library.findIndex((item) => item.id === id);

  if (index === -1) return null;

  library[index] = applyItemUpdates(library[index], updates);
  saveLibrary(library);
  return library[index];
}

/**
 * Remove item from library
 */
export function removeFromLibrary(id) {
  const library = loadLibrary();
  const index = library.findIndex((item) => item.id === id);

  if (index === -1) return false;

  library.splice(index, 1);
  saveLibrary(library);
  return true;
}

/**
 * Get single library item by ID
 */
export function getLibraryItem(id) {
  const library = loadLibrary();
  return findItemById(library, id);
}

/**
 * Find item by Discogs ID
 */
export function findByDiscogsId(discogsId) {
  const library = loadLibrary();
  return findItemByDiscogsId(library, discogsId);
}
