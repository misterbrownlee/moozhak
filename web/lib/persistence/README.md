# Web persistence layer

Server-only storage for the Moozhak web app. **Do not import from `core/`**—the SDK stays free of filesystem and SQLite.

## Layout

- **[dataRoot.js](../dataRoot.js)** — `MOOZAK_DATA_DIR` resolution (default: repo `data/`).
- **`sqlite/`** — implementation: connection, migrations, legacy JSON bootstrap, WAL file `moozhak.db` under the data directory (includes `app_settings` for web defaults).

## Public facades

Callers (routes, [web/app.js](../../app.js)) use:

- [web/lib/library.js](../library.js) — library CRUD, export envelope builders, bulk `replaceLibraryItems`.
- [web/lib/collection.js](../collection.js) — collection cache CRUD shape, `replaceCollectionPayload`.
- [web/lib/appSettings.js](../appSettings.js) — `app_settings` key/value rows (Discogs / GetSongBPM defaults).

These modules are the stable boundary; SQLite details stay under `sqlite/`.
