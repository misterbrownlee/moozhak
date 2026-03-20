# Moozhak

Node.js **vinyl library** app (Discogs search, local library, BPM lookups, printable track cards) plus a reusable **`core` SDK** for the same wrappers and domain logic—suitable for embedding in other runtimes (e.g. mobile) without calling a moozhak HTTP API for Discogs/BPM.

## Documentation

- [docs/README.md](./docs/README.md) – index (architecture, testing, contributing)
- [docs/architecture/system-overview.md](./docs/architecture/system-overview.md) – runtime and SDK boundaries
- [web/README.md](./web/README.md) – web app routes and features
- [core/README.md](./core/README.md) – SDK layout and imports
- Public entry for embedders: [core/sdk.js](./core/sdk.js)

## Requirements

- [Node.js](https://nodejs.org/) v18+
- npm

## Setup

```bash
npm install
npm run sync:domain   # keep browser copy of domain helpers in sync with core (also runs before web)
npm run css:build     # first run or after style changes
```

## Configuration

Copy `example.mzkconfig` to `.mzkconfig` in the project root (or home directory). Typical keys:

- `DISCOGS_TOKEN` – Discogs API (optional but recommended)
- `GETBPM_API_KEY` – GetSongBPM (BPM/key on library)
- `DISCOGS_USERNAME` – collection sync in the web app
- `MOOZAK_DATA_DIR` – optional web app data directory (absolute or project-relative); same key as the env var, but **env wins** if both are set (e.g. tests)
- `VERBOSE=true` – verbose API logging

## Development

```bash
npm run web          # start server (syncs domain client bundle first)
npm run web:dev      # server with --watch
npm test
npm run lint
npm run docs:check
```

## Runtime data

- `data/` – default directory for the web app (`MOOZAK_DATA_DIR` in `.mzkconfig` or as an environment variable; env overrides config)
  - **`moozhak.db`** – SQLite WAL database (canonical library + cached collection)
  - **`library.json` / `collection.json`** – if present when the DB is first created and empty, they are **imported once**; use **export** API for backups (see [web/README.md](./web/README.md))
- `.logs/` – web and API logs
- `npm run clean:data` – deletes contents of `data/` (including the database)

## Dependencies (runtime)

- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) – local SQLite for web persistence
- [disconnect](https://github.com/bartve/disconnect) – Discogs
- [ansis](https://github.com/nicolo-ribaudo/ansis) – styled logs
- [express](https://expressjs.com/) + [ejs](https://ejs.co/)

## License

ISC
