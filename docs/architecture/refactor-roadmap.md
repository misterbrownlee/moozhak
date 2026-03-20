# Refactor Roadmap

SDK-first transition (status: **complete**).

1. **Done:** `core` holds config, logger, service wrappers, and `core/domain` transforms.
2. **Done:** Web server imports `core/*`; persistence stays under `web/lib`.
3. **Done:** Library/box-set/BPM-merge helpers live in `core/domain/library.js` (browser copy via `sync:domain`).
4. **Done:** CLI removed; `commander` / `@inquirer/prompts` dropped; no `bin` entry.
5. **Done:** Tests target `core` and domain; CLI suites removed; domain regression coverage added.

## Documentation Rules During Refactor

- Every boundary change updates architecture docs in the same PR.
- Every behavior change updates testing docs in the same PR.
- Do not merge structural changes with stale docs references.
