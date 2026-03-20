import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { searchDiscogs } from '../core/services/discogs.js';
import { discogsSetupStatusFromDb } from './lib/appSettings.js';
import { getDiscogsContextForSsr } from './lib/discogsRuntime.js';
import { getLibraryItem, loadLibrary } from './lib/library.js';
import { requestLogger } from './lib/webLogger.js';
import apiRoutes from './routes/api.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Build Express app (no listen). Use in tests with supertest; entrypoint calls listen via web/server.js.
 */
export function createApp() {
  const app = express();
  app.locals.gearIconSvg = readFileSync(
    join(__dirname, 'src/icons/gear.svg'),
    'utf-8',
  );

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

  app.use(requestLogger());

  // ============================================
  // API routes
  // ============================================

  app.use('/api', apiRoutes);

  // ============================================
  // Page Route Handlers
  // ============================================

  function getLibraryDiscogsIds() {
    const library = loadLibrary();
    return library.map((item) => String(item.discogsId));
  }

  async function performSearch(query) {
    if (!query) return null;

    try {
      const { db, isAuthenticated } = getDiscogsContextForSsr();
      return await searchDiscogs(db, query, {
        type: 'master',
        format: 'Vinyl',
        limit: 20,
        isAuthenticated,
      });
    } catch (error) {
      console.error('Search error:', error.message);
      return [];
    }
  }

  async function handleSearchPage(req, res) {
    const { q } = req.query;
    const results = await performSearch(q);
    const libraryIds = getLibraryDiscogsIds();

    res.render('index', {
      activeView: 'search',
      query: q || '',
      results,
      libraryIds,
      ...discogsSetupStatusFromDb(),
    });
  }

  function handleLibraryPage(_req, res) {
    const items = loadLibrary();
    res.render('library', {
      activeView: 'library',
      items,
      ...discogsSetupStatusFromDb(),
    });
  }

  function handleCollectionPage(_req, res) {
    res.render('collection', {
      activeView: 'collection',
      ...discogsSetupStatusFromDb(),
    });
  }

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

  app.get('/settings', (_req, res) => {
    res.render('settings', {
      activeView: 'settings',
      ...discogsSetupStatusFromDb(),
    });
  });

  app.get('/print/:id', handlePrintPage);

  return app;
}
