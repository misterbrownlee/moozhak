# Testing Strategy

Tests should provide confidence without fragile mock setups.

## Principles

- Test behavior, not implementation internals.
- Use simple fixtures and fakes before complex mocks.
- Mock unstable boundaries only: network, time, file IO, process env.
- Add regression tests before or with major refactors.

## Test allocation

- `core/`: unit tests for transforms and wrapper contracts (e.g. [tests/core/domain](../../tests/core/domain)).
- **Web HTTP**: integration tests under [tests/web](../../tests/web) using `supertest` against `createApp()` from [web/app.js](../../web/app.js). From the repo root: `npm run test:web`.
- **SDK / services** (shared contracts, not the Express app): `tests/core`, `tests/services`, and [tests/config.test.js](../../tests/config.test.js). From the root: `npm run test:sdk`.
- `web/client/`: optional tests for user-visible behavior where practical.

### Web integration conventions

- Set the **`MOOZAK_DATA_DIR` environment variable** in `beforeAll` to a unique temp directory so SQLite (`moozhak.db`) and any legacy `library.json` / `collection.json` fixtures do not touch the developer’s real `data/` folder (env overrides `.mzkconfig`).
- Dynamically `import()` the app **after** `jest.unstable_mockModule()` when mocking ESM dependencies (e.g. GetSongBPM in [tests/web/api.test.js](../../tests/web/api.test.js)).
- Clear tables between cases with `clearAllPersistenceTables()` from [web/lib/persistence/sqlite/db.js](../../web/lib/persistence/sqlite/db.js); `closeDb()` in `afterAll` if removing the temp directory (file lock).
- For routes that resolve **GetSongBPM** or **Discogs** credentials from headers + DB, use [tests/web/testCredentials.js](../../tests/web/testCredentials.js) `withMoozhakCredentials(request)` so supertest sends the documented header names (dummy values are fine when `core` services are mocked). Alternatively `PUT /api/settings` in setup to seed `app_settings`, then call routes without headers.

## Non-Regression Requirements

- Local library create/read/update/delete workflows remain correct.
- BPM card print payload and rendering assumptions remain correct.

## Refactor testing flow

1. Capture current behavior with focused tests.
2. Move code behind stable contracts.
3. Re-run targeted tests for touched boundaries.
4. Run full test suite before merge.
