# Scanner (planned)

Native **Android** client for Moozhak-style workflows (library, collection, BPM lookups). This folder is a **planning stub** until a Gradle project or submodule is added.

## Relationship to this repo

| Piece | Role for Scanner |
| ----- | ---------------- |
| **`core/`** | Reference for domain rules and service contracts (Discogs, BPM, library shapes). Android does not run this Node code directly; implementations should **match behavior** and stay aligned via tests and docs. |
| **Web server** (`web/server.js`) | Today’s **JSON HTTP API** lives alongside the browser app. Scanner will likely call these endpoints (or a future extracted API package) over the network. |
| **`web/public/moozhak-domain.js`** | Browser-only bundle synced from `core/domain`; Scanner may mirror logic in Kotlin or share OpenAPI/types later. |

## Tooling (repo root)

From the repository root, use the **`web:*`** scripts for the existing app and **`test:sdk`** when working on shared service/domain tests. See the main [README](../README.md#npm-scripts) for the full table.

## Next steps (when kicking off)

- Add an Android Studio project under `scanner/android/` (or a Git submodule) and document build prerequisites.
- Decide transport: **same-LAN HTTP to `web`**, optional auth, and versioning for `/api/*`.
- Optionally add `scanner/docs/api-consumer.md` for mobile-specific notes (timeouts, caching, background sync).
