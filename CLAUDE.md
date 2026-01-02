# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Project Overview

**Playlist Notes** is an accessibility-first playlist annotator built with React + Vite. Users import public playlists from Spotify/YouTube/SoundCloud, add per-track notes and tags, and sync those annotations across devices via anonymous device IDs and recovery codes.

Key capabilities:
- Import playlists through adapter registry (Spotify, YouTube, SoundCloud)
- Per-track notes with inline undo (10-minute window)
- Tag management with debounced sync (350ms)
- Multi-device sync via anonymous device IDs and recovery codes
- localStorage persistence (versioned schema v6) with auto-migration
- Accessibility-first: ARIA live regions, keyboard shortcuts, focus management

---

## Development Commands

### Build & Development
```bash
npm run dev          # Start Vite dev server (http://localhost:5173)
npm run build        # Production build
npm run preview      # Preview production build
npm run lint         # Run ESLint
```

### Testing
```bash
npm test             # Run all tests once (Vitest)
npm run test:watch   # Run tests in watch mode
npm run test:ui      # Open Vitest UI
npm run test:ci      # CI mode with basic reporter
```

**Running Individual Tests:**
```bash
npx vitest run src/features/import/__tests__/useImportPlaylist.test.js
npx vitest watch src/components/__tests__/RestoreDialog.test.jsx
```

**Coverage Thresholds:**
- Statements: 60%
- Branches: 55%
- Functions: 70%
- Lines: 60%

---

## Architecture Overview

### App Component Structure

The app is split into two layers:
1. **Outer `App`**: Bootstraps storage state, computes initial playlist state, provides context
2. **Inner `AppInner`**: Consumes context, manages UI state (screen, import, etc.)

**Playlist State Management:**
- Centralized in `PlaylistStateProvider` (React Context + useReducer)
- Pure reducer (`playlistReducer`) handles all state transitions
- Narrow selector hooks prevent unnecessary re-renders
- Refs (notesByTrack, tagsByTrack, tracksRef) retained for async operations (deferred to Commit 7)

**Other State:**
- Import state (URL, error, metadata) - local state in AppInner
- Screen routing (landing → playlist) - local state in AppInner
- Device/recovery flows - managed via useDeviceRecovery hook
- Recent playlists - local state + persistence

**Rationale:** Context provider centralizes playlist state, enables testing in isolation, and prepares for extracting effects to provider in Commit 7.

### Feature-Module Organization

Code is organized by domain, not by file type:

```
src/features/
├── a11y/          # Accessibility (useAnnounce hook, LiveRegion)
├── account/       # Device recovery & identity management (useDeviceRecovery hook)
├── filter/        # Filtering utilities
├── import/        # Import orchestration + adapters + caching
├── landing/       # Landing/import screen (LandingScreen.jsx)
├── notes/         # Note operations (useNoteHandlers, noteDeleteQueue)
├── playlist/      # Playlist UI (PlaylistView, TrackCard, NoteList)
├── podcast/       # Podcast-specific UI (PodcastView, feature flags)
├── recent/        # Recent playlists management
├── tags/          # Tag utilities, sync queue
└── undo/          # Inline undo with 10-minute timers
```

### Global Hooks

```
src/hooks/
└── useGlobalKeybindings.js  # Global keyboard shortcuts (Ctrl+Z undo, Home navigation)
```

Each feature module contains:
- Hooks (e.g., `usePlaylistImportFlow`, `useInlineUndo`)
- UI components (JSX)
- Utilities (normalization, validation)
- Tests in `__tests__/` subdirectories

### Critical Data Flow: Import → Normalize → Persist → Tag

```
URL Input
  ↓
detectProvider() → Spotify/YouTube/SoundCloud detection
  ↓
useImportPlaylist() → adapter registry lookup (ADAPTER_REGISTRY)
  ↓
AdapterA.importPlaylist() → { provider, tracks[], meta, pageInfo }
  ↓
usePlaylistImportFlow (internal: buildTracks/buildMeta) → normalizes to { id, title, artist, notes[], tags[] }
  ↓
App.jsx applyImportResult() → attaches notesByTrack, tagsByTrack, routes to playlist screen
  ↓
saveAppState() → localStorage (LS_KEY: 'sta:v6')
  ↓
Tracks display with note/tag UI
```

