# Moozhak CLI - LLM Context

**LLM Instructions:** This file is the primary context for AI coding assistants working on this project. **Keep it updated** when making changes:
- Update `README.md` if CLI options, commands, aliases, or config options change

- Add new exports to the "Key Exports by Module" table
- Update test counts in the "Test Files" table after adding/removing tests
- Add new commands to the "Interactive Commands" table
- Update "Project Structure" if files are added/removed
- Mark TODO items as complete when finished
- Add new patterns or schemas to the "Architecture" section

This ensures future sessions have accurate context.

## Overview

Node.js CLI tool for searching the Discogs music database. Features both an interactive REPL session and non-interactive command mode.

- **ES Modules** (`"type": "module"`)
- **Node.js:** v18+ (tested on v24)
- **Dependencies:** `commander` (CLI parsing), `@inquirer/prompts` (interactive REPL), `disconnect` (Discogs API client), `ansis` (terminal colors)
- **Dev Dependencies:** `jest@29` (testing with ESM support), `@biomejs/biome` (linting & formatting)

## Coding Principles

Follow these principles when modifying or extending this codebase:

### 1. Separation of Concerns

- **One module, one responsibility.** Each file in `lib/` handles a single domain:
  - `config.js` → configuration loading
  - `logger.js` → console/file output
  - `output.js` → file writing
  - `session.js` → REPL orchestration
  - `services/` → external API clients (see below)
- **External services are isolated** in `lib/services/`:
  - `discogs.js` → Discogs API interactions
  - `getsongbpm.js` → GetSongBPM API (BPM lookups)
  - `reccobeats.js` → ReccoBeats API (audio features)
  - `musicbrainz.js` → MusicBrainz API (metadata/ISRCs)
- **Commands are isolated.** Each command lives in its own file under `lib/commands/`.
- **Don't mix I/O with logic.** Keep parsing, validation, and transformation separate from API calls and file writes.

### 2. Single Responsibility Principle

- **Functions should do one thing.** If a function name includes "and", split it.
- **Small functions over large ones.** Prefer 10-20 line functions. Extract helpers.
- **Handlers delegate, they don't implement.** Command handlers should orchestrate, not contain business logic.

```javascript
// ✓ Good: handler delegates to focused functions
handler: async (args, ctx) => {
  const { type, id, error } = parseTracksArgs(args, ctx.sessionFlags.tracks_type);
  if (error) { log.error(error); return true; }
  await handleTracks(ctx.db, type, id, ctx.sessionFlags);
  return true;
}

// ✗ Bad: handler does everything inline
handler: async (args, ctx) => {
  // 50 lines of parsing, validation, API calls, formatting...
}
```

### 3. Testability First

- **Prefer pure functions.** Functions that take input and return output (no side effects) are trivially testable.
- **Extract pure logic from I/O.** Parsing, validation, transformation, and formatting should be pure.
- **Export what needs testing.** If a helper function has logic worth testing, export it.

```javascript
// ✓ Good: pure function, easy to test
export function parseTracksArgs(args, defaultType) {
  // Returns { type, id } or { error, hint }
}

// ✓ Good: I/O function uses pure helpers
export async function handleTracks(db, type, id, flags) {
  const numId = parseInt(id, 10);
  if (isNaN(numId)) { ... }  // Validation is inline but simple
  const data = await getMaster(db, numId);  // I/O
  // ...
}
```

### 4. Declarative Over Imperative

- **Use schemas for validation.** See `SETTINGS_SCHEMA` pattern—define rules as data, not code.
- **Use registries for extensibility.** See command registry pattern—add commands by adding to an array.
- **Configuration as data.** Settings, valid types, and choices are constants, not scattered conditionals.

```javascript
// ✓ Good: declarative schema
const SETTINGS_SCHEMA = {
  type: {
    validate: (v) => VALID_TYPES.includes(v),
    transform: (v) => v.toLowerCase(),
    errorMsg: 'Valid types: artist, release, master, label',
  },
};

// ✗ Bad: imperative switch statements
switch (option) {
  case 'type':
    if (!['artist', 'release', 'master', 'label'].includes(value)) { ... }
    break;
  // ... repeated for each option
}
```

