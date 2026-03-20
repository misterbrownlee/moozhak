# Engineering Guardrails

These guardrails define the refactor baseline for this repository.

## Clean Code

- Keep module responsibilities narrow and explicit.
- Keep functions focused on one operation.
- Separate pure transforms from side effects.
- Prefer small, composable helpers over large orchestrator functions.

## Separation of Concerns

- `core` stays transport-agnostic and reusable.
- `web/server` owns HTTP orchestration and persistence wiring.
- `web/client` owns UI behavior and print interactions.

## Pragmatic Testing

- Write tests for meaningful behavior changes.
- Avoid deep internal mocking.
- Favor maintainable tests with readable setup, execution, and assertions.

## Documentation Discipline

- Update docs in the same change set as architecture or behavior changes.
- Keep one canonical architecture diagram and link to it.
