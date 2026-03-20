import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { createClient, searchDiscogs } from '../core/services/discogs.js';
import { getLibraryItem, loadLibrary } from './lib/library.js';
import { requestLogger } from './lib/webLogger.js';
import apiRoutes from './routes/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Discogs client
const { db } = createClient();

// ============================================
// View Engine Setup
// ============================================

app.set('view engine', 'ejs');
app.set('views', join(__dirname, 'views'));

/**
 * Layout middleware - wraps views in main layout
 */
function layoutMiddleware(_req, res, next) {
  const originalRender = res.render.bind(res);

  res.render = (view, options = {}, callback) => {
    if (options.layout === false) {
      return originalRender(view, options, callback);
    }

    originalRender(view, options, (err, body) => {
      if (err) return callback ? callback(err) : next(err);
      originalRender('layouts/main', { ...options, body }, callback);
    });
  };

  next();
}

app.use(layoutMiddleware);

// ============================================
// Middleware
// ============================================

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(join(__dirname, 'public')));

// Request/response logging (debug mode)
app.use(requestLogger());

// ============================================
// API routes
// ============================================

app.use('/api', apiRoutes);

// ============================================
// Page Route Handlers
// ============================================

/**
 * Get library IDs for checking duplicates
 */
function getLibraryDiscogsIds() {
  const library = loadLibrary();
  return library.map((item) => String(item.discogsId));
}

/**
 * Search Discogs with error handling
 */
async function performSearch(query) {
  if (!query) return null;

  try {
    return await searchDiscogs(db, query, {
      type: 'master',
      format: 'Vinyl',
      limit: 20,
    });
  } catch (error) {
    console.error('Search error:', error.message);
    return [];
  }
}

/**
 * Handle search page request
 */
async function handleSearchPage(req, res) {
  const { q } = req.query;
  const results = await performSearch(q);
  const libraryIds = getLibraryDiscogsIds();

  res.render('index', {
    activeView: 'search',
    query: q || '',
    results,
    libraryIds,
  });
}

/**
 * Handle library page request
 */
function handleLibraryPage(_req, res) {
  const items = loadLibrary();
  res.render('library', { activeView: 'library', items });
}

/**
 * Handle collection page request
 */
function handleCollectionPage(_req, res) {
  res.render('collection', { activeView: 'collection' });
}

/**
 * Handle print page request
 */
function handlePrintPage(req, res) {
  const item = getLibraryItem(req.params.id);

  if (!item) {
    return res.status(404).send('Item not found');
  }

  res.render('print', {
    title: `${item.title} - ${item.artist}`,
    activeView: 'library',
    item,
  });
}

/**
 * Handle edit page request
 */
function handleEditPage(req, res) {
  const item = getLibraryItem(req.params.id);

  if (!item) {
    return res.status(404).send('Item not found');
  }

  res.render('edit', {
    title: `Edit - ${item.title}`,
    activeView: 'library',
    item,
  });
}

// ============================================
// Page Routes
// ============================================

app.get('/', handleSearchPage);
app.get('/library', handleLibraryPage);
app.get('/library/:id/edit', handleEditPage);
app.get('/collection', handleCollectionPage);
app.get('/print/:id', handlePrintPage);

// ============================================
// Start Server
// ============================================

app.listen(PORT, () => {
  console.log(`Vinyl Library running at http://localhost:${PORT}`);
});
