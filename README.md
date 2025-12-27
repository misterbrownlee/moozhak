# Moozhak

A Node.js CLI tool to search the Discogs music database. Interactive session-based interface with configurable search filters.

## Requirements

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

## Installation

```bash
# Clone the repo and install dependencies
npm install
```

### Running the CLI

```bash
# Run directly with Node
node cli.js

# Or use npm start (if configured)
npm start

# Or link globally to use 'muzak' command anywhere
npm link
muzak
```

## Setup

Muzak requires a Discogs personal access token to access the API.

1. Get your token at: https://www.discogs.com/settings/developers
2. Copy `data/example.mzkconfig` to `.mzkconfig` in the project root:

```bash
cp data/example.mzkconfig .mzkconfig
```

3. Add your token to `.mzkconfig`:

```bash
DISCOGS_TOKEN=your_token_here
```

**Token priority** (first found wins):
1. `--token` flag
2. `DISCOGS_TOKEN` environment variable
3. `.mzkconfig` file (project dir → current dir → home dir)

## Usage

Start an interactive session:

```bash
$ muzak
```

Or with a token:

```bash
$ muzak --token your_token_here
```

### Interactive Session

The CLI runs as an interactive REPL. The prompt shows the current search type:

```
🎵 Muzak CLI - Interactive Session
───────────────────────────────────
✓ Discogs token configured

Type 'help' for available commands, 'exit' to quit.

muzak [master]> search Daft Punk

Searching Discogs for: "Daft Punk" (type: master)...

Found 5 result(s):

  [master] Daft Punk - Random Access Memories (2013) [88883716861]
         https://www.discogs.com/master/456789

muzak [master]> 
```

### Commands

| Command | Description |
|---------|-------------|
| `search <query>` | Search Discogs with current filters |
| `settings` | Show current session settings |
| `set type <t>` | Set search type: `artist`, `release`, `master`, `label`, `none` |
| `set per_page <n>` | Set results per page (default: 5) |
| `set verbose on/off` | Toggle verbose HTTP output |
| `set` | Show current settings |
| `clean` | Delete dist/ folder |
| `help` | Show help |
| `exit` | Exit session |

### Examples

```
muzak [all]> set type master
Search type: master

muzak [master]> search "Pretty Lights"
...

muzak [master]> set per_page 10
Results per page: 10

muzak [master]> set type artist
Search type: artist

muzak [artist]> search Bonobo
...

muzak [artist]> set type none
Search type: none (all)

muzak [all]> settings

Session Settings:
───────────────────────────────────
  type:      none (all)
  per_page:  10
  verbose:   off
```

## Configuration

All options can be set in `.mzkconfig`:

```bash
# Required: Your Discogs API token
DISCOGS_TOKEN=your_token_here

# Optional: Clean dist folder on session start
ALWAYS_CLEAN=true

# Optional: Echo commands and HTTP request/response payloads
VERBOSE=true

# Optional: Results per page (default: 5)
PER_PAGE=5

# Optional: Default search type (default: none/all)
DEFAULT_TYPE=master
```

### Search Types

| Type | Description |
|------|-------------|
| `master` | Master releases (groups all versions together) |
| `release` | Individual releases |
| `artist` | Artists |
| `label` | Record labels |
| `none` / `all` | No filter (search everything) |

## Output

Search results are saved to `dist/json/` as timestamped JSON files.

Session logs are saved to `dist/logs/`.

Use `clean` command or set `ALWAYS_CLEAN=true` to clear output files.

## Dependencies

- [disconnect](https://github.com/bartve/disconnect) - Discogs API client
- [meow](https://github.com/sindresorhus/meow) - CLI helper

## License

ISC
