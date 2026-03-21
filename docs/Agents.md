# Agent Notes (Transitional)

This file is retained for compatibility and now points to the maintained workflow docs:

- [Engineering Guardrails](./contributing/engineering-guardrails.md)
- [AI Workflow](./contributing/ai-workflow.md)
- [Testing Strategy](./testing/strategy.md)

Implementation rules for automated agents should live in:

- `.cursor/rules/*.mdc`
- `.cursor/skills/*/SKILL.md`

Ecosystem skills (skills.sh / [`skills` CLI](https://www.npmjs.com/package/skills)):

- Prefer npm scripts in `package.json` (`skills:find`, `skills:add`, `skills:sync`, …) so the CLI version is pinned.
- After `skills:add` for Cursor, optionally run `npm run skills:sync` to mirror `.agents/skills/` into `.cursor/skills/_skills-cli/` — see `scripts/skills/README.md` and the `moozhak-skills-npm` skill.