# Module Boundaries

Use these boundaries for all refactor work.

## Ownership Rules

- `core/`
  - External API wrappers
  - Pure domain transforms and contract shaping
  - No Express, no template rendering, no web route concerns
- `web/server/`
  - Route/controller orchestration
  - Persistence coordination
  - Response shaping for browser workflows
- `web/client/`
  - UI state, rendering, and print interactions
  - No server-only filesystem or process concerns

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
