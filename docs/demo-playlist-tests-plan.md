# Demo Playlist & Landing Flow Test Plan (Vitest)

**Date:** December 14, 2025 (Updated)
**Branch:** dev
**Scope:** Landing helper + demo CTA, demo playlist detail view, state flags, and analytics wiring

---

## Goal

Define a Vitest-focused test suite that exercises the demo playlist experience end-to-end from a **new user's perspective**, catching edge cases where:

- The landing helper appears or disappears incorrectly.
- Demo playlist data fails to load.
- The demo banner, controls, and flags (`hasImportedPlaylist`, `hasOpenedDemoPlaylist`) get out of sync.
- Read-only enforcement fails (users can mutate demo data).
- Demo playlists leak into recent playlists.

This plan assumes React components tested with **Vitest + React Testing Library** for UI behavior, plus pure-unit tests for reducer guards and helper functions.

**Implementation Notes:**
- Demo is identified by `importMeta.provider === 'demo'` (NOT a separate boolean flag)
- No routing/URL navigation - demo loads into same screen as regular playlists
- Read-only enforced at reducer level (not just UI)
- Demo never enters recent playlists (guarded in `createRecentCandidate`)

---

## Suite 1: Landing Helper (`No playlist link? Try our demo playlist`)

**File:** `src/features/landing/__tests__/LandingDemoHelper.test.tsx`

### 1.1 Helper appears for true new users

- **Setup**
  - Render `LandingScreen` with:
    - `hasImportedPlaylist = false`
    - `hasOpenedDemoPlaylist = false`
  - Use a test wrapper that provides any required context (router, theme, etc.).
- **Expect**
  - Text `No playlist link? Try our demo playlist` is in the document.
  - Positioned under the URL input area (can be a DOM relationship assertion, not strict pixel checks).

### 1.2 Helper hidden once user has imports

- **Setup**
  - `hasImportedPlaylist = true`.
- **Expect**
  - Helper text not rendered.
  - “Previously imported” section (or first playlist card) is visible.

### 1.3 Optional: Helper hidden after demo opened

- **Setup**
  - `hasImportedPlaylist = false`, `hasOpenedDemoPlaylist = true`.
- **Expect**
  - Helper is either not rendered, or replaced by a softer link (assert whichever behavior we implement).

### 1.4 Helper robustness with URL typing

- **Setup**
  - Render landing as new user.
  - Simulate typing into the playlist URL input, then clearing it.
- **Expect**
  - Helper’s visibility is driven by `hasImportedPlaylist` / `hasOpenedDemoPlaylist`, not transient input value:
    - No flickering on each keystroke.
    - Still visible when the input is emptied again.

---

## Suite 2: Demo Load & Exit Flow

**File:** `src/__tests__/App.demo.test.jsx`

Tests the `handleLoadDemo` and `handleExitDemo` functions in App.jsx.

### 2.1 Clicking helper loads demo playlist

- **Flow**
  - Render App with `showDemoHelper = true`.
  - Click the helper link text `No playlist link? Try our demo playlist`.
- **Expect**
  - Screen changes from 'landing' to 'playlist'.
  - `importMeta.provider === 'demo'`.
  - `playlistTitle === 'Notable Samples'`.
  - `tracks.length === 8`.
  - Demo tracks have pre-authored notes and tags.

### 2.2 URL input stays untouched

- **Flow**
  - Load demo from landing.
  - Click "Back" or call `handleExitDemo`.
- **Expect**
  - `lastImportUrl === ''` (no URL set).
  - Import input is empty on return to landing.

### 2.3 Double-click / spam click is safe

- **Flow**
  - Fire two quick `click` events on the helper link.
- **Expect**
  - Only one demo load occurs.
  - No runtime errors or unhandled promise rejections (use `vi.spyOn(console, 'error')`).

### 2.4 Exit demo clears state correctly

- **Flow**
  - Load demo, then call `handleExitDemo`.
- **Expect**
  - `importMeta.provider === null`.
  - `tracks.length === 0`.
  - `playlistTitle === 'My Playlist'`.
  - Screen returns to 'landing'.

---

## Suite 3: Demo Playlist Data & State

**File:** `src/data/__tests__/demoPlaylist.test.js`

Unit tests for demo data file and helper functions.

### 3.1 DEMO_PLAYLIST_DATA shape is valid

- **Setup**
  - Import `DEMO_PLAYLIST_DATA`.
- **Expect**
  - `meta.provider === 'demo'`.
  - `meta.playlistId === 'demo-notable-samples'`.
  - `tracks` is an array with 8 items.
  - All tracks have `id`, `title`, `artist`, `provider === 'demo'`.
  - `notesByTrack` contains entries for all track IDs.
  - `tagsByTrack` contains entries for all track IDs.

