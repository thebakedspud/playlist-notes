# GEMINI.md

This file provides context and guidance for Gemini when working on the **Playlist Notes** repository.

---

## 1. Project Overview

**Playlist Notes** is an accessibility-first React + Vite application for annotating playlists. It allows users to import public playlists from various sources (Spotify, YouTube, SoundCloud), add notes and tags to tracks, and sync these annotations across devices using anonymous device IDs and recovery codes.

**Core Tech Stack:**
*   **Frontend:** React 19, Vite, vanilla CSS (variables/modules).
*   **State:** React Context + useReducer (centralized playlist state).
*   **Type Safety:** JSDoc + TypeScript Compiler (`checkJs: true`).
*   **Backend:** Vercel Serverless Functions (Node.js).
*   **Database:** Supabase (for syncing notes/tags).
*   **Testing:** Vitest, React Testing Library.

---

## 2. Architecture & Patterns

### Feature-Sliced Design
The codebase is organized by domain in `src/features/` rather than by file type.
*   `src/features/playlist/`: Core playlist UI and state.
*   `src/features/import/`: Import logic, adapters, and flow control.
*   `src/features/undo/`: Inline undo system.
*   `src/features/a11y/`: Accessibility hooks and components.

### State Management
*   **Playlist State:** Centralized in `PlaylistStateProvider` (`src/features/playlist/PlaylistProvider.jsx`). Uses a pure reducer for predictable state transitions.
*   **Persistence:** Uses `localStorage` with a versioned schema (currently `v6`).
    *   **Key:** `sta:v6`
    *   **Migration:** Automatic migration from older versions on load.
*   **Optimistic Updates:** UI updates immediately; errors trigger rollbacks and announcements.

### Import System (Adapter Pattern)
*   **Registry:** `src/features/import/useImportPlaylist.js` contains the `ADAPTER_REGISTRY`.
*   **Contract:** Adapters (`spotifyAdapter`, `youtubeAdapter`, etc.) return a standardized `PlaylistAdapterResult`.
*   **Normalization:** All tracks are normalized to a common shape ({ id, title, artist, ... }) before storage.

### API & Sync
*   **Serverless Functions:** Located in `api/`.
*   **Device Identity:** All requests propagate an `x-device-id` header to handle anonymous user mapping.
*   **Endpoints:**
    *   `/api/anon/*`: Device bootstrapping and recovery.
    *   `/api/db/*`: Note and tag synchronization.
    *   `/api/spotify/*`: Proxy for Spotify token exchange.

### Accessibility (A11y)
*   **Announcements:** Uses `useAnnounce` hook to speak updates via a hidden `aria-live` region.
*   **Focus Management:** `focusById` utility ensures focus is managed after async operations (imports, deletions).
*   **Keyboard Support:** Full keyboard navigation support is a strict requirement.

---

## 3. Development Workflow

### Key Commands
*   **Start Dev Server:** `npm run dev`
*   **Run Tests:** `npm test` (Runs Vitest)
    *   *Agent Note:* Prefer `npm run test:ci` or `cross-env CI=1 vitest run --maxWorkers=50%` for stability.
*   **Type Check:** `npm run check:tsc` (Validates JSDoc types)
*   **Lint:** `npm run lint`

### Testing Strategy
*   **Unit Tests:** Co-located with features (e.g., `src/features/undo/__tests__/`).
*   **Integration:** `src/__tests__/` (e.g., `App.tagging.test.jsx`).
*   **API Tests:** `api/**/__tests__/`.
*   **Coverage:** Reasonable thresholds enforce quality (Functions: 70%, Lines: 60%).

### Type Checking
This project uses **JSDoc** for typing, checked by TypeScript.
*   **Do not** create `.ts` or `.tsx` files for application code.
*   **Do** use `/** @type {import('...').Type} */` annotations.
*   **Do** run `npm run check:tsc` to verify types.

---

## 4. Agent Guidelines

### Operational Rules
1.  **Timeouts:** The project strictly advises wrapping long-running commands with timeouts (see `src/AGENTS.MD`).
    *   *Windows Note:* Since `timeout` is not native to Windows cmd/powershell, use standard commands if strictly on Windows, but be aware of potential hangs.
2.  **Stability:** Use `CI=1` and `--maxWorkers=50%` for Vitest to avoid flakiness and resource exhaustion.
3.  **Fail Fast:** If a command hangs or fails, analyze the output immediately. Do not retry deterministic failures without changes.

### Code Modification
1.  **Respect the Architecture:** Place new logic in the appropriate `src/features/` directory.
2.  **Preserve A11y:** Ensure new interactive elements have accessible names, keyboard support, and state announcements.
3.  **Update Tests:** If modifying logic, update or add corresponding tests in the `__tests__` subdirectory.

### File Locations of Interest
*   `src/App.jsx`: Main routing and initialization.
*   `src/features/import/adapters/`: Where import logic lives.
*   `src/utils/storage.js`: Persistence logic.
*   `CLAUDE.md`: Additional detailed architectural notes (excellent reference).
