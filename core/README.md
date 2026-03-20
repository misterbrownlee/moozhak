# Moozhak `core`

Shared **SDK** layer: configuration, logging used by services, external API clients, and pure **domain** logic (e.g. library track grouping, box sets, BPM merge).

## Import paths

- **Embed / server:** prefer `core/sdk.js` for a stable surface, or import specific modules:
  - `core/config.js`
  - `core/services/discogs.js`, `getsongbpm.js`, `rateLimiter.js`, etc.
  - `core/domain/library.js`
- **Browser:** `core/domain/library.js` is copied to `web/public/moozhak-domain.js` by `npm run sync:domain` (also run automatically before `web:start` / `web:dev` / `verify` / `build`).

## Boundaries

- `core` must not import Express, EJS, or web-only persistence.
- Web app code lives under `web/` and calls `core` for wrappers and transforms.
