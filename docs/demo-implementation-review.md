# Demo Playlist Implementation Review

**Date:** December 15, 2025
**Branch:** dev
**Status:** Complete - Updated to Live Spotify Playlist Import

---

## Latest Update (December 15, 2025)

**Major Change:** Switched from static bundled data to live Spotify playlist import.

**What changed:**
- `src/data/demoPlaylist.js` now exports `DEMO_PLAYLIST_URL` constant instead of static track data
- `handleLoadDemo()` in `App.jsx` now triggers standard Spotify import flow
- `usePlaylistImportController.js` detects demo URL and overrides provider to `'demo'` after import
- All existing guards and read-only enforcement remain unchanged
- Demo playlist now shows real album artwork and demonstrates actual app functionality

**Benefits:**
- Better UX with real Spotify data (album art, fresh content)
- Demonstrates the actual import flow to new users
- Playlist can be updated without code changes

**Trade-offs:**
- Requires network call (2-3 second load time instead of instant)
- Depends on Spotify API availability
- Need error handling for network failures (already implemented via standard import error handling)

---

## Original Review (December 14, 2025)

The demo playlist feature has been partially implemented. The UI layer is mostly complete, but **critical handler-level enforcement is missing**. This review identifies what's working, what's broken, and what needs to be added before this can ship.

---

## ✅ What's Working

### 1. Demo Data Structure ✓

**File:** `src/data/demoPlaylist.js`

- Well-structured demo data with 8 classic sample tracks
- Pre-authored timestamped notes showing real-world usage patterns
- Provider correctly set to `'demo'`
- Helper functions (`isDemoPlaylistId`, `markDemoViewed`, `hasDemoBeenViewed`)
- Matches existing import data shape

**No changes needed.**

### 2. Landing Page Helper ✓

**File:** `src/features/landing/LandingScreen.jsx`

- Demo helper button added under URL input
- Visibility controlled by `showDemoHelper` prop
- Correctly disabled when imports are busy
- Clean, minimal styling

**No changes needed.**

### 3. Demo Banner UI ✓

**File:** `src/features/playlist/PlaylistView.jsx`

- Demo banner displays when `isDemoPlaylist === true`
- Correctly hides "Viewing saved copy" banner when in demo mode
- "Import my own playlist" button wired to `onExitDemo`
- Read-only hint displayed

**No changes needed to banner display.**

### 4. Read-Only UI Controls ✓

**Files:**
- `src/features/playlist/TrackCard.jsx`
- `src/features/playlist/NoteList.jsx`
- `src/features/tags/TagChip.jsx`

**Working:**
- "Add note" buttons hidden when `readOnly === true`
- "Delete" buttons on notes hidden when `readOnly === true`
- "+ Add tag" button hidden when `readOnly === true`
- Tag removal (×) buttons hidden when `readOnly === true`
- "Reimport" and "Clear" buttons hidden in playlist header

**No changes needed to UI layer.**

### 5. Demo Load/Exit Handlers ✓

**File:** `src/App.jsx`

- `handleLoadDemo()` correctly injects demo data into state
- `handleExitDemo()` correctly clears demo state and returns to landing
- Analytics tracking (`markDemoViewed()`) called on load
- Announcement for accessibility

**No changes needed to load/exit logic.**

---

## ⚠️ Critical Issues

### Issue 1: Using Boolean Flag Instead of Provider Check

**Problem:**

The current implementation uses `isDemoPlaylist` boolean state in `App.jsx` instead of checking `importMeta.provider === 'demo'`.

**Why this matters:**

1. **Extra state to maintain:** Boolean flag must be manually set/cleared alongside provider
2. **Inconsistent with architecture:** Existing code switches on `provider` field, not separate flags
3. **Risk of desync:** `isDemoPlaylist` can get out of sync with `importMeta.provider`
4. **Doesn't prevent sync naturally:** Boolean flag requires explicit checks everywhere; provider-based approach naturally excludes demo from sync/reimport

