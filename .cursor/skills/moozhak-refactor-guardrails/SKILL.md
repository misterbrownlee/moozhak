---
name: moozhak-refactor-guardrails
description: Applies moozhak refactor guardrails for clean architecture and pragmatic testing. Use when changing module boundaries, moving code across core/web layers, removing CLI paths, or designing tests for refactor safety.
---

# Moozhak Refactor Guardrails

## Purpose

Keep refactors safe and maintainable by enforcing:
- separation of concerns,
- single-operation function design,
- pragmatic behavior-first tests.

## Apply When

Use this skill when work includes:
- moving logic between `core/`, `web/server/`, and `web/client/`,
- extracting shared wrapper/domain modules,
- removing CLI code,
- changing API or payload contracts,
- adding or updating refactor tests.

## Required Workflow

1. Identify module ownership before editing:
   - `core/`: reusable wrappers and pure domain transforms.
   - `web/server/`: HTTP orchestration and persistence access.
   - `web/client/`: UI state, rendering, and print behavior.
2. Keep each edited function single-purpose.
3. If a function mixes transformation and side effects, split it.
4. Add or update tests that prove user-observable behavior.
5. Prefer simple boundary mocks only (network/file/time/env), not internal helper chains.
6. Run targeted tests for edited areas before finishing.

## Refactor Checklist

- [ ] No framework-specific concerns leaked into `core/`.
- [ ] No duplicated domain logic across server and client when shared helper is feasible.
- [ ] Public inputs/outputs at boundaries are explicit and stable.
- [ ] Existing web local-library workflow still behaves the same.
- [ ] Existing BPM card printing output path still behaves the same.
- [ ] Tests cover changed behavior with readable setup/verify flow.

## Testing Defaults

- `core` changes: focused unit tests for transforms/contracts.
- `web/server` changes: request-response tests.
- `web/client` changes: tests for user-visible output where practical.

Prefer small, stable fixtures over large mocks.