### Adapter Pattern (Import Providers)

**Contract Definition:** `src/features/import/adapters/types.js`

```javascript
PlaylistAdapter(options) → Promise<PlaylistAdapterResult>

options: {
  url: string
  cursor?: string       // for pagination
  signal?: AbortSignal
  context?: Record<string, any>
  fetchClient?: Function
}

result: {
  provider: 'spotify' | 'youtube' | 'soundcloud'
  playlistId: string
  title: string
  tracks: NormalizedTrack[]
  pageInfo: { cursor, hasMore }
  total?: number
  coverUrl?: string
  snapshotId?: string   // Spotify-specific
}
```

**Adapter Registry:**
- Located in: `src/features/import/useImportPlaylist.js`
- Enable/disable providers by commenting out registry entries
- Falls back to mock data if adapter throws or is unavailable
- Each adapter in: `src/features/import/adapters/{spotifyAdapter,youtubeAdapter,soundcloudAdapter}.js`

**Error Handling:**
- Centralized error codes: `src/features/import/errors.js` (`ERR_UNSUPPORTED_URL`, `ERR_NOT_FOUND`, `ERR_PRIVATE_PLAYLIST`, etc.)
- `createAdapterError(code, details, cause)` creates standardized errors
- UI maps codes to friendly messages via `ERROR_MAP`

---

## API Structure (Serverless Functions)

All API routes are serverless functions deployed to Vercel:

### Anonymous Device Endpoints
- **POST /api/anon/bootstrap** → Returns deviceId (header), anonId, recoveryCode
- **POST /api/anon/restore** → Accepts recoveryCode, swaps device identity
- **POST /api/anon/recovery** → Rotates the recovery code (CSRF-protected + rate limited) and returns the new code plus timestamp

### Database Endpoints
- **GET /api/db/notes** → Returns an array of `{ id, trackId, body, tags[] }` records (tags live on each note; no standalone `tags[]` payload)
- **POST /api/db/notes** → Body: { trackId, body?, tags? } → Syncs to Supabase

### Spotify Proxy
- **POST /api/spotify/token** → Exchanges client credentials for Spotify access token (Vite proxies in dev)

**Device ID Propagation:**
- Every API request includes `x-device-id` header (via `apiFetch` in `src/lib/apiClient.js`)
- Response header `x-device-id` updates local device context
- Enables multi-device sync and recovery flows

---

## localStorage & Persistence

### Versioned Storage Schema (v6)

**Primary Key:** `sta:v6`

**Shape:**
```javascript
{
  version: 6
  theme: 'dark' | 'light'
  uiPrefs: { font: 'default' | 'system' | 'dyslexic' }
  playlistTitle: string
  importedAt: ISO timestamp | null
  lastImportUrl: string
  tracks: PersistedTrack[]
  importMeta: {
    provider, playlistId, snapshotId, cursor, hasMore, sourceUrl, debug,
    contentKind: 'music' | 'podcast'  // content type classification
  }
  notesByTrack: Record<trackId, NoteObject[]>  // Notes now support timestamps
  tagsByTrack: Record<trackId, string[]>
  recentPlaylists: RecentPlaylist[]  // max 8, deduplicated by ${provider}:${playlistId}
}

// Extended track fields for podcasts:
PersistedTrack: { id, title, artist, kind?, showId?, showName?, publisher?, description? }

// Note object with optional timestamp range:
NoteObject: { body: string, timestampMs?: number, timestampEndMs?: number }
```

**Additional localStorage Keys:**
- `sta:playlist-cache:v1` → Playlist import cache (max 5 entries)
- `sta:pending-note-deletes` → Offline-first note deletion queue
- `sta:pending-migration` → Migration snapshot for crash recovery
- `st:deviceId` → Device identifier for multi-device sync

