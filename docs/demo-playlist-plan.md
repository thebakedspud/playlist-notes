# Demo Playlist Onboarding Plan

**Date:** December 11, 2025  
**Branch:** dev  
**Scope:** Landing page import area & playlist detail header

---

## Goal

Help new users understand timestamped notes by offering a concrete, working example playlist, without overwhelming them with explanation or extra UI. The demo should:

- Live exactly where new users get stuck (no playlist URL yet).
- Reuse the existing playlist detail screen so it feels “real,” not like a tour.
- Be clearly labeled as a demo, with a path back to importing their own playlists.
- Generate analytics so we can measure whether it improves activation.

---

## User Stories

- **New user without a link**
  - When I land on the app and don’t have a playlist URL ready, I want an obvious way to see the tool in action so I can decide if it’s worth importing my own music.
- **Curious user in the demo**
  - When I open the demo playlist, I want a short explanation of what I’m seeing and how to move on to my own playlists.
- **Returning user who already imported something**
  - Once I know how the app works, I don’t want the demo CTA to keep shouting at me, but it’s fine if there’s a subtle way to get back to it.

---

## Placement & Visibility Rules

### Landing Page Helper (Primary Entry Point)

**Location**
- Under the playlist URL input, aligned with or near the existing `spotify` pill.

**Content**
- Visual: a small arrow or caret pointing downward toward the URL input area.
- Text: `No playlist link? Try our demo playlist` (clickable).

**Behavior**
- Click → load demo playlist data directly into state:
  - No routing or URL changes needed — demo data is injected via state.
  - Demo is identified by `importMeta.provider === 'demo'` (not a boolean flag).
- The URL input is not auto-filled with the demo link; the demo is a separate, safe path.

**Visibility Conditions**
- Show the helper when the user has **no imported playlists** (`hasImportedPlaylist === false`).
- After the user imports their first playlist, hide the helper entirely.

### Previously Imported Section

- For brand-new users (`hasImportedPlaylist === false`), the “Previously imported” list will either be empty or absent.
- The demo helper is the primary affordance in that area until at least one import exists.

---

## Demo Playlist Wiring

### IDs and Constants

- `DEMO_PLAYLIST_ID = 'demo-notable-samples'`

This lives in a shared config module (e.g. `src/config/demoPlaylist.js`) alongside the bundled demo data.

### Data Source

**Live Spotify Playlist** — The demo playlist imports a curated public Spotify playlist using the standard import flow.

**URL:** `https://open.spotify.com/playlist/3sX5G9KAfZG0DRQnCfIxd8`

**Implementation:**
- `src/data/demoPlaylist.js` exports `DEMO_PLAYLIST_URL` constant
- When user clicks demo helper, `handleLoadDemo()` triggers standard Spotify import flow
- Import controller detects demo URL via `isDemoPlaylistUrl()` helper
- After import completes, provider is automatically overridden to `'demo'`
- Playlist ID is overridden to `DEMO_PLAYLIST_ID` (`'demo-notable-samples'`)

**Benefits:**
- Real album artwork from Spotify
- Demonstrates actual app functionality (import flow)
- Fresh content (playlist can be updated without code changes)
- User sees actual loading states and network behavior

**Trade-offs:**
- Requires network call (2-3 second load time vs instant)
- Depends on Spotify API availability
- Requires error handling for network failures

**Pre-authored annotations:**
- `DEMO_NOTES_BY_TRACK` — Will be merged with imported tracks after load (future enhancement)
- `DEMO_TAGS_BY_TRACK` — Will be merged with imported tracks after load (future enhancement)

**Requirements:**

- The playlist detail UI receives data in the same shape as a normal playlist.
- The only behavioral differences are driven by checking `importMeta.provider === 'demo'`.
- Demo override happens at import controller level, not in adapter.

---

## Playlist Detail UI: Demo State

### Banner Replacement ("Viewing saved copy" Slot)

**Condition**
- When `importMeta.provider === 'demo'`:
  - Do **not** show the standard "Viewing saved copy (…tracks…)" banner.
  - Show a dedicated **Demo Banner** in the same container.

**Banner Content**

- Headline: `Demo: Notable Samples`
- Body: `Classic samples with timestamp annotations. Listen on Spotify, then import your playlist to try it yourself.`

**Actions**

- Primary button: `Import my own playlist`
  - Behavior: navigate/scroll back to the landing import form (same tab).
- The existing home keybinding also returns to landing, so no dedicated "Exit demo" button is needed.

**Visual Treatment**

- Reuse the same component/container style used by the “Viewing saved copy” banner.
- Add a small pill or text label at the left: `Demo`.

### Editing & Controls

Use `importMeta.provider === 'demo'` to adjust:

- **Read-only mode:** Enforce at both UI and handler level. Show a small hint: "Demo playlist is read-only."
- **Hidden actions:** Hide "Reimport from Spotify" and other operations that don't apply to static demo data.

### Read-Only Enforcement

Demo playlists cannot be edited. Enforcement happens at multiple layers:

