# Muzak CLI - LLM Context

## Overview

Node.js CLI tool for searching the Discogs music database. Interactive REPL session with configurable search filters.

- **ES Modules** (`"type": "module"`)
- **Dependencies:** `meow` (CLI parsing), `disconnect` (Discogs API client)

## Project Structure

```
muzak/
├── cli.js                      # Entry point - interactive REPL
├── lib/
│   ├── config.js               # Config loading, helpers: isVerbose(), getPerPage(), getDefaultType()
│   ├── logger.js               # Session logging: initLog(), writeLog(), logApiResponse()
│   ├── discogs.js              # API client: createClient(), searchDiscogs(), formatResult()
│   ├── output.js               # JSON output: ensureDistDir(), writeJsonOutput()
│   └── commands/
│       ├── search.js           # handleSearch()
│       └── clean.js            # handleClean()
├── data/
│   ├── example.mzkconfig       # Example config template
│   ├── template.json           # JSON output template
│   └── example-playlist.csv    # Example data
├── dist/                       # Output directory (gitignored)
│   ├── json/                   # Search results
│   └── logs/                   # Session logs
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
```

## Session State

```javascript
sessionFlags = {
  type: null,      // 'artist' | 'release' | 'master' | 'label' | null
  per_page: 5,     // Results per page
  verbose: false   // Echo HTTP requests/responses
}
```

## CLI Commands

| Command | Description |
|---------|-------------|
| `search <query>` | Search Discogs with current filters |
| `settings` | Show current session settings |
| `set type <t>` | Set search type: artist, release, master, label, none |
| `set per_page <n>` | Set results per page |
| `set verbose on/off` | Toggle verbose HTTP output |
| `set` | Show current settings (alias for settings) |
| `clean` | Delete dist/ folder |
| `help` | Show help |
| `exit` | Exit session |

**Prompt:** Shows current search mode: `muzak [master]>` or `muzak [all]>`

## Discogs API

Using the `disconnect` library. Currently uses one endpoint:

### `database.search(params)`

Search the Discogs database.

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Search query |
| `type` | string | Filter: `artist`, `release`, `master`, `label` |
| `per_page` | number | Results per page (1-100) |

**Response fields used:**
- `results[].type` — Result type
- `results[].title` — Artist - Title format
- `results[].year` — Release year
- `results[].catno` — Catalog number
- `results[].uri` — Path for Discogs URL
- `results[].id` — Discogs ID

**Example call:**
```javascript
const data = await db.search({ q: 'Daft Punk', type: 'master', per_page: 5 });
```

## Output Format

Search results saved to `dist/json/search-<timestamp>.json`:

```json
{
  "type": "search",
  "params": {
    "query": "...",
    "searchType": "master",
    "per_page": 5
  },
  "result": {
    "tracks": [{
      "title": "...",
      "artist": "...",
      "match": {
        "type": "master",
        "year": 2013,
        "url": "https://www.discogs.com/...",
        "id": 123456
      }
    }]
  }
}
```

## TODO

- [ ] Re-enable playlist command (CSV batch search)
- [ ] `--open` flag to open results in browser
- [ ] Additional Discogs endpoints (get release details, etc.)
- [ ] Tests