### 3.2 isDemoPlaylistId helper works

- **Flow**
  - Call `isDemoPlaylistId('demo-notable-samples')`.
  - Call `isDemoPlaylistId('some-other-id')`.
  - Call `isDemoPlaylistId(null)`.
- **Expect**
  - Returns `true`, `false`, `false` respectively.

### 3.3 Analytics helpers work

- **Flow**
  - Call `markDemoViewed()`, then `hasDemoBeenViewed()`.
- **Expect**
  - localStorage key `sta:demo-viewed` is set to `'true'`.
  - `hasDemoBeenViewed()` returns `true`.

---

## Suite 4: Demo Banner & Actions

**File:** `src/features/playlist/__tests__/PlaylistView.demo.test.jsx`

### 4.1 Demo banner replaces "Viewing saved copy"

- **Setup**
  - Render `PlaylistView` with `isDemoPlaylist = true`.
- **Expect**
  - Demo banner text is visible: `Classic samples with timestamp annotations...`
  - Badge text `Demo` is visible.
  - Standard cached-copy banner does NOT appear.

### 4.2 Import my own playlist button behavior

- **Flow**
  - Click `Import my own playlist` in the demo banner.
- **Expect**
  - `onExitDemo` callback is called.
  - (In integration test) Screen changes to 'landing' and import input is focused.

### 4.3 Reimport and Clear buttons hidden

- **Setup**
  - Render `PlaylistView` with `isDemoPlaylist = true`.
- **Expect**
  - "Re-import" button is not in the document.
  - "Clear" button is not in the document.
  - "Back" button still visible.

---

## Suite 5: Read-Only Enforcement

**File:** `src/features/playlist/__tests__/playlistReducer.demo.test.js`

Tests that reducer guards prevent mutations when `provider === 'demo'`.

### 5.1 NOTE_EDIT_START blocked for demo

- **Setup**
  - Create state with `provider: 'demo'`.
  - Dispatch `NOTE_EDIT_START` action.
- **Expect**
  - State unchanged.
  - Console warning: `Cannot edit demo playlist`.

### 5.2 NOTE_SAVE_OPTIMISTIC blocked for demo

- **Setup**
  - State with `provider: 'demo'`.
  - Dispatch `NOTE_SAVE_OPTIMISTIC`.
- **Expect**
  - State unchanged.
  - Console warning: `Cannot save notes to demo playlist`.

### 5.3 NOTE_DELETE blocked for demo

- **Setup**
  - State with `provider: 'demo'` and existing notes.
  - Dispatch `NOTE_DELETE`.
- **Expect**
  - Notes unchanged.
  - Console warning: `Cannot delete notes from demo playlist`.

### 5.4 TAG_ADD blocked for demo

- **Setup**
  - State with `provider: 'demo'`.
  - Dispatch `TAG_ADD`.
- **Expect**
  - Tags unchanged.
  - Console warning: `Cannot add tags to demo playlist`.

### 5.5 TAG_REMOVE blocked for demo

- **Setup**
  - State with `provider: 'demo'` and existing tags.
  - Dispatch `TAG_REMOVE`.
- **Expect**
  - Tags unchanged.
  - Console warning: `Cannot remove tags from demo playlist`.

### 5.6 NOTE_RESTORE blocked for demo

- **Setup**
  - State with `provider: 'demo'`.
  - Dispatch `NOTE_RESTORE`.
- **Expect**
  - State unchanged.
  - Console warning: `Cannot restore notes to demo playlist`.

---

## Suite 6: UI Read-Only Controls

**File:** `src/features/playlist/__tests__/TrackCard.demo.test.jsx`

### 6.1 Add note button hidden when readOnly

- **Setup**
  - Render `TrackCard` with `readOnly = true`.
- **Expect**
  - "Add note" button not in document.

### 6.2 Note delete buttons hidden when readOnly

- **Setup**
  - Render `TrackCard` with notes and `readOnly = true`.
- **Expect**
  - "Delete" buttons not in document for any note.

### 6.3 Tag add/remove controls hidden when readOnly

- **Setup**
  - Render `TrackCard` with tags and `readOnly = true`.
- **Expect**
  - "+ Add tag" button not in document.
  - Tag chips do not show removal (×) buttons.

---

## Suite 7: Recent Playlists Guard

**File:** `src/features/recent/__tests__/recentUtils.demo.test.js`

### 7.1 createRecentCandidate returns null for demo

- **Flow**
  - Call `createRecentCandidate({ provider: 'demo', playlistId: 'demo-notable-samples', sourceUrl: 'https://...' })`.
- **Expect**
  - Returns `null`.
  - Demo cannot be added to recents.