**Migration System (v5 → v6):**
1. On load, `loadAppState` normalizes legacy payloads into the v6 shape (including `uiPrefs`).
2. The normalized data is written to `sta:v6:pending-migration` so we can recover later if we need to re-run merges.
3. A fresh copy of that normalized payload is immediately persisted at `sta:v6`; this step is purely local�no network requests are fired here.
4. React bootstrap hydrates from the upgraded state, and the playlist provider later fetches/merges remote notes + tags via its own sync effect.
5. Auto-backup snapshots still run before long persistence operations to keep a user-accessible JSON backup handy.

**Utilities:**
- `src/utils/storage.js` → `saveAppState`, `loadAppState`, `getPendingMigrationSnapshot`
- Normalization: `sanitizeTracks`, `sanitizeNotesMap`, `sanitizeTagsMap`
- Recents management: `upsertRecent`, `removeRecent`, `updateRecent`

---

## Undo System

### Inline Undo (10-Minute Window)

**Hook:** `src/features/undo/useInlineUndo.js`

```javascript
const { scheduleInlineUndo, undoInline, expireInline, isPending } = useInlineUndo({
  timeoutMs: 600000,  // 10 minutes
  onExpire: (id) => announce('Note deleted')
})

// On delete:
scheduleInlineUndo(trackId, { note: 'Original text', focusId: 'delete-btn' })

// Keyboard shortcut: Ctrl+Z calls undoInline()
// Auto-expires after 10 minutes, calls onExpire callback
```

**Implementation:**
- `pending: Map<id, meta>` tracks active undo slots
- Each entry has a 10-minute timeout
- Undo restores state + returns focus to original delete button
- Integrates with `notesByTrack` in App.jsx

---

## Demo Playlist System

New users see a demo playlist with pre-authored notes and tags to demonstrate the app's features.

**Implementation:**
- `src/data/demoPlaylist.js` → Demo configuration (DEMO_PLAYLIST_URL, DEMO_NOTES_BY_TRACK, DEMO_TAGS_BY_TRACK)
- `src/components/DemoCard.jsx` → Landing page card for demo
- Demo mode is **read-only** until user imports their own playlist

**Behavior:**
- Shows demo playlist when no real playlist has been imported
- Pre-populated notes demonstrate timestamp linking and formatting
- User can explore but cannot modify demo content
- Importing any real playlist exits demo mode

---

## Podcast Support

Podcast imports are behind a feature flag (`VITE_ENABLE_PODCASTS`).

**Implementation:**
- `src/features/podcast/PodcastView.jsx` → Lightweight wrapper around PlaylistView
- `src/utils/podcastFlags.js` → Feature flag helpers
- `importMeta.contentKind` distinguishes `'music'` vs `'podcast'`
- Extended track fields: `kind`, `showId`, `showName`, `publisher`, `description`

**Note Timestamps:**
- `src/features/playlist/noteTimestamps.js` → Timestamp parsing/formatting
- Supports MM:SS and HH:MM:SS formats
- Range support: `timestampMs` to `timestampEndMs`
- Timestamps render as clickable links (for future player integration)

---

## Accessibility Implementation

### Custom Accessibility Layer (`features/a11y/`)

**useAnnounce Hook:**
```javascript
const { announce } = useAnnounce({ debounceMs: 60 })
announce('Playlist imported. 42 tracks.')
```

- Debounced announcements (60ms) to avoid spam
- Writes to hidden `role="status" aria-live="polite"` region
- All user actions announce: imports, errors, tag/note operations

**Focus Management Pattern:**
```javascript
import { focusById } from '@/utils/focusById'
focusById('track-note-btn-0')  // Uses requestAnimationFrame
```

- After import → focus first track's "Add Note" button
- On error → focus input and select all
- On undo → restore focus to delete button

**Keyboard Shortcuts:**
- `Ctrl/Cmd+Z`: undo last note deletion
- Tab/Shift+Tab: navigate all interactive elements
- Enter/Space: activate buttons

---

## Important Architectural Decisions

