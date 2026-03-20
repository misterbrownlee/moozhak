# Moozhak

Node.js **vinyl library** app (Discogs search, local library, BPM lookups, printable track cards) plus a reusable **`core` SDK** for the same wrappers and domain logic. A planned **Android** client ([`scanner/`](./scanner/)) will consume the HTTP API and treat `core/` as the behavioral contract reference.

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
npm run web:css:build # first run or after style changes (alias: css:build)
```

## Configuration

### Web app

Discogs token, username, and GetSongBPM API key are stored in **SQLite** via the in-app **Settings** page (`/settings`). The web app does not require `.mzkconfig` for those values.

Optional **per-request HTTP headers** let API clients supply their own credentials (see [web/README.md](./web/README.md)): `x-moozhak-discogs-token`, `x-moozhak-discogs-username`, `x-moozhak-getsongbpm-key` (header wins over stored defaults for that request; names are case-insensitive in HTTP but we standardize on these literals).

### Data directory and SDK / legacy

- `MOOZAK_DATA_DIR` – optional data directory for the web app (`.mzkconfig` key or environment variable; **env wins** when both are set, e.g. in tests)
- **`core` SDK** (non-web) may still use `.mzkconfig` / env for `DISCOGS_TOKEN`, `GETBPM_API_KEY`, etc. Copy [example.mzkconfig](./example.mzkconfig) as a reference.
- `VERBOSE=true` – verbose API logging (file config when using SDK-style loading)

## Development

```bash
npm run web:start    # start server (syncs domain client bundle first; alias: npm run web)
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

## Clients

| Client | Location | Notes |
| ------ | -------- | ----- |
| **Web** | [`web/`](./web/) | Express + EJS + SQLite; primary app today |
| **Scanner** (planned) | [`scanner/`](./scanner/) | Android; see [scanner/README.md](./scanner/README.md) |

## npm scripts

| Script | Purpose |
| ------ | ------- |
| `web:start` / `web` | Run the web server |
| `web:dev` | Server with `--watch` |
| `web:dev:restart` / `restart` | `clean:artifacts`, sync domain, build CSS, `web:dev` |
| `web:css:build` / `css:build` | Tailwind → `web/public/styles.css` |
| `web:css:watch` / `css:watch` | Watch Tailwind |
| `sync:domain` | Sync `core/domain` → `web/public/moozhak-domain.js` |
| `test` | Full Jest suite |
| `test:web` | Only `tests/web/**` |
| `test:sdk` | `tests/core`, `tests/services`, `tests/config.test.js` |
| `verify` | `sync:domain` + lint + test + `web:css:build` (no clean) |
| `build` | `clean:artifacts` + `verify` |
| `clean` / `clean:artifacts` / `clean:all` | Remove `dist/*` and `.logs/*` (not `data/`) |
| `clean:data` | Remove `data/*` (SQLite and local files—destructive) |
| `clean:dist` / `clean:logs` | Granular clean steps |

Other scripts (`lint:fix`, `format`, `test:watch`, `test:coverage`, `docs:check`) are listed in `package.json`.

## Dependencies (runtime)

- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) – local SQLite for web persistence
- [disconnect](https://github.com/bartve/disconnect) – Discogs
- [ansis](https://github.com/nicolo-ribaudo/ansis) – styled logs
- [express](https://expressjs.com/) + [ejs](https://ejs.co/)

## License

ISC