### 7.2 createRecentCandidate works for normal providers

- **Flow**
  - Call with `provider: 'spotify'`.
- **Expect**
  - Returns valid recent candidate object.

---

## Suite 8: Sync Queue Guard

**File:** `src/features/playlist/__tests__/PlaylistProvider.demo.test.jsx`

### 8.1 syncTrackTags skips demo playlists

- **Setup**
  - Create provider with state where `provider: 'demo'`.
  - Call `syncTrackTags(trackId, tags)`.
- **Expect**
  - Sync function returns resolved promise immediately.
  - No API call made (`apiFetch` not called).
  - No entry added to pending tag queue.

### 8.2 syncTrackTags works for normal playlists

- **Setup**
  - Create provider with state where `provider: 'spotify'`.
  - Call `syncTrackTags(trackId, tags)`.
- **Expect**
  - Sync is scheduled/executed normally.
  - API call eventually made.

---

## Suite 9: State Flags & Visibility

**File:** `src/__tests__/App.demoVisibility.test.jsx`

### 9.1 hasImportedPlaylist excludes demo

- **Setup**
  - Create recents list with one demo playlist: `[{ provider: 'demo', playlistId: 'demo-notable-samples' }]`.
- **Expect**
  - `hasImportedPlaylist === false`.
  - Demo helper is visible.

### 9.2 hasImportedPlaylist true after real import

- **Setup**
  - Recents: `[{ provider: 'spotify', playlistId: 'abc123' }]`.
- **Expect**
  - `hasImportedPlaylist === true`.
  - Demo helper not visible.

### 9.3 hasImportedPlaylist with mixed recents

- **Setup**
  - Recents: `[{ provider: 'demo', ... }, { provider: 'youtube', ... }]`.
- **Expect**
  - `hasImportedPlaylist === true` (has at least one non-demo).
  - Demo helper not visible.

---

## Suite 10: Analytics Hooks (OPTIONAL - Not Yet Implemented)

**File:** `src/lib/__tests__/analytics.demo.test.js`

*Note: Analytics implementation is optional for MVP. This suite documents the expected behavior if/when implemented.*

### 10.1 markDemoViewed sets localStorage flag

- **Flow**
  - Call `markDemoViewed()`.
- **Expect**
  - localStorage key `sta:demo-viewed` is `'true'`.

### 10.2 hasDemoBeenViewed reads flag correctly

- **Flow**
  - Set localStorage, then call `hasDemoBeenViewed()`.
- **Expect**
  - Returns `true` when flag set, `false` otherwise.

### 10.3 Future analytics events (when implemented)

If a `track(event, data)` function is added:

- `demo_helper_shown` - When landing renders with helper visible
- `demo_helper_clicked` - When helper link clicked
- `demo_playlist_shown` - When playlist screen loads with `provider === 'demo'`
- `demo_import_clicked` - When "Import my own playlist" clicked
- `import_after_demo` - Flag on first real import after demo viewed

---

## Suite 11: Accessibility & Keyboard Flows

**File:** `src/features/landing/__tests__/LandingDemoAccessibility.test.jsx`

### 11.1 Keyboard focus order

- **Flow**
  - Use RTL `userEvent.tab()` through the landing page.
- **Expect**
  - Focus moves: URL input → demo helper link → import button (or equivalent order).
  - Helper link is reachable and visibly focused.

### 11.2 Demo banner screen reader semantics

- **Flow**
  - Render demo playlist, inspect demo banner.
- **Expect**
  - Banner has `role="status"` or similar.
  - "Import my own playlist" button has clear accessible name.
  - Demo badge is announced or aria-labeled.

---

## Implementation Priority

**Critical (Must Test Before Shipping):**
1. Suite 5: Read-Only Enforcement (reducer guards)
2. Suite 7: Recent Playlists Guard
3. Suite 8: Sync Queue Guard
4. Suite 2: Demo Load & Exit Flow

**High Priority (Recommended):**
5. Suite 4: Demo Banner & Actions
6. Suite 6: UI Read-Only Controls
7. Suite 9: State Flags & Visibility

**Medium Priority:**
8. Suite 1: Landing Helper visibility
9. Suite 3: Demo Playlist Data shape

**Low Priority (Nice to Have):**
10. Suite 11: Accessibility
11. Suite 10: Analytics (when implemented)

---

## Implementation Notes

- Use existing test utilities: `renderWithProviders`, `mockPlaylistState`, etc.
- Centralize demo data imports in test setup to keep tests DRY
- Mock `apiFetch` for sync tests to verify no network calls for demo
- Use `vi.spyOn(console, 'warn')` to assert reducer guard warnings
- Prefer `userEvent` over `fireEvent` for realistic interaction testing

