# AI Workflow

This project uses Cursor rules and skills to enforce consistent engineering behavior.

## Active Agent Guardrails

- `.cursor/rules/clean-code-boundaries.mdc`
- `.cursor/rules/pragmatic-testing.mdc`
- `.cursor/skills/moozhak-refactor-guardrails/SKILL.md`

## Expected Agent Behavior

- Plan non-trivial work before implementation.
- Keep changes scoped and aligned to module boundaries.
- Validate behavior with tests before completion.
- Keep docs current with code changes.

## Human Review Checklist

- Are concerns separated correctly (`core` vs `web/server` vs `web/client`)?
- Are functions single-purpose?
- Are tests pragmatic and behavior-focused?
- Are docs and architecture diagrams current?