### 5. Pragmatic Simplicity

- **Don't over-engineer.** Add abstraction when you have 3+ similar things, not before.
- **Avoid premature optimization.** Make it work, make it right, then make it fast (if needed).
- **Minimal dependencies.** Use built-in Node.js APIs when they suffice.
- **No unnecessary nesting.** Early returns over deep if/else chains.

```javascript
// ✓ Good: early return
if (!command) return true;
if (!cmd) { log.error('Unknown'); return true; }
// main logic here

// ✗ Bad: nested conditionals
if (command) {
  if (cmd) {
    // main logic buried here
  } else {
    log.error('Unknown');
  }
}
```

### 6. Consistent Patterns

- **Follow existing conventions.** Match the style of surrounding code.
- **Command structure is standardized.** All commands export `{ name, aliases, minArgs, usage, description, handler }`.
- **Error handling is consistent.** Use `log.error()` for user errors, throw for programmer errors.
- **Async/await everywhere.** No mixing callbacks or raw promises.

### Quick Reference: Where Does New Code Go?

| If you're adding... | Put it in... |
|---------------------|--------------|
| New CLI command | `lib/commands/<name>.js` + register in `registry.js` |
| New setting | Add to `SETTINGS_SCHEMA` in `settings.js` |
| New Discogs endpoint | Add function to `lib/services/discogs.js` |
| New external API service | Create `lib/services/<service>.js` (see `getsongbpm.js` pattern) |
| New output format | Add case to `formatTrack()` in `lib/services/discogs.js` |
| New config option | Add getter to `config.js` |
| Pure helper function | Same module, or `lib/utils.js` if shared |
| Tests for services | `tests/services/<service>.test.js` |
| Tests for commands | `tests/<command>.test.js` |

## Project Structure

```
moozhak/
├── cli.js                      # Entry point - Commander CLI definition
├── lib/
│   ├── session.js              # REPL loop, startSession(), runSearch(), runTracks()
│   ├── config.js               # Config loading from .mzkconfig, getter helpers
│   ├── logger.js               # Console styling (log object), file logging (writeLog)
│   ├── output.js               # File writers: writeJsonOutput(), writeTracksOutput()
│   ├── services/               # External API clients
│   │   ├── discogs.js          # Discogs API: createClient(), searchDiscogs(), getMaster(), getRelease()
│   │   ├── getsongbpm.js       # GetSongBPM API: findBpm(), searchSong(), getSong(), getArtist()
│   │   ├── reccobeats.js       # ReccoBeats API: getTrack(), getAudioFeatures() (free endpoints)
│   │   └── musicbrainz.js      # MusicBrainz API: searchRecordings(), getIsrcsForDiscogsRelease()
│   └── commands/
│       ├── index.js            # executeCommand(), parseInput() - main dispatcher
│       ├── registry.js         # Command assembly: findCommand(), getCommandNames()
│       ├── search.js           # searchCommand + handleSearch()
│       ├── tracks.js           # tracksCommand + handleTracks() + parseTracksArgs()
│       ├── settings.js         # settingsCommand, setCommand, SETTINGS_SCHEMA
│       ├── clean.js            # cleanCommand + handleClean()
│       ├── help.js             # helpCommand + showHelp()
│       └── exit.js             # exitCommand
├── tests/
│   ├── services/               # External API client tests
│   │   ├── discogs.test.js     # formatTrack(), formatResult() tests
│   │   ├── getsongbpm.test.js  # GetSongBPM API tests (mocked)
│   │   ├── reccobeats.test.js  # ReccoBeats API tests (mocked)
│   │   └── musicbrainz.test.js # MusicBrainz API tests (mocked) - has timing issues
│   ├── config.test.js          # Config getter tests (pure functions)
│   ├── commands.test.js        # parseInput, findCommand, parseTracksArgs, SETTINGS_SCHEMA
│   ├── search.test.js          # handleSearch with mocked API
│   ├── tracks.test.js          # handleTracks with mocked API
│   ├── settings.test.js        # handleSet, showSettings with mocked logger
│   ├── cmdExecute.test.js      # executeCommand routing tests
│   └── data/                   # Test fixtures (CSV files)
├── dist/                       # Output directory (gitignored)
│   ├── json/                   # Search/tracks JSON results
│   ├── logs/                   # Session logs
│   └── tracks/                 # Track listings (txt/csv/md)
├── example.mzkconfig           # Example config template
├── biome.json                  # Biome linter/formatter config
├── jest.config.js              # Jest ESM configuration
├── package.json
├── README.md
├── .mzkconfig                  # Local config (gitignored)
└── llm.md                      # This file (gitignored)
```

