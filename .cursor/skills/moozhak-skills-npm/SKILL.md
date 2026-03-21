---
name: moozhak-skills-npm
description: >-
  Discover and install agent skills via the npm-based Skills CLI (skills.sh ecosystem), then sync into .cursor/skills/.
  Use when adding third-party skills, searching for a skill for a task, or aligning installs with package.json scripts.
---

# Moozhak — npm-first skills workflow

## Principles

- **npm first**: Prefer `npm run skills:*` (pinned `skills` in `devDependencies`) over ad-hoc `npx` so versions match the team.
- **Pragmatic & clean code**: New skills must not override `.cursor/rules/pragmatic-testing.mdc` or `.cursor/rules/clean-code-boundaries.mdc`; use skills for *workflow*, rules for *non-negotiables*.
- **Permission**: Do not run `skills remove`, `clean:data`, mass deletes, or destructive git operations without explicit user approval; state exact commands first.

## Discovery (find-skills ecosystem)

The [find-skills](https://skills.sh/vercel-labs/skills/find-skills) skill describes discovery UX: search by task, compare install counts and sources, then install with `skills add`.

Locally:

1. `npm run skills:find -- <query>` — search the directory-backed ecosystem via the CLI.
2. Optional: install the finder skill itself —  
   `npm run skills:add -- https://github.com/vercel-labs/skills --skill find-skills -a cursor --copy -y`

Present candidates with **install command**, **skills.sh link**, and **why** it fits; let the user choose before adding.

## Install and sync

1. Add packages with Cursor as the agent and **copy** (not symlink) when you want plain files in the repo:  
   `npm run skills:add -- <owner/repo> --skill <skill-name> -a cursor --copy -y`  
   (Adjust flags per repo policy; `-y` skips prompts—use only when the user already confirmed.)
2. Run `npm run skills:sync` to copy `.agents/skills/` → `.cursor/skills/_skills-cli/` (see `scripts/skills/README.md`).
3. Commit `SKILL.md` trees you want shared; resolve **name collisions** with native `.cursor/skills/<name>/` folders (the sync script warns).

## When not to add a skill

Prefer a short rule or an inline fix if the behavior is one-off or already covered by `moozhak-refactor-guardrails` or project rules.