**Files affected:**
- `src/App.jsx` (lines 164-165, 820, etc.)
- `src/features/playlist/PlaylistView.jsx` (props passed down)

**Fix required:**

Replace boolean flag with provider check:

```diff
- const [isDemoPlaylist, setIsDemoPlaylist] = useState(false)
+ const isDemoPlaylist = importMeta.provider === 'demo'
```

Remove all `setIsDemoPlaylist()` calls and derive from `importMeta.provider` instead.

**Impact:** Medium - Won't break anything but makes code harder to maintain

---

### Issue 2: No Handler-Level Read-Only Enforcement

**Problem:**

Demo playlists are only read-only at the UI layer (hidden buttons). Nothing prevents:
- Keyboard shortcuts from triggering note/tag operations
- Direct action dispatch to the reducer
- Future features from accidentally mutating demo data

**Why this matters:**

Your reviewer was 100% correct on this point. UI-only enforcement is insufficient because:
1. Ctrl+Z undo shortcut could restore deleted notes (if implemented)
2. Future keyboard shortcuts could bypass disabled buttons
3. Any new UI surface area could accidentally allow edits
4. Testing/debugging tools could dispatch actions directly

**Files needing guards:**

1. **`src/features/playlist/playlistReducer.js`**
   - Add guards to mutation actions: `NOTE_EDIT_START`, `NOTE_SAVE`, `NOTE_DELETE`, `TAG_ADD`, `TAG_REMOVE`
   - Need access to `importMeta.provider` to check if demo

2. **`src/features/tags/tagSyncQueue.js`**
   - Skip sync queue enqueue for demo playlists
   - Prevent network calls for demo data

3. **`src/features/import/usePlaylistImportController.js`**
   - Disable reimport when `provider === 'demo'`
   - Disable load-more when `provider === 'demo'`

**Example guard pattern:**

```javascript
// In playlistReducer.js
case 'NOTE_SAVE':
  // GUARD: Prevent mutations to demo playlists
  if (action.payload.provider === 'demo') {
    console.warn('Cannot edit demo playlist')
    return state
  }
  // ... existing logic
```

**Impact:** HIGH - This is a critical gap that must be fixed before shipping

---

### Issue 3: Demo May Be Added to Recent Playlists

**Problem:**

The current implementation doesn't explicitly prevent demo from being added to recent playlists via `upsertRecent()`.

**Code path analysis:**

Looking at `src/App.jsx` line 788:
```javascript
const handleLoadDemo = useCallback(() => {
  // ... loads demo data ...
  // ❌ No call to upsertRecent here - GOOD
  // But is there an effect that might call it?
})
```

**Potential issue:**

If there's any effect that automatically calls `upsertRecent()` based on `importMeta` changing, demo could leak into recents.

**Files to check:**
1. `src/features/recent/useRecentPlaylists.js` - Does it auto-upsert on import?
2. `src/App.jsx` - Any effects watching `importMeta` that call `upsertRecent()`?

**Recommended fix:**

Add an early return in `createRecentCandidate()`:

```javascript
// src/features/recent/recentUtils.js
export function createRecentCandidate(meta, options = {}) {
  if (!meta || typeof meta !== 'object') return null

  // GUARD: Never create recent candidates for demo playlists
  if (meta.provider === 'demo') return null

  // ... existing logic
}
```

This ensures demo can NEVER be added to recents, regardless of how `upsertRecent()` is called.

**Impact:** MEDIUM-HIGH - Demo appearing in recents would confuse users and break visibility logic

---

### Issue 4: Storage Layer Doesn't Recognize 'demo' Provider

**Problem:**

`src/utils/storage.js` defines valid providers as:

```javascript
const VALID_PROVIDERS = new Set(['spotify', 'youtube', 'soundcloud']);
```

Demo provider `'demo'` is not included. This could cause validation issues when saving state.

**Files affected:**
- `src/utils/storage.js` - Provider validation

