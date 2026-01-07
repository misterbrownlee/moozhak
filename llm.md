# Moozhak CLI - LLM Context

## Overview

Node.js CLI tool for searching the Discogs music database. Features both an interactive REPL session and non-interactive command mode.

- **ES Modules** (`"type": "module"`)
- **Dependencies:** `commander` (CLI parsing), `@inquirer/prompts` (interactive REPL), `disconnect` (Discogs API client), `ansis` (terminal colors)

## Project Structure

```
moozhak/
├── cli.js                      # Entry point - Commander CLI definition
├── lib/
│   ├── session.js              # REPL session with Inquirer, non-interactive runners
│   ├── config.js               # Config loading, helpers: isVerbose(), getPerPage(), etc.
│   ├── logger.js               # Session logging: initLog(), writeLog(), log object
│   ├── discogs.js              # API client: createClient(), searchDiscogs(), getMaster(), etc.
│   ├── output.js               # JSON/tracks output: ensureDistDir(), writeJsonOutput()
│   └── commands/
│       ├── index.js            # Command registry, executeCommand(), parseInput()
│       ├── settings.js         # Settings schema, handleSettings(), handleSet()
│       ├── search.js           # handleSearch()
│       ├── tracks.js           # handleTracks()
│       └── clean.js            # handleClean()
├── data/
│   ├── example.mzkconfig       # Example config template
│   ├── template.json           # JSON output template
│   └── example-playlist.csv    # Example data
├── dist/                       # Output directory (gitignored)
│   ├── json/                   # Search/tracks results
│   ├── logs/                   # Session logs
│   └── tracks/                 # Track listings
├── .mzkconfig                  # Local config (gitignored)
└── llm.md                      # This file (gitignored)
```

## Configuration (.mzkconfig)

```bash
DISCOGS_TOKEN=<your_token>      # Required for API access
ALWAYS_CLEAN=true               # Clean dist/ on session start
VERBOSE=true                    # Echo commands and HTTP payloads
PER_PAGE=5                      # Results per search (default: 5)
DEFAULT_TYPE=master             # Default search type: artist, release, master, label
DEFAULT_TRACKS_TYPE=master      # Default tracks source: master, release
DEFAULT_TRACKS_OUTPUT=human     # Default tracks format: human, csv, pipe, markdown
```

## CLI Usage

### Interactive Mode (default)

```bash
moozhak                         # Start interactive session
moozhak --token <token>         # With explicit token
```

### Non-Interactive Commands

```bash
# Search
moozhak search "Daft Punk"
moozhak search "Bonobo" --type master --limit 10

# Get tracks
moozhak tracks 27113
moozhak tracks 249504 --type release --format csv
```

## Session State

```javascript
sessionFlags = {
  type: null,           // 'artist' | 'release' | 'master' | 'label' | null
  per_page: 5,          // Results per page
  verbose: false,       // Echo HTTP requests/responses
  tracks_type: 'master',// Default tracks source
  tracks_output: 'human'// Output format for tracks
}
```

## Interactive Commands

| Command | Description |
|---------|-------------|
| `search <query>` | Search Discogs with current filters |
| `tracks <id>` | Get tracklist using current tracks_type setting |
| `tracks <type> <id>` | Get tracklist (type: master or release) |
| `settings` | Interactive settings menu (Inquirer select) |
| `set <option> <value>` | Quick set: type, per_page, tracks_type, tracks_output, verbose |
| `clean` | Delete dist/ folder |
| `help` | Show help |
| `exit` | Exit session |

**Aliases:** `s` (search), `t` (tracks), `q`/`quit` (exit), `?`/`h` (help)

## Architecture

### Command Registry Pattern

Commands are defined in `lib/commands/index.js`:

```javascript
const commands = {
  search: {
    aliases: ['s'],
    minArgs: 1,
    usage: 'search <query>',
    handler: async (args, ctx) => { ... },
  },
  // ...
};
```

### Settings Schema

Settings are defined declaratively in `lib/commands/settings.js`:

```javascript
const SETTINGS_SCHEMA = {
  type: {
    label: 'Search Type',
    validate: (v) => VALID_TYPES.includes(v),
    transform: (v) => v.toLowerCase(),
    choices: [...],
  },
  // ...
};
```

## Discogs API

Using the `disconnect` library. Endpoints used:

| Method | Description |
|--------|-------------|
| `db.search(params)` | Search database |
| `db.getMaster(id)` | Get master release with tracklist |
| `db.getRelease(id)` | Get release with tracklist |

## Output Formats

### Search Results (`dist/json/search-*.json`)

```json
{
  "type": "search",
  "params": { "query": "...", "searchType": "master", "per_page": 5 },
  "result": {
    "tracks": [{
      "title": "...",
      "artist": "...",
      "match": { "type": "master", "year": 2013, "url": "...", "id": 123 }
    }]
  }
}
```

### Tracks Output

- `human` - Readable text format
- `csv` - Comma-separated values
- `pipe` - Pipe-separated values  
- `markdown` - Markdown table

## TODO

- [ ] Re-enable playlist command (CSV batch search)
- [ ] `--open` flag to open results in browser
- [ ] Additional Discogs endpoints (artist details, etc.)
- [ ] Tests
- [ ] Autocomplete for commands using `@inquirer/search`