## Configuration (.mzkconfig)

Config file searched in order: project root → cwd → home directory.

```bash
DISCOGS_TOKEN=<your_token>      # Required for Discogs API access
ALWAYS_CLEAN=true               # Clean dist/ on session start
VERBOSE=true                    # Echo commands and HTTP payloads
PER_PAGE=5                      # Results per search (default: 5)
DEFAULT_TYPE=master             # Default search type: artist, release, master, label
DEFAULT_TRACKS_TYPE=master      # Default tracks source: master, release
DEFAULT_TRACKS_OUTPUT=human     # Default tracks format: human, csv, pipe, markdown
GETBPM_API_KEY=<your_key>       # GetSongBPM API key for BPM lookups (https://getsongbpm.com/api)
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
| `set [option] [value]` | Quick set: type, per_page, tracks_type, tracks_output, verbose |
| `clean` | Delete dist/ folder |
| `help` | Show help |
| `exit` | Exit session |

**Aliases:** `s` (search), `t` (tracks), `q`/`quit` (exit), `?`/`h` (help)

## Architecture

### Command Registry Pattern

Each command is self-contained in its own file (e.g., `lib/commands/search.js`):

```javascript
export const searchCommand = {
  name: 'search',
  aliases: ['s'],
  minArgs: 0,
  usage: 'search <query>',
  description: 'Search Discogs for releases or artists',
  handler: async (args, ctx) => { ... },
};
```

Commands are assembled in `lib/commands/registry.js`:

```javascript
const commandList = [searchCommand, tracksCommand, ...];
const commands = Object.fromEntries(commandList.map(cmd => [cmd.name, cmd]));