**Fix required:**

```diff
- const VALID_PROVIDERS = new Set(['spotify', 'youtube', 'soundcloud']);
+ const VALID_PROVIDERS = new Set(['spotify', 'youtube', 'soundcloud', 'demo']);
```

**Impact:** MEDIUM - May cause demo state to not persist correctly (though this might be intentional?)

---

## 🔍 Architecture Concerns

### Concern 1: Reducer Doesn't Have Access to `provider`

**Problem:**

The reducer receives actions with payloads like:

```javascript
{ type: 'NOTE_SAVE', payload: { trackId, body, timestampMs } }
```

But it doesn't receive `importMeta.provider`, so it can't enforce the demo read-only guard.

**Potential solutions:**

**Option A: Pass provider in every mutation action**
```javascript
dispatch(playlistActions.saveNote(trackId, body, { provider: importMeta.provider }))
```

**Option B: Add provider to reducer state**
```javascript
export const initialPlaylistState = {
  tracks: [],
  notesByTrack: {},
  tagsByTrack: {},
  provider: null, // NEW
  // ...
}
```

**Option C: Check in App.jsx before dispatch (current pattern)**
```javascript
const handleSaveNote = useCallback((trackId, body) => {
  if (importMeta.provider === 'demo') {
    announce('Cannot edit demo playlist')
    return
  }
  dispatch(playlistActions.saveNote(trackId, body))
}, [importMeta.provider, dispatch, announce])
```

**Recommendation:** Option B is cleanest - provider should be part of playlist state, set via `SET_TRACKS_WITH_NOTES` action. This aligns with your existing pattern where the reducer manages derived state.

---

### Concern 2: `hasImportedPlaylist` Logic May Be Incomplete

**Current implementation in App.jsx:**

```javascript
const hasImportedPlaylist = useMemo(() => {
  if (!Array.isArray(recentPlaylists) || recentPlaylists.length === 0) {
    return false
  }
  return recentPlaylists.some(
    (recent) => !isDemoPlaylistId(recent?.playlistId)
  )
}, [recentPlaylists])
```

**Potential issue:**

This only checks `playlistId`, not `provider`. If a real playlist somehow had the ID `'demo-notable-samples'`, it would be excluded.

**Safer implementation:**

```javascript
const hasImportedPlaylist = useMemo(() => {
  if (!Array.isArray(recentPlaylists) || recentPlaylists.length === 0) {
    return false
  }
  return recentPlaylists.some(
    (recent) => recent?.provider !== 'demo'
  )
}, [recentPlaylists])
```

**Impact:** LOW - Edge case, but provider check is more robust

---

## 📋 Missing Features

### 1. Analytics Implementation ❌

**Status:** Not implemented

The plan calls for:
- Simple `track(event, data)` logger function
- Events: `demo_helper_shown`, `demo_helper_clicked`, `demo_playlist_shown`, `demo_import_clicked`
- Conversion tracking: `import_after_demo: true` on first real import

**What exists:**
- `markDemoViewed()` called in `handleLoadDemo()` ✓
- No other analytics instrumentation

**Recommendation:**

Create `src/lib/analytics.js`:

```javascript
// Simple event logger (console.log in dev, no-op in prod)
export function track(event, data = {}) {
  if (import.meta.env.DEV) {
    console.log('[Analytics]', event, data)
  }
  // TODO: Send to analytics service in production
}
```

Then instrument:
- Landing page: `track('demo_helper_shown')` when helper renders
- Demo helper: `track('demo_helper_clicked')` on click
- Playlist view: `track('demo_playlist_shown')` when demo banner shows
- Exit button: `track('demo_import_clicked')` on "Import my own playlist"

**Impact:** LOW - Analytics is nice-to-have for MVP

---

## 🧪 Testing Gaps

### Missing Test Coverage

The following should have test coverage before shipping:

