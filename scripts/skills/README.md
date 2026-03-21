# Skills CLI → Cursor layout

This repo prefers **npm-run** invocations of the [`skills`](https://www.npmjs.com/package/skills) CLI (pinned in `devDependencies`) so installs are reproducible.

## Flow

1. **Discover** — [find-skills](https://skills.sh/vercel-labs/skills/find-skills) describes how to search the ecosystem; locally that maps to:
   - `npm run skills:find -- <query>`  
   - or install the skill into the project:  
     `npm run skills:add -- https://github.com/vercel-labs/skills --skill find-skills -a cursor --copy -y`
2. **Install** — `npx skills add` / `npm run skills:add` places Cursor project skills under [`.agents/skills/`](https://github.com/vercel-labs/skills#supported-agents) by default.
3. **Sync** — `npm run skills:sync` copies `.agents/skills/` → `.cursor/skills/_skills-cli/` so imported skills sit next to repo-authored skills under `.cursor/skills/`.

Cursor loads both [`.agents/skills/` and `.cursor/skills/`](https://cursor.com/docs/context/skills); syncing is optional but keeps a single obvious tree for review in git.

## Environment

- `DISABLE_TELEMETRY=1` or `DO_NOT_TRACK=1` — opt out of CLI telemetry ([CLI env](https://github.com/vercel-labs/skills#environment-variables)).