export function findCommand(name) { ... }  // Lookup by name or alias
export function getCommandNames() { ... }  // For autocomplete
```

### Settings Schema

Settings are defined declaratively in `lib/commands/settings.js`:

```javascript
export const SETTINGS_SCHEMA = {
  type: {
    label: 'Search Type',
    validate: (v) => VALID_TYPES.includes(v),
    transform: (v) => v.toLowerCase(),
    format: (v) => v || 'none (all)',
    errorMsg: 'Valid types: artist, release, master, label',
    choices: [...],
  },
  // per_page, tracks_type, tracks_output, verbose...
};
```

### Key Exports by Module

| Module | Exports |
|--------|---------|
| `config.js` | `fileConfig`, `loadConfig()`, `getPerPage()`, `getDefaultType()`, `getDefaultTracksType()`, `getDefaultTracksOutput()`, `getGetBpmApiKey()`, `isVerbose()`, `projectRoot` |
| `logger.js` | `log` (styled console), `initLog()`, `writeLog()`, `logApiResponse()` |
| `output.js` | `distDir`, `ensureDistDir()`, `writeJsonOutput()`, `writeTracksOutput()` |
| `session.js` | `startSession()`, `runSearch()`, `runTracks()`, `createSessionFlags()` |
| `services/discogs.js` | `createClient()`, `searchDiscogs()`, `getMaster()`, `getRelease()`, `formatResult()`, `formatTrack()`, `buildDiscogsUrl()`, `buildDiscogsUrlFromUri()` |
| `services/getsongbpm.js` | `findBpm()`, `searchSong()`, `searchByTitle()`, `searchArtist()`, `getSong()`, `getArtist()`, `formatBpmResult()`, `isConfigured()` |
| `services/reccobeats.js` | `getTrack()`, `getTracks()`, `getAudioFeatures()`, `getArtist()`, `getTrackWithFeatures()`, `formatBpm()`, `formatAudioFeatures()`, `isValidReccoBeatsId()` |
| `services/musicbrainz.js` | `lookupByUrl()`, `lookupByDiscogsRelease()`, `getRelease()`, `getRecording()`, `searchRecordings()`, `getIsrcsForDiscogsRelease()`, `findTrackIsrcs()`, `isValidMbid()` |
| `commands/index.js` | `executeCommand()`, `parseInput()`, `findCommand()`, `getCommandNames()` |
| `commands/search.js` | `searchCommand`, `handleSearch()`, `buildSearchOutput()` |
| `commands/tracks.js` | `tracksCommand`, `handleTracks()`, `parseTracksArgs()`, `extractReleaseInfo()`, `buildTracksOutput()` |
| `commands/settings.js` | `settingsCommand`, `setCommand`, `handleSet()`, `showSettings()`, `SETTINGS_SCHEMA` |

## External APIs

### Discogs API

Using the `disconnect` library. Endpoints used:

| Method | Description |
|--------|-------------|
| `db.search(params)` | Search database |
| `db.getMaster(id)` | Get master release with tracklist |
| `db.getRelease(id)` | Get release with tracklist |

### GetSongBPM API

**Base URL:** `https://api.getsong.co`  
**Auth:** API key via `api_key` query param (get free key at https://getsongbpm.com/api)  
**Rate Limit:** 3,000 requests/hour

| Endpoint | Description |
|----------|-------------|
| `GET /search/?type=both&lookup=song:X artist:Y` | Search by artist + title |
| `GET /song/?id=X` | Get song details (BPM, key, time sig) |
| `GET /artist/?id=X` | Get artist details |

**Response includes:** `tempo` (BPM), `key_of`, `time_sig`, `danceability`, `acousticness`, `open_key`

### ReccoBeats API

**Base URL:** `https://api.reccobeats.com/v1`  
**Auth:** None for free endpoints (search requires auth)  
**Note:** Uses Spotify-based UUIDs, not Discogs IDs

| Endpoint | Auth | Description |
|----------|------|-------------|
| `GET /track/:uuid` | Free | Get track details |
| `GET /track/:uuid/audio-features` | Free | Get BPM, energy, danceability |
| `GET /track?ids=x,y,z` | Free | Batch get tracks |
| `GET /artist/:uuid` | Free | Get artist details |
| `GET /tracks/search` | 🔒 | Search tracks (requires auth) |
| `GET /isrc/:isrc` | 🔒 | Lookup by ISRC (requires auth) |

### MusicBrainz API

**Base URL:** `https://musicbrainz.org/ws/2`  
**Auth:** None (requires User-Agent header)  
**Rate Limit:** 1 request/second

| Endpoint | Description |
|----------|-------------|
| `GET /url?resource=X` | Lookup by external URL (Discogs, Spotify, etc.) |
| `GET /release/:mbid?inc=recordings+isrcs` | Get release with ISRCs |
| `GET /recording/:mbid?inc=isrcs` | Get recording with ISRCs |
| `GET /recording?query=X` | Search recordings by artist/title |

**Use case:** Bridge Discogs releases to ISRCs for cross-referencing with other services

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

- `human` - Readable text format (`.txt`)
- `csv` - Comma-separated values (`.csv`)
- `pipe` - Pipe-separated values (`.txt`)
- `markdown` - Markdown table (`.md`)

## Linting & Formatting

Using **Biome** for linting and formatting (single tool, zero-config, fast).

### Run Linter

```bash
npm run lint            # Check for lint/format issues
npm run lint:fix        # Auto-fix lint issues
npm run format          # Format all files
```

### Biome Configuration

See `biome.json`:
- **Indent:** 2 spaces
- **Quotes:** Single quotes
- **Semicolons:** Always
- **Rules:** Recommended ruleset

Key rules enforced:
- `node:` protocol for Node.js imports (`node:fs`, `node:path`)
- `Number.isNaN()` over global `isNaN()`
- `===` over `==` (except null checks)
- No unused variables/imports
- Sorted imports

## Testing

Using **Jest 29** with ES Modules support (`--experimental-vm-modules`).

### Run Tests

```bash
npm test                # Run all tests (verbose by default)
npm run test:watch      # Watch mode
npm run test:coverage   # With coverage report
```

### Test Files (318 tests total)

| File | Tests | Description |
|------|-------|-------------|
| `services/discogs.test.js` | 27 | `formatTrack()`, `formatResult()`, `buildDiscogsUrl()`, `buildDiscogsUrlFromUri()` |
| `services/getsongbpm.test.js` | 27 | `findBpm()`, `searchSong()`, `formatBpmResult()` (mocked API) |
| `services/reccobeats.test.js` | 37 | `getTrack()`, `getAudioFeatures()`, `formatBpm()` (mocked API) |
| `services/musicbrainz.test.js` | 22 | `searchRecordings()`, `getIsrcsForDiscogsRelease()` (mocked - has timing issues) |
| `config.test.js` | 37 | Config getter validation (pure functions) |
| `commands.test.js` | 63 | `parseInput`, `findCommand`, `parseTracksArgs`, `SETTINGS_SCHEMA` validators |
| `search.test.js` | 24 | `handleSearch`, `searchCommand`, `buildSearchOutput` (mocked API + pure) |
| `tracks.test.js` | 39 | `handleTracks`, `tracksCommand`, `extractReleaseInfo`, `buildTracksOutput` (mocked API + pure) |
| `settings.test.js` | 37 | `handleSet`, `showSettings` (mocked logger) |
| `cmdExecute.test.js` | 27 | `executeCommand` routing, aliases, error handling |

### Testing Strategy

**Pure functions (no mocks):**
- Config getters: `getPerPage()`, `getDefaultType()`, `getGetBpmApiKey()`, etc.
- Formatters: `formatTrack()`, `formatResult()`, `formatBpm()`, `formatBpmResult()`, `formatAudioFeatures()`
- URL builders: `buildDiscogsUrl()`, `buildDiscogsUrlFromUri()`
- Output builders: `buildSearchOutput()`, `buildTracksOutput()`, `extractReleaseInfo()`
- Parsers: `parseInput()`, `parseTracksArgs()`
- Validators: `SETTINGS_SCHEMA.*.validate/transform`, `isValidReccoBeatsId()`, `isValidMbid()`
- Registry: `findCommand()`, `getCommandNames()`

**With mocks (Jest `unstable_mockModule`):**
- Command handlers: `handleSearch()`, `handleTracks()`
- Settings: `handleSet()`, `showSettings()`
- Routing: `executeCommand()`
- External APIs: `findBpm()`, `searchSong()`, `getTrack()`, `getAudioFeatures()`, `searchRecordings()`

### Jest ESM Mocking Pattern

```javascript
import { jest } from '@jest/globals';

// Mock BEFORE importing module under test
jest.unstable_mockModule('../lib/discogs.js', () => ({
  searchDiscogs: jest.fn().mockResolvedValue([]),
}));

jest.unstable_mockModule('../lib/logger.js', () => ({
  log: { plain: jest.fn(), error: jest.fn(), ... },
  writeLog: jest.fn(),
  logApiResponse: jest.fn(),
}));

// Dynamic import AFTER mocking
const { handleSearch } = await import('../lib/commands/search.js');
```

**Note:** When mocking `logger.js`, include all exports used by transitive dependencies (`log`, `writeLog`, `logApiResponse`, `initLog`).

### Untested (by design)

- `startSession()` - Complex REPL loop, integration test territory
- `handleClean()` - Trivial file deletion
- `showHelp()` - Static string output
- `createClient()` - Just instantiates Discogs SDK

## TODO

- [ ] Add `bpm` command for interactive BPM lookups via GetSongBPM
- [ ] Re-enable playlist command (CSV batch search)
- [ ] `--open` flag to open results in browser
- [ ] Additional Discogs endpoints (artist details, etc.)
- [ ] Autocomplete for commands using `@inquirer/search`
- [ ] Fix MusicBrainz test timing issues (rate limit simulation)
- [x] Tests (Jest setup with pure function tests)
- [x] Tests for command handlers with mocks
- [x] GetSongBPM integration for BPM lookups
- [x] ReccoBeats integration (free endpoints only)
- [x] MusicBrainz integration for ISRC bridging
