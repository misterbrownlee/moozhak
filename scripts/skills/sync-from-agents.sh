#!/usr/bin/env bash
# Copy skills installed by the Skills CLI for Cursor (default project path:
# .agents/skills/) into .cursor/skills/_skills-cli/ so everything lives under
# .cursor/skills/ alongside repo-native skills. Safe to re-run; destination is
# treated as generated output.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="${ROOT}/.agents/skills"
DST="${ROOT}/.cursor/skills/_skills-cli"
NATIVE_ROOT="${ROOT}/.cursor/skills"

if [[ ! -d "${SRC}" ]]; then
  echo "sync-from-agents: no ${SRC} (install with: npm run skills:add -- <owner/repo> -a cursor --copy -y)" >&2
  exit 0
fi

mkdir -p "${DST}"

if command -v rsync >/dev/null 2>&1; then
  rsync -a --delete "${SRC}/" "${DST}/"
else
  rm -rf "${DST:?}/"*
  cp -R "${SRC}/." "${DST}/"
fi

# Warn if a skill name collides with a top-level folder outside _skills-cli.
shopt -s nullglob
for path in "${DST}"/*/; do
  [[ -d "${path}" ]] || continue
  base="$(basename "${path}")"
  if [[ -d "${NATIVE_ROOT}/${base}" && "${base}" != "_skills-cli" ]]; then
    echo "sync-from-agents: warning — skill name \"${base}\" also exists at .cursor/skills/${base}/ (duplicate discovery risk)." >&2
  fi
done

echo "sync-from-agents: updated ${DST} from ${SRC}"