| Decision | Rationale |
|----------|-----------|
| **Centralized playlist state** | PlaylistStateProvider with reducer pattern centralizes playlist management; pure reducer with validated actions enables predictable state transitions; narrow selector hooks optimize re-renders; comprehensive test coverage ensures reliability |
| **Feature modules over routes** | Organizes code by domain (import, tags, undo); enables tree-shaking; colocates tests with implementation |
| **localStorage v6 versioning** | Smooth migrations with auto-fallback; pending snapshot approach preserves data across crashes |
| **Device ID propagation** | Enables multi-device sync; recovery codes tied to device identity (security); auto-discovery via bootstrap |
| **Adapter pattern + registry** | Decouples providers (Spotify/YouTube/SoundCloud); easy to mock or swap; centralized error handling |
| **Debounced tag sync (350ms)** | Batches rapid tag changes; reduces API load; 60ms announce debounce prevents announcement spam |
| **Inline undo (time-bounded)** | Simpler than redo stack; 10-minute auto-expire; no complex state branches; Ctrl+Z familiar to users |
| **Optimistic updates** | Responsive UI; rollback on error; combined with announce "Tag sync failed" if needed |
| **Accessibility-first** | useAnnounce for all feedback; keyboard-navigable; focus management; semantic HTML; ARIA labels |

---

## Key Code Locations

### Core Application Logic
- **src/App.jsx** → Main app component (screen routing, state management)
- **src/main.jsx** → Entry point (ThemeProvider wrapper)

### Features

**Playlist State:**
- **src/features/playlist/PlaylistProvider.jsx** → Context provider for playlist state (wraps useReducer)
- **src/features/playlist/usePlaylistContext.js** → Context hooks (usePlaylistDispatch, narrow selectors)
- **src/features/playlist/playlistReducer.js** → Pure reducer for playlist state transitions
- **src/features/playlist/actions.js** → Validated action creators
- **src/features/playlist/helpers.js** → Pure helper functions (computeHasLocalNotes, validateTag, isPodcastTrack, etc.)
- **src/features/playlist/contexts.js** → Separated context definitions (PlaylistStateContext, PlaylistDispatchContext, PlaylistSyncContext)
- **src/features/playlist/buildInitialPlaylistState.js** → Bootstrap builder for transforming storage → reducer state
- **src/features/playlist/noteTimestamps.js** → Timestamp parsing/formatting (MM:SS, HH:MM:SS, ranges)

