# Moozhak Web App

A browser-based vinyl record library manager. Search Discogs for vinyl releases, build your collection, and generate printable track cards.

This app is the primary supported runtime and consumes the shared `core` SDK for Discogs, BPM, and library domain logic.

> For installation, configuration, and shared setup, see the [main README](../README.md).
> For architecture and guardrails, see [docs/README.md](../docs/README.md).

## Quick Start

```bash
# Build CSS (first time only, or after style changes)
npm run css:build

# Start the server
npm run web

# Open in browser
open http://localhost:3000
```

## Features

- **Search** - Search Discogs for vinyl master releases
- **Library** - Save albums to your personal collection with tracklist grouped by side
- **Collection** - View and sync your Discogs collection (requires `DISCOGS_USERNAME` in config)
- **Box Sets** - Automatically splits box sets into individual album entries
- **View Modes** - Toggle between card and list views for library and collection
- **Edit** - Modify album details (title, artist, year, format, notes)
- **Delete** - Remove albums from your library
- **Print Cards** - Generate printable track listings (4" wide, optimized for print)
- **Themes** - Switch between Nord, Light, Dark, and Cupcake themes
- **BPM Lookup** - Look up tempo, key, and time signature for all tracks on an album (requires `GETBPM_API_KEY`)

## Card View Design

Library and collection cards feature a modern overlay design:
- **Full-bleed album art** filling the entire square card
- **Frosted glass overlay** at the bottom with album info (40% opacity, backdrop blur)
- **Inset positioning** (8px sides, 1rem bottom) with rounded corners
- Cards use higher-resolution cover images when available (`cover` vs `thumb`)

## NPM Scripts

```bash
npm run web         # Start server
npm run web:dev     # Start with auto-reload (--watch)
npm run css:build   # Build Tailwind CSS
npm run css:watch   # Watch and rebuild CSS on changes
```

## Routes

### Pages (Server-Rendered)

| Route | Description |
|-------|-------------|
| `GET /` | Search page (use `?q=query` to search) |
| `GET /library` | Library page (card/list view toggle) |
| `GET /library/:id/edit` | Edit album and track details |
| `GET /collection` | Discogs collection page |
| `GET /print/:id` | Printable track card |

### API (JSON)

| Route | Method | Description |
|-------|--------|-------------|
| `/api/search` | GET | Search Discogs (`?q=query&limit=20`) |
| `/api/master/:id` | GET | Get master release details |
| `/api/release/:id` | GET | Get release details |
| `/api/library` | GET | Get all library items |
| `/api/library/export` | GET | Export library as JSON (`version`, `updatedAt`, `items`) |
| `/api/library/import` | POST | Replace library from JSON body `{ "items": [...] }` |
| `/api/library/:id` | GET | Get single library item |
| `/api/library` | POST | Add item to library (handles box sets automatically) |
| `/api/library/:id` | PUT | Update library item |
| `/api/library/:id` | DELETE | Remove from library |
| `/api/library/:id/bpm` | POST | Look up BPM for all tracks on album |
| `/api/collection` | GET | Get cached Discogs collection |
| `/api/collection/export` | GET | Export cached collection JSON (404 if none) |
| `/api/collection/import` | POST | Replace collection cache from JSON body (same shape as export) |
| `/api/collection/sync` | POST | Sync collection from Discogs |
| `/api/log` | POST | Log client-side user actions |

## BPM Lookup

The `POST /api/library/:id/bpm` endpoint looks up tempo, key, and time signature for all tracks on an album using the GetSongBPM API.

**Request**: POST to `/api/library/:id/bpm` with no body required.

**Response**:
```json
{
  "success": true,
  "item": { /* updated library item with BPM data in tracks */ },
  "bpmResults": {
    "summary": { "total": 10, "found": 8, "notFound": 2, "rateLimited": 0 },
    "tracks": [
      { "position": "A1", "title": "Track Name", "found": true, "bpm": 120, "key": "Am", "timeSignature": "4/4", "openKey": "8m" },
      { "position": "A2", "title": "Other Track", "found": false, "error": "no_results" }
    ]
  }
}
```

**Track BPM Fields** (added after lookup):
- `bpm` - Beats per minute
- `key` - Musical key (e.g., "Am", "C")
- `timeSignature` - Time signature (e.g., "4/4")
- `openKey` - Open key notation for harmonic mixing

**Rate Limiting**: The GetSongBPM API is limited to 3000 requests/hour. The rate limiter throttles requests when approaching the limit and blocks if exceeded. A `bpmLookupAt` timestamp is stored on the album after lookup.

## Data storage

Default data root is the repo `data/` directory. Override with **`MOOZAK_DATA_DIR`** in `.mzkconfig` (relative paths are from the project root) or as an environment variable—**the env var wins** when both are set (e.g. integration tests).

- **`moozhak.db`** – SQLite database (library rows + collection cache). This is the **canonical** store.
- **Legacy JSON** – If `library.json` / `collection.json` exist in the data root when the DB is first opened and empty, they are imported **once** (idempotent for already-populated DB).

**Backup / portability:** use `GET /api/library/export` and `GET /api/collection/export`. Restore with `POST /api/library/import` and `POST /api/collection/import`.

Logs are stored in `.logs/` (git-ignored).

## Architecture

```
web/
├── app.js                    # createApp() — used by server and tests
├── views/                    # EJS templates
│   ├── layouts/
│   │   └── main.ejs          # Base layout (head, navbar, print styles)
│   ├── partials/             # Reusable components
│   │   ├── album-image.ejs   # Album cover (supports thumb/cover URLs)
│   │   ├── badge.ejs         # Badge component
│   │   ├── tracklist.ejs     # Track table
│   │   ├── search-result-card.ejs
│   │   ├── library-card.ejs
│   │   ├── item-card.ejs     # Generic card for library/collection
│   │   ├── item-list-row.ejs # Generic list row for library/collection
│   │   ├── view-toggle.ejs   # Card/list view toggle buttons
│   │   └── modals.ejs        # Edit and details modal dialogs
│   ├── index.ejs             # Search page
│   ├── library.ejs           # Library page (card/list views)
│   ├── collection.ejs        # Discogs collection page
│   ├── edit.ejs              # Edit album details page
│   └── print.ejs             # Print view (uses Alpine.js)
├── public/                   # Static files
│   ├── app.js                # Client-side JavaScript (vinylApp)
│   ├── moozhak-domain.js     # Copy of core/domain/library.js (sync:domain)
│   ├── init-moozhak-domain.js # Loads domain onto window for Alpine
│   └── styles.css            # Generated Tailwind CSS
├── routes/
│   └── api.js                # REST API routes
├── lib/
│   ├── dataRoot.js           # MOOZAK_DATA_DIR / default data path
│   ├── persistence/          # SQLite implementation + README
│   ├── library.js            # Library facade (SQLite)
│   ├── collection.js         # Collection cache facade (SQLite)
│   └── webLogger.js          # Request/action logging
└── server.js                 # listen() entry (uses createApp)
```

## Tech Stack

- **[Express.js](https://expressjs.com/)** - Web framework
- **[EJS](https://ejs.co/)** - Server-side templating
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS
- **[DaisyUI](https://daisyui.com/)** - Tailwind component library

## EJS Templates

### Using Partials

Include reusable components with data:

```ejs
<%- include('partials/album-image', { thumb: item.thumb, cover: item.cover, title: item.title, size: 'lg' }) %>

<%- include('partials/badge', { text: item.year, variant: 'sm-ghost' }) %>

<%- include('partials/tracklist', { tracklist: item.tracklist, compact: true }) %>
```

### Available Partials

| Partial | Parameters |
|---------|------------|
| `album-image` | `thumb`, `cover` (optional, higher-res), `title`, `size` ('sm', 'md', 'lg') |
| `badge` | `text`, `variant` ('default', 'ghost', 'outline', 'sm-ghost', etc.) |
| `tracklist` | `tracklist` (array), `compact` (boolean) |
| `search-result-card` | `result`, `inLibrary` |
| `library-card` | `item` |
| `item-card` | `item`, `type` ('library' or 'collection'), `inLibrary` |
| `item-list-row` | `item`, `type` ('library' or 'collection'), `inLibrary` |
| `view-toggle` | (no params - uses Alpine.js `viewMode` state) |
| `modals` | (no params - includes edit and details modal dialogs) |

### Layout System

Pages are automatically wrapped in `layouts/main.ejs` which includes:
- Navigation bar
- Theme selector
- Loading indicator
- Toast notifications
- Print-specific CSS (`@media print` styles)

All pages use the main layout (no standalone pages).
