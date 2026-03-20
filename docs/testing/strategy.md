# Testing Strategy

Tests should provide confidence without fragile mock setups.

## Principles

- Test behavior, not implementation internals.
- Use simple fixtures and fakes before complex mocks.
- Mock unstable boundaries only: network, time, file IO, process env.
- Add regression tests before or with major refactors.

## Test Allocation

- `core/`: unit tests for transforms and wrapper contracts.
- `web/server/`: request-response tests around routes/controllers.
- `web/client/`: tests for user-visible behavior where practical.

## Non-Regression Requirements

- Local library create/read/update/delete workflows remain correct.
- BPM card print payload and rendering assumptions remain correct.

## Refactor Testing Flow

1. Capture current behavior with focused tests.
2. Move code behind stable contracts.
3. Re-run targeted tests for touched boundaries.
4. Run full test suite before merge.
