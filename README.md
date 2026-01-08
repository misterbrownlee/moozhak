# Moozhak

A Node.js CLI tool to search the Discogs music database. Features both an interactive REPL session and non-interactive command mode.

## Requirements

- [Node.js](https://nodejs.org/) v18 or higher
- npm (comes with Node.js)

## Installation

```bash
# Clone the repo and install dependencies
npm install

# Link globally to use 'moozhak' command anywhere
npm link
```

## Setup

Moozhak requires a Discogs personal access token to access the API.

1. Get your token at: https://www.discogs.com/settings/developers
2. Copy `example.mzkconfig` to `.mzkconfig` in the project root:

```bash
cp example.mzkconfig .mzkconfig
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

### Interactive Mode (default)

Start an interactive REPL session:

```bash
moozhak
# or with explicit token
moozhak --token your_token_here
```

### Non-Interactive Mode

Run commands directly from the shell:

```bash
# Search
moozhak search "Daft Punk"
moozhak search "Bonobo" --type master --limit 10

# Get tracks from a release
moozhak tracks 27113
moozhak tracks 249504 --type release --format csv
```

## Interactive Commands

| Command | Description |
|---------|-------------|
| `search` | Show current search settings |
| `search <query>` | Search Discogs with current filters |
| `tracks <id>` | Get tracklist using current tracks_type setting |
| `tracks <type> <id>` | Get tracklist (type: `master` or `release`) |
| `settings` | Interactive settings menu |
| `set <option> <value>` | Quick set an option |
| `clean` | Delete dist/ folder |
| `help` | Show help |
| `exit` | Exit session |

**Aliases:** `s` (search), `t` (tracks), `q`/`quit` (exit), `?`/`h` (help)

### Settings Options

| Option | Values | Description |
|--------|--------|-------------|
| `type` | `artist`, `release`, `master`, `label`, `none` | Search type filter |
| `per_page` | number | Results per page (default: 5) |
| `tracks_type` | `master`, `release` | Default source for tracks command |
| `tracks_output` | `human`, `csv`, `pipe`, `markdown` | Tracks output format |
| `verbose` | `on`, `off` | Echo HTTP requests/responses |

### Example Session

```
↳ search Daft Punk

────────────────────────────────────────────────────
 :: Starting search on Discogs for: "Daft Punk" ...
 -> Found 5 result(s):
...

↳ tracks 27113

────────────────────────────────────────────────────
 :: Fetching master #27113 from Discogs...
 -> Found: master #27113 - Daft Punk - Daft Club
...

↳ set type master
 -> Search Type: master

↳ settings
  (interactive menu opens)
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

# Optional: Default tracks source (default: master)
DEFAULT_TRACKS_TYPE=master

# Optional: Default tracks output format (default: human)
DEFAULT_TRACKS_OUTPUT=human
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

- Search results → `dist/json/search-*.json`
- Tracks results → `dist/json/tracks-*.json`
- Track listings → `dist/tracks/` (txt, csv, or md based on format)
- Session logs → `dist/logs/`

Use `clean` command or set `ALWAYS_CLEAN=true` to clear output files.

## Development

```bash
npm test              # Run tests
npm run test:watch    # Watch mode
npm run test:coverage # Coverage report
```

For coding principles, architecture documentation, and contribution guidelines, see **[llm.md](./llm.md)**.

## Dependencies

- [commander](https://github.com/tj/commander.js) - CLI framework
- [@inquirer/prompts](https://github.com/SBoudrias/Inquirer.js) - Interactive prompts
- [disconnect](https://github.com/bartve/disconnect) - Discogs API client
- [ansis](https://github.com/nicolo-ribaudo/ansis) - Terminal colors

Looking into:
- [Get BPM](https://getsongbpm.com) which has an API.

## License

ISC