**Import System:**
- **src/features/import/usePlaylistImportController.js** → High-level import controller (initial import, recents, reimport, load-more)
- **src/features/import/usePlaylistImportFlow.js** → Lower-level adapter flow (guards, request lifecycles)
- **src/features/import/useImportPlaylist.js** → Adapter registry + provider detection
- **src/features/import/adapters/** → Spotify/YouTube/SoundCloud adapters
- **src/features/import/normalizeTrack.js** → Track normalization
- **src/features/import/playlistCache.js** → localStorage-based import caching (max 5 entries)
- **src/features/import/playlistIdentity.js** → Canonical playlist identity/key derivation
- **src/features/import/usePersistentPlaylistCache.js** → Hook for in-memory cache synced with localStorage

**Notes:**
- **src/features/notes/useNoteHandlers.js** → Centralized hook for note CRUD operations
- **src/features/notes/noteDeleteQueue.js** → Offline-first queue for note deletions

**Other Features:**
- **src/features/account/useDeviceRecovery.js** → Device identity & recovery management hook
- **src/features/tags/tagSyncQueue.js** → Debounced tag sync queue (exports createTagSyncScheduler)
- **src/features/undo/useInlineUndo.js** → Inline undo hook
- **src/features/a11y/useAnnounce.js** → Accessibility announcements
- **src/hooks/useGlobalKeybindings.js** → Global keyboard shortcuts (Ctrl+Z, Home)

### Components
- **src/features/playlist/PlaylistView.jsx** → Main playlist display
- **src/features/playlist/TrackCard.jsx** → Individual track cards
- **src/features/playlist/NoteList.jsx** → Note list with timestamp display
- **src/features/landing/LandingScreen.jsx** → Landing/import screen
- **src/features/podcast/PodcastView.jsx** → Podcast-specific UI wrapper
- **src/features/recent/RecentPlaylists.jsx** → Recent playlists carousel
- **src/components/RestoreDialog.jsx** → Recovery code input dialog
- **src/components/RecoveryModal.jsx** → Display new recovery codes
- **src/components/UndoPlaceholder.jsx** → Inline undo toast
- **src/components/LiveRegion.jsx** → ARIA live region for announcements
- **src/components/DemoCard.jsx** → Demo playlist card for new users
- **src/components/ScrollArea.jsx** → Virtualized scroll container with position persistence
- **src/components/TrackList.jsx** → Generic track list component
- **src/components/AccountView.jsx** → Account management screen (recovery codes, device info)
- **src/components/display/FontSettings.jsx** → Accessibility font selection UI

### Utilities
- **src/utils/storage.js** → localStorage persistence + versioning
- **src/utils/storageBootstrap.js** → SSR-safe state initialization helpers
- **src/utils/focusById.js** → Focus management helper
- **src/utils/notesTagsData.js** → Pure functions for notes/tags normalization, cloning, grouping
- **src/utils/trackProcessing.js** → Track enrichment and timestamp normalization
- **src/utils/podcastFlags.js** → Feature flag helpers for podcast imports
- **src/utils/debug.js** → Debug utilities (DEBUG_FOCUS flag)
- **src/lib/apiClient.js** → Fetch wrapper with device ID propagation
- **src/lib/deviceState.js** → Device context management
- **src/data/mockPlaylists.js** → Fallback mock data
- **src/data/demoPlaylist.js** → Demo playlist with pre-authored notes/tags (read-only mode)

### API Endpoints
- **api/anon/bootstrap.js** → Device bootstrap endpoint
- **api/anon/restore.js** → Recovery code restore endpoint
- **api/anon/recovery.js** → Recovery code rotation (CSRF-protected, rate limited)
- **api/db/notes.js** → Notes/tags sync endpoint
- **api/spotify/token.js** → Spotify token exchange

### API Library (`api/_lib/`)
- **api/_lib/supabase.js** → Supabase client helpers
- **api/_lib/argon.js** → Argon2 password hashing for recovery codes
- **api/_lib/recovery.js** → Recovery code generation, hashing, fingerprinting
- **api/spotify/originConfig.js** → CORS origin allowlist

---

## Configuration Files

- **vite.config.js** → Vitest config + Spotify proxy in dev server
- **eslint.config.js** → Flat config with React + Hooks + A11y plugins
- **vercel.json** → Security headers (CSP, HSTS, X-Frame-Options)
- **jsconfig.json** → Path aliases (`@/` → `src/`)
- **vitest.setup.js** → Test environment setup

---

## Testing Strategy

### Test Organization (68 test files)
```
src/__tests__/              → Integration tests (6 files)
src/features/**/__tests__/  → Feature-specific unit tests (40 files)
src/components/__tests__/   → Component tests (7 files)
src/utils/__tests__/        → Utility tests (5 files)
src/lib/__tests__/          → Library tests (2 files)
src/hooks/__tests__/        → Hook tests (2 files)
api/**/__tests__/           → API endpoint tests (6 files)
```

### Key Test Files
- **src/App.tagging.test.jsx** → End-to-end tagging integration test
- **src/features/import/__tests__/adapterContracts.test.js** → Validates all adapters follow contract
- **src/features/import/__tests__/usePlaylistImportFlow.test.js** → Import flow state machine
- **src/features/account/__tests__/useDeviceRecovery.test.js** → Device recovery hook behavior
- **src/features/undo/__tests__/useInlineUndo.test.js** → Undo timer behavior
- **src/features/playlist/__tests__/PlaylistProvider.test.jsx** → Provider context, remote sync, tag scheduler, error propagation
- **src/features/playlist/__tests__/usePlaylistContext.test.jsx** → Hook error guards and correct value returns

### Testing Utilities
- **src/test/testHelpers.js** → Shared test utilities
- **vitest.setup.js** → Global test setup (jsdom, testing-library)

---

## Common Development Patterns

### Adding a New Playlist Adapter

1. Create adapter in `src/features/import/adapters/newAdapter.js`
2. Follow the adapter contract in `src/features/import/adapters/types.js`
3. Return `createAdapterError(code, details)` for known errors
4. Add to `ADAPTER_REGISTRY` in `src/features/import/useImportPlaylist.js`
5. Update `detectProvider` in `src/features/import/detectProvider.js`
6. Add test coverage in `src/features/import/adapters/__tests__/adapterContracts.test.js`

### Adding a New Feature Module

1. Create directory in `src/features/featureName/`
2. Add main hook (e.g., `useFeatureName.js`)
3. Add UI components if needed
4. Create `__tests__/` subdirectory
5. Export from feature module (optional index.js)
6. Wire into `App.jsx` if requires global state

### Modifying localStorage Schema

1. Increment `STORAGE_VERSION` in `src/utils/storage.js`
2. Update `PersistedState` type definition
3. Add migration logic in `loadAppState` (handle previous version)
4. Test migration path with `getPendingMigrationSnapshot`
5. Update `CLAUDE.md` schema documentation

### Adding API Endpoints

1. Create serverless function in `api/categoryName/endpoint.js`
2. Use `apiUtils` from `api/_lib/` for common patterns
3. Propagate `x-device-id` header for device-aware endpoints
4. Add error handling with structured responses
5. Update `src/lib/apiClient.js` if new fetch pattern needed
6. Add tests in `api/categoryName/__tests__/`

---

## Documentation Files

### Root Documentation
- **README.md** → User-facing overview + accessibility checklist
- **SECURITY.md** → Security policies and vulnerability reporting
- **SECURITY_REFERENCE.md** → Detailed security implementation guide
- **GEMINI.md** → Instructions for Gemini AI
- **LAUNCH_PLAN.md** → Launch planning document
- **current_issues.md** → Known issues tracker

### Source Documentation
- **src/docs/ORIENTATION.md** → Import flow map (UI → code mapping)
- **src/AGENTS.MD** → AI agent guidelines for contributing

### Planning Documents (`docs/`)
The `docs/` directory contains 18+ planning documents for features and investigations:
- demo-playlist-plan.md
- podcast-import-plan.md
- recovery-sync-bug-analysis.md
- virtual-tracklist-phase1.md
- visual-hierarchy-improvements-plan.md
- And more...

---

## Environment Variables (Vercel)

Required for Spotify integration:
- `SPOTIFY_CLIENT_ID` → Spotify app client ID
- `SPOTIFY_CLIENT_SECRET` → Spotify app client secret

Required for Supabase (notes/tags sync):
- `SUPABASE_URL` → Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` → Service role key for API access
- `SUPABASE_ANON_KEY` → Public anon key for the browser client (also accepted as `VITE_SUPABASE_ANON_KEY`)
  - Server helpers also honor `SUPABASE_SERVICE_ROLE` / `SUPABASE_SERVICE_ROLE_KEY` and `VITE_SUPABASE_URL` fallbacks keep the Vercel envs in sync