**UI Layer** (hide controls):
- Hide "Add note" buttons on track cards
- Hide "Delete" buttons on existing notes
- Hide "+ Add tag" button and tag removal (×) buttons
- Hide "Reimport" and "Clear" buttons in playlist header

**Handler Layer** (prevent operations):
- `playlistReducer.js`: Guard against `UPDATE_NOTE`, `ADD_TAG`, `REMOVE_TAG` actions when `provider === 'demo'`
- `tagSyncQueue.js`: Skip enqueueing sync operations for demo playlists
- `usePlaylistImportController.js`: Disable reimport and load-more operations for demo

**Rationale:**
- UI-only disabling can be bypassed via keyboard shortcuts or future features
- Handler-level guards ensure data integrity regardless of how the action is triggered

---

## State & Persistence

### User-Level Flags

- `hasImportedPlaylist: boolean`
  - Derived from whether any non-demo playlists exist in recents.
  - Implementation: `recentPlaylists.some(r => r.provider !== 'demo')`
  - Used to gate demo helper visibility on landing page.
  - Demo playlist **never** calls `upsertRecent()` — early return in storage.js if `provider === 'demo'`
- `hasOpenedDemoPlaylist: boolean` *(analytics only)*
  - Set to `true` when the demo playlist loads successfully.
  - Stored in localStorage (`sta:demo-viewed`).
  - Not used for gating UI — purely for conversion tracking.

### Provider-Based Identification

- Demo playlists are identified by `importMeta.provider === 'demo'`
- This approach aligns with existing architecture (provider-based switching in adapters, sync, etc.)
- No separate boolean flag needed — provider field is sufficient
- Benefits:
  - Naturally excludes demo from sync operations
  - Works with existing adapter registry patterns
  - Prevents demo from appearing in "reimport" flows
  - Simpler to maintain than threading a new boolean through all components

---

## Copy Inventory

This section collects the core strings so they can be localized or tweaked later.

### Landing Page

- Helper CTA under input:
  - `No playlist link? Try our demo playlist`
- Optional helper subtext:
  - `See timestamped notes in action before importing your own music.`

### Playlist Detail Demo Banner

- Headline: `Demo: Notable Samples`
- Body: `Classic samples with timestamp annotations. Listen on Spotify, then import your playlist to try it yourself.`
- Primary button: `Import my own playlist`
- Read-only hint: `Demo playlist is read-only`

---

## Analytics Plan

### Implementation Approach

Simple internal event logger: `track(event, data)` function.
- Console.log in development
- No-op in production (or send to simple endpoint later)
- Focus on event shape and placement, not backend implementation
- Can be upgraded to real analytics service without changing call sites

### Events

- `demo_helper_shown`
  - When the landing page renders the demo helper.
- `demo_helper_clicked`
  - When the helper link is clicked.
- `demo_playlist_shown`
  - When the playlist detail screen loads with `importMeta.provider === 'demo'`.
- `demo_import_clicked`
  - When the "Import my own playlist" button is clicked.

### Conversion Tracking

- On the first **real** playlist import after a demo view, attach a flag to the existing import event:
  - e.g. `origin: 'demo'` or `import_after_demo: true`.
- Later analysis:
  - Compare import and retention rates between:
    - Users who saw the helper but did not click.
    - Users who opened the demo.
    - Users who went straight to importing their own playlist.

---

## Implementation Checklist (High Level)

1. **Demo Data File** ✓
   - Create `src/data/demoPlaylist.js` with demo playlist URL constant.
   - Export `DEMO_PLAYLIST_URL`, `DEMO_PLAYLIST_ID`, and helper functions.
   - Pre-authored notes/tags exported for future enhancement.

2. **Demo Load Handler** ✓
   - When user clicks demo helper, trigger standard Spotify import flow with demo URL.
   - Import controller detects demo URL and overrides provider to `'demo'` after import.
   - Network call required (standard Spotify import flow).

3. **Landing Page UI** ✓
   - Add demo helper under the URL input (see Visibility Conditions above).
   - Show only when `hasImportedPlaylist === false`.

4. **Playlist Detail UI** ✓
   - When `importMeta.provider === 'demo'`:
     - Show Demo Banner (headline + supporting line + primary button).
     - Enable read-only mode for notes/tags at UI layer.
     - Hide reimport and other inapplicable actions.

5. **Read-Only Enforcement** ⚠️ PARTIAL
   - UI layer: ✓ Buttons hidden, controls disabled
   - Handler layer: ⚠️ NEEDS IMPLEMENTATION
     - Add guards to `playlistReducer.js` for mutation actions
     - Skip sync queue in `tagSyncQueue.js` for demo playlists
     - Prevent reimport/load-more in import controller

6. **State & Persistence** ⚠️ NEEDS REVIEW
   - Derive `hasImportedPlaylist` from recents list (excluding demo): ✓
   - Store `hasOpenedDemoPlaylist` in localStorage for analytics: ✓
   - **CRITICAL:** Ensure demo never calls `upsertRecent()` in storage.js

7. **Analytics** ❌ NOT IMPLEMENTED
   - Create simple `track(event, data)` logger function
   - Instrument events listed in Analytics Plan above.
   - Attach `import_after_demo: true` to first real import if demo was viewed.

