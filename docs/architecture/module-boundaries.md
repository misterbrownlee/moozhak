# Module Boundaries

Use these boundaries for all refactor work.

## Ownership Rules

- `core/`
  - External API wrappers
  - Pure domain transforms and contract shaping
  - No Express, no template rendering, no web route concerns, no app persistence
- **Web server layer** (paths in repo today)
  - [web/server.js](../../web/server.js) — HTTP entry (`listen`), wires [web/app.js](../../web/app.js)
  - [web/app.js](../../web/app.js) — `createApp()`: Express app, middleware, `/api` and page routes
  - [web/routes/](../../web/routes/) — API route modules (e.g. [api.js](../../web/routes/api.js))
  - [web/lib/](../../web/lib/) — persistence, logging, server-only helpers
  - [web/views/](../../web/views/) — EJS templates and layouts
- **Web client layer**
  - [web/public/](../../web/public/) — static assets, Alpine app, synced domain bundle (`moozhak-domain.js`)
  - No server-only filesystem or process concerns

A physical `web/server/` directory is **optional**; the responsibilities above are what matter. If files are moved later, update this doc in the same change set.

## Design Rules

- One module, one responsibility.
- Prefer single-operation functions.
- Keep side effects at boundaries, not in pure transforms.
- Make module inputs and outputs explicit.

## Shared Logic Rule

If both server and client need the same transform logic, put it in `core/domain/` and reuse it.

## Non-Regression Web Guarantees

- Local library CRUD behavior remains stable.
- BPM card print flow remains stable.