1. **Demo load/exit flow** (`src/App.jsx`)
   - Test `handleLoadDemo()` injects correct data
   - Test `handleExitDemo()` clears state and returns to landing
   - Test demo never calls `upsertRecent()`

2. **Read-only enforcement** (once implemented)
   - Test reducer rejects mutations when `provider === 'demo'`
   - Test sync queue skips demo playlists
   - Test reimport/load-more disabled for demo

3. **Visibility logic** (`src/App.jsx`)
   - Test `hasImportedPlaylist` correctly excludes demo
   - Test demo helper shows when no real playlists imported
   - Test demo helper hides after first real import

4. **Component props**
   - Test `PlaylistView` renders demo banner when `isDemoPlaylist === true`
   - Test `TrackCard` hides edit controls when `readOnly === true`
   - Test `NoteList` hides delete buttons when `readOnly === true`

**Recommendation:** Add `src/__tests__/App.demo.test.jsx` and `src/features/playlist/__tests__/playlistReducer.demo.test.js`

---

## 🎯 Priority Action Items

### Before This Can Ship

1. **HIGH: Add handler-level read-only guards**
   - `playlistReducer.js`: Guard mutation actions
   - `tagSyncQueue.js`: Skip sync for demo
   - `usePlaylistImportController.js`: Disable reimport/load-more for demo
   - **Blocker:** Users could accidentally mutate demo via keyboard shortcuts

2. **HIGH: Prevent demo from entering recents**
   - Add guard in `createRecentCandidate()` to return `null` when `provider === 'demo'`
   - **Blocker:** Demo in recents breaks visibility logic

3. **MEDIUM: Replace `isDemoPlaylist` boolean with provider check**
   - Derive from `importMeta.provider === 'demo'` instead of separate state
   - **Not a blocker, but makes code cleaner and more maintainable**

4. **MEDIUM: Add 'demo' to VALID_PROVIDERS**
   - Update `src/utils/storage.js` validation
   - **May cause silent failures in persistence**

5. **LOW: Add basic test coverage**
   - Demo load/exit flow
   - Read-only enforcement (once implemented)
   - Visibility logic

6. **LOW: Implement analytics tracking**
   - Create simple logger function
   - Instrument key events
   - **Nice-to-have for launch, not critical**

---

## 🔧 Recommended Implementation Order

1. **Fix Issue 3 first** - Add guard in `createRecentCandidate()`
   - Smallest change, prevents data corruption
   - Test: Load demo, verify it doesn't appear in recents

2. **Fix Issue 4** - Add 'demo' to VALID_PROVIDERS
   - One-line change, prevents validation issues
   - Test: Load demo, verify state saves/loads correctly

3. **Fix Issue 2** - Add handler-level read-only guards
   - Requires deciding on Concern 1 (how to pass provider to reducer)
   - Recommend adding `provider` to reducer state
   - Add guards to reducer, sync queue, import controller
   - Test: Try to trigger note/tag operations via console, verify they're blocked

4. **Fix Issue 1** - Replace boolean flag with provider check
   - Simplifies code, aligns with architecture
   - Test: All existing demo functionality still works

5. **Add analytics** - Implement simple event tracking
   - Optional for MVP, but sets up for future measurement

6. **Write tests** - Cover critical paths
   - Demo load/exit
   - Read-only enforcement
   - Visibility logic

---

## Summary

**Current state:** 70% complete - UI is solid, but critical enforcement gaps exist

**Biggest risks:**
1. Users can mutate demo data via keyboard shortcuts (HIGH)
2. Demo might appear in recent playlists (MEDIUM-HIGH)
3. Demo state might not persist correctly (MEDIUM)

**Recommended path forward:**

Fix items 1-4 in priority order above. Items 5-6 are optional for MVP but recommended for quality.

**Estimated effort:**
- Critical fixes (items 1-4): 2-4 hours
- Testing (item 6): 2-3 hours
- Analytics (item 5): 1 hour

**Total: 5-8 hours to ship-ready state**