No `.env` file in repo (secrets managed via Vercel dashboard).

---

## Common Gotchas

1. **Stale Request Race Conditions:** `usePlaylistImportFlow` uses request IDs to guard against race conditions between import/reimport/load-more. Always check if newer request has superseded the current one.

2. **Focus Management Timing:** Use `focusById()` (wraps `requestAnimationFrame`) instead of direct `element.focus()` to ensure DOM has settled after state updates.

3. **Undo Expiry Callbacks:** `useInlineUndo` expects `onExpire` to be stable (wrap with `useCallback`). Otherwise, timers may reference stale closures.

4. **Tag Normalization:** Tags are always lowercase, deduplicated, and capped at 32 per track. Sync queue batches changes with 350ms debounce.

5. **Device ID Propagation:** `x-device-id` header must be included in all API requests that touch notes/tags. Use `apiFetch` wrapper, not raw `fetch`.

6. **localStorage Versioning:** Always check `STORAGE_VERSION` before reading state. Auto-migration runs on load, but may fail if schema diverges too much.

7. **Adapter Contract:** All adapters must return `pageInfo: { cursor, hasMore }` even if they don't support pagination (use `null` cursor + `hasMore: false`).

8. **Announce Debouncing:** `useAnnounce` debounces by 60ms to prevent announcement spam. Rapid-fire calls will batch into single announcement.

---

## Related Documentation

For detailed import flow mapping (UI → code), see **src/docs/ORIENTATION.md**.












