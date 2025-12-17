# PR #51 Post-Merge Improvements Plan

## Context

PR #51 successfully fixes the critical note synchronization bug. This plan addresses follow-up improvements identified during code review that will enhance robustness, maintainability, and test coverage.

## Scope

**NOT included in this plan:**
- Migration strategy (no current users, breaking changes acceptable)
- Tag storage concerns (investigation confirmed no issue - tags properly union merge)

**Included in this plan:**
1. Improve DELETE endpoint error handling and logging
2. Add edge case test coverage
3. Refactor API endpoint for clarity (split into separate routes)
4. Centralize tag normalization logic

## Phase 1: Improve DELETE Endpoint Error Handling

### Goal
Add better logging and test coverage for the deletion queue's handling of 401/403 responses.

### Changes Required

**File:** `src/features/notes/noteDeleteQueue.js`

**Current behavior (lines 116-117):**
```javascript
if (response.ok || response.status === 404 || response.status === 401 || response.status === 403) {
  processed++
}
```

**Issues:**
- Treating 401/403 as "success" could mask authorization issues
- No visibility when deletions fail due to permission issues
- Could confuse debugging if a user loses access after queueing deletion

**Proposed changes:**
1. Add warning logs for 401/403 responses
2. Return separate counters for `{ deleted, unauthorized, alreadyGone }`
3. Add unit tests for all response codes

**Implementation:**
```javascript
// Line 116-123: Enhanced error handling
const result = { deleted: 0, unauthorized: 0, alreadyGone: 0, failed: 0 }

for (const item of queue) {
  try {
    const response = await apiFetch(`/api/db/notes?noteId=${encodeURIComponent(item.noteId)}`, {
      method: 'DELETE',
    })

    if (response.ok) {
      result.deleted++
    } else if (response.status === 404) {
      result.alreadyGone++
    } else if (response.status === 401 || response.status === 403) {
      console.warn(`[noteDeleteQueue] unauthorized deletion for note ${item.noteId}`)
      result.unauthorized++
      // Still remove from queue - user doesn't own this note anymore
    } else if (response.status >= 500) {
      remaining.push(item)
      result.failed++
    } else {
      // 4xx errors other than 401/403/404 - don't retry
      console.warn(`[noteDeleteQueue] permanent failure ${response.status} for note ${item.noteId}`)
      result.deleted++ // Remove from queue
    }
  } catch (_err) {
    // Network error - keep for retry
    remaining.push(item)
    result.failed++
  }
}

saveQueue(remaining)
return result
```

**Update return type signature:**
```javascript
// Line 97-99
/**
 * @returns {Promise<{ deleted: number, unauthorized: number, alreadyGone: number, failed: number }>}
 */
```

**Tests to add:**
```javascript
// src/features/notes/__tests__/noteDeleteQueue.test.js (new file)

describe('noteDeleteQueue', () => {
  describe('flushDeleteQueue', () => {
    it('counts successful deletions', async () => {
      // Mock apiFetch returning 200
      const result = await flushDeleteQueue(mockApiFetch)
      expect(result.deleted).toBe(1)
    })

    it('counts already-deleted notes', async () => {
      // Mock apiFetch returning 404
      const result = await flushDeleteQueue(mockApiFetch)
      expect(result.alreadyGone).toBe(1)
    })

    it('logs warning for unauthorized deletions', async () => {
      // Mock apiFetch returning 401
      const warnSpy = vi.spyOn(console, 'warn')
      const result = await flushDeleteQueue(mockApiFetch)
      expect(result.unauthorized).toBe(1)
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('unauthorized'))
    })

    it('retries on 5xx server errors', async () => {
      // Mock apiFetch returning 500
      queueNoteDeletion('note-1', 'track-1')
      const result = await flushDeleteQueue(mockApiFetch)
      expect(result.failed).toBe(1)
      expect(getQueueSize()).toBe(1) // Still in queue
    })

    it('removes from queue on network errors but counts as failed', async () => {
      // Mock apiFetch throwing network error
      queueNoteDeletion('note-1', 'track-1')
      const result = await flushDeleteQueue(mockApiFetch)
      expect(result.failed).toBe(1)
      expect(getQueueSize()).toBe(1) // Kept for retry
    })
  })
})
```

**Files to modify:**
- `src/features/notes/noteDeleteQueue.js` (enhance error handling)
- `src/features/notes/__tests__/noteDeleteQueue.test.js` (new file, ~150 lines)

**Estimated complexity:** Low (2-3 hours)

---

## Phase 2: Add Edge Case Test Coverage

### Goal
Add comprehensive tests for edge cases identified in the review.

### Test Cases to Add

#### 2.1 Concurrent Note Creation (Cross-Device)

**File:** `src/features/notes/__tests__/recoverySyncScenarios.test.js`

**Test scenario:**
```javascript
describe('Concurrent note creation', () => {
  it('merges notes created simultaneously on different devices', async () => {
    // Device 1: Create notes ["note1", "note2"] on track-1
    // Device 2: Create notes ["note3", "note4"] on track-1 (same track, different notes)
    // Both devices sync
    // Expected: Both devices show all 4 notes, sorted by createdAt
    // No duplicates, union merge successful
  })

  it('deduplicates identical notes created on different devices', async () => {
    // Device 1: Create note "Great track!" at timestamp T
    // Device 2: Create note "Great track!" at timestamp T (exact same)
    // Expected: Only 1 note appears (deduplication by signature)
  })
})
```

#### 2.2 Queue Overflow Handling

**File:** `src/features/notes/__tests__/noteDeleteQueue.test.js`

**Test scenario:**
```javascript
describe('Queue overflow', () => {
  it('handles localStorage quota exceeded gracefully', async () => {
    // Mock localStorage.setItem to throw QuotaExceededError
    // Queue 100 deletions
    // Expected: Error logged, queue truncated to fit, oldest deletions dropped
  })

  it('warns when queue exceeds reasonable size', async () => {
    // Queue 1000+ deletions (unusual scenario)
    // Expected: Warning logged, suggesting manual cleanup
  })
})
```

**Enhancement:** Add queue size limit (e.g., 100 items) and warn/truncate if exceeded.

#### 2.3 UUID Collision (Paranoid Case)

**File:** `src/features/notes/__tests__/recoverySyncScenarios.test.js`

**Test scenario:**
```javascript
describe('UUID collision handling', () => {
  it('handles duplicate noteId on server insert', async () => {
    // Device 1: Create note with id "collision-uuid"
    // Device 2: Create note with id "collision-uuid" (astronomically unlikely)
    // Server rejects second insert (duplicate key)
    // Expected: Client retries with new UUID, note is saved
  })
})
```

**Note:** This requires retry logic in `useNoteHandlers.js` if POST returns 409 Conflict.

#### 2.4 Partial Sync Failure

**File:** `src/features/playlist/__tests__/PlaylistProvider.test.jsx`

**Test scenario:**
```javascript
describe('Partial sync failure', () => {
  it('retains unsync notes when network fails mid-sync', async () => {
    // Create 5 notes locally
    // Mock apiFetch to succeed for 2 notes, then fail
    // Expected: 2 notes synced, 3 remain in local queue
    // Retry on next sync attempt
  })

  it('does not duplicate notes on retry after partial success', async () => {
    // Create 3 notes locally
    // First sync: 2 succeed, 1 fails
    // Second sync: retry the failed note
    // Expected: All 3 notes exist, no duplicates
  })
})
```

**Files to modify:**
- `src/features/notes/__tests__/recoverySyncScenarios.test.js` (add ~100 lines)
- `src/features/notes/__tests__/noteDeleteQueue.test.js` (add ~80 lines)
- `src/features/playlist/__tests__/PlaylistProvider.test.jsx` (add ~60 lines)

**Estimated complexity:** Medium (4-5 hours)

---

## Phase 3: Refactor API Endpoint (Split into Separate Routes)

### Goal
Improve maintainability by splitting `/api/db/notes` into focused endpoints.

### Current Issues

**File:** `api/db/notes.js` currently handles:
1. GET /api/db/notes → Fetch all notes/tags
2. POST /api/db/notes + body → Create note (append-only)
3. POST /api/db/notes + tags only → Upsert tags
4. DELETE /api/db/notes?noteId=X → Delete note

**Complexity:** 400+ lines in one file, complex branching logic

### Proposed Structure

```
api/db/
├── notes.js          → GET /api/db/notes (fetch), POST (create note), DELETE (delete note)
├── tags.js           → POST /api/db/tags (upsert tags for track)
└── _lib/
    ├── noteValidation.js   → Shared validation logic
    └── tagValidation.js    → Centralized tag normalization
```

### Implementation Details

#### 3.1 Extract Tag Endpoint

**File:** `api/db/tags.js` (new)

```javascript
// POST /api/db/tags
// Body: { trackId, tags: string[] }
// Upserts tags for a track (creates/updates representative row with body: '')

import { getAnonContext } from '../anon/_lib/anonContext.js'
import { createSupabaseClient } from '../_lib/supabase.js'
import { normalizeTagsInput } from './_lib/tagValidation.js'
import { touchLastActive } from './_lib/touchLastActive.js'

export default async function handler(req, res) {
  // CORS
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS')
    return res.status(204).end()
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Get anon context
  const anonContext = await getAnonContext(req, res)
  if (!anonContext) return

  const deviceId = req.headers['x-device-id']
  if (!deviceId) {
    return res.status(400).json({ error: 'Missing x-device-id header' })
  }

  // Parse and validate tags
  let trackId, tags
  try {
    const parsed = JSON.parse(req.body)
    trackId = parsed.trackId || parsed.track_id
    tags = normalizeTagsInput(parsed.tags)
  } catch (err) {
    return res.status(400).json({ error: err.message })
  }

  if (!trackId) {
    return res.status(400).json({ error: 'Missing trackId' })
  }

  // Upsert tags-only row
  const supabase = createSupabaseClient()
  const { data: existing } = await supabase
    .from('notes')
    .select('id')
    .eq('anon_id', anonContext.anonId)
    .eq('device_id', deviceId)
    .eq('track_id', trackId)
    .eq('body', '') // Tags-only rows have empty body
    .maybeSingle()

  if (existing) {
    // Update existing tags-only row
    const { data, error } = await supabase
      .from('notes')
      .update({ tags, last_active: new Date().toISOString() })
      .eq('id', existing.id)
      .select('id, track_id, tags')
      .single()

    if (error) {
      console.error('[tags:post] update error', error)
      return res.status(500).json({ error: 'Failed to update tags' })
    }

    await touchLastActive(supabase, anonContext.anonId, deviceId)
    return res.status(200).json({ tags: data })
  } else {
    // Create new tags-only row
    const { data, error } = await supabase
      .from('notes')
      .insert({
        anon_id: anonContext.anonId,
        device_id: deviceId,
        track_id: trackId,
        body: '',
        tags,
        last_active: new Date().toISOString(),
      })
      .select('id, track_id, tags')
      .single()

    if (error) {
      console.error('[tags:post] insert error', error)
      return res.status(500).json({ error: 'Failed to create tags' })
    }

    await touchLastActive(supabase, anonContext.anonId, deviceId)
    return res.status(201).json({ tags: data })
  }
}
```

#### 3.2 Simplify Notes Endpoint

**File:** `api/db/notes.js` (refactor)

Remove lines 283-389 (tags-only path) and simplify:

```javascript
// POST /api/db/notes
// Body: { trackId, body, noteId?, timestampMs?, tags? }
// Always creates a new note row (append-only)

if (req.method === 'POST') {
  // ... validation ...

  if (!noteBody) {
    return res.status(400).json({ error: 'Missing note body' })
  }

  // Accept client-provided noteId
  const clientNoteId = parsed?.noteId || parsed?.id || undefined

  const insertPayload = {
    anon_id: anonContext.anonId,
    device_id: deviceId,
    track_id: trackId,
    body: noteBody,
    tags: normalizedTags ?? [],
    last_active: nowIso,
  }

  if (clientNoteId) {
    insertPayload.id = clientNoteId
  }

  if (timestampProvided) {
    insertPayload.timestamp_ms = normalizedTimestamp ?? null
  }

  const { data, error } = await supabaseAdmin
    .from('notes')
    .insert(insertPayload)
    .select('id, track_id, body, tags, timestamp_ms, created_at, updated_at')
    .single()

  if (error) {
    console.error('[notes:post] supabase insert error', error)
    return res.status(500).json({ error: 'Failed to create note', details: error.message })
  }

  await touchLastActive(supabaseAdmin, anonContext.anonId, deviceId)

  return res.status(201).json({
    note: {
      id: data.id,
      trackId: data.track_id,
      body: data.body,
      tags: Array.isArray(data.tags) ? data.tags : [],
      timestampMs: typeof data.timestamp_ms === 'number' ? data.timestamp_ms : null,
      createdAt: data.created_at,
      updatedAt: data.updated_at,
    },
  })
}
```

#### 3.3 Centralize Tag Validation

**File:** `api/db/_lib/tagValidation.js` (new)

Move tag normalization from `api/db/notes.js` (lines 163-176) to shared module:

```javascript
// api/db/_lib/tagValidation.js

const MAX_TAG_LENGTH = 50
const MAX_TAGS_PER_TRACK = 32
const TAG_ALLOWED_RE = /^[a-z0-9\s-]+$/i

/**
 * Normalize and validate tags input
 * @param {unknown} input - Raw tags input (may be array of strings or invalid)
 * @returns {string[]} - Normalized tags (lowercase, deduplicated, sorted)
 * @throws {Error} - If validation fails
 */
export function normalizeTagsInput(input) {
  if (!Array.isArray(input)) {
    throw new Error('Tags must be an array')
  }

  const normalized = []
  const seen = new Set()

  for (const rawTag of input) {
    if (typeof rawTag !== 'string') {
      throw new Error('Tags must be strings')
    }

    const trimmed = rawTag.trim()
    if (!trimmed) continue

    if (trimmed.length > MAX_TAG_LENGTH) {
      throw new Error(`Tag "${trimmed}" exceeds maximum length of ${MAX_TAG_LENGTH}`)
    }

    if (!TAG_ALLOWED_RE.test(trimmed)) {
      throw new Error(`Tag "${trimmed}" contains invalid characters`)
    }

    const lower = trimmed.toLowerCase()
    if (!seen.has(lower)) {
      seen.add(lower)
      normalized.push(lower)
    }
  }

  if (normalized.length > MAX_TAGS_PER_TRACK) {
    throw new Error(`Too many tags (max ${MAX_TAGS_PER_TRACK})`)
  }

  return normalized.sort()
}
```

#### 3.4 Update Client to Use New Endpoints

**File:** `src/features/tags/tagSyncQueue.js`

Change endpoint from `/api/db/notes` to `/api/db/tags`:

```javascript
// Line ~45 (in flush function)
const response = await apiFetch('/api/db/tags', {
  method: 'POST',
  body: JSON.stringify({
    trackId: item.trackId,
    tags: item.tags,
  }),
})
```

**Files to modify:**
- `api/db/notes.js` (simplify, remove tags-only path, ~100 lines removed)
- `api/db/tags.js` (new file, ~120 lines)
- `api/db/_lib/tagValidation.js` (new file, ~50 lines)
- `src/features/tags/tagSyncQueue.js` (change endpoint)
- `api/db/__tests__/notes.test.js` (remove tags-only tests)
- `api/db/__tests__/tags.test.js` (new file, ~150 lines)

**Estimated complexity:** Medium-High (6-8 hours)

---

## Phase 4: Centralize Client-Side Tag Normalization

### Goal
Remove duplication of tag normalization logic across client and server.

### Current State

Tag normalization happens in multiple places:
1. **Server:** `api/db/_lib/tagValidation.js` (after Phase 3)
2. **Client:** `src/features/tags/tagUtils.js` (normalizeTag)
3. **Client:** `src/utils/notesTagsData.js` (normalization in merge functions)

### Proposed Changes

**File:** `src/features/tags/tagUtils.js`

Consolidate all client-side tag normalization here:

```javascript
// src/features/tags/tagUtils.js

import { MAX_TAG_LENGTH, MAX_TAGS_PER_TRACK, TAG_ALLOWED_RE } from './validation.js'

/**
 * Normalize a single tag (lowercase, trim)
 * @param {string} tag - Raw tag input
 * @returns {string | null} - Normalized tag or null if invalid
 */
export function normalizeTag(tag) {
  if (typeof tag !== 'string') return null
  const trimmed = tag.trim()
  if (!trimmed) return null
  if (trimmed.length > MAX_TAG_LENGTH) return null
  if (!TAG_ALLOWED_RE.test(trimmed)) return null
  return trimmed.toLowerCase()
}

/**
 * Normalize and deduplicate an array of tags
 * @param {string[]} tags - Raw tag array
 * @returns {string[]} - Normalized, deduplicated, sorted tags
 */
export function normalizeTagsList(tags) {
  if (!Array.isArray(tags)) return []

  const seen = new Set()
  const normalized = []

  for (const tag of tags) {
    const clean = normalizeTag(tag)
    if (clean && !seen.has(clean)) {
      seen.add(clean)
      normalized.push(clean)
    }
  }

  return normalized.slice(0, MAX_TAGS_PER_TRACK).sort()
}

/**
 * Validate tag input and throw on error (for UI validation)
 * @param {string} tag - Tag to validate
 * @throws {Error} - If validation fails
 */
export function validateTagInput(tag) {
  if (!tag || typeof tag !== 'string') {
    throw new Error('Tag cannot be empty')
  }

  const trimmed = tag.trim()
  if (trimmed.length > MAX_TAG_LENGTH) {
    throw new Error(`Tag exceeds maximum length of ${MAX_TAG_LENGTH}`)
  }

  if (!TAG_ALLOWED_RE.test(trimmed)) {
    throw new Error('Tag contains invalid characters (use letters, numbers, spaces, hyphens)')
  }

  return trimmed.toLowerCase()
}
```

**Update all usages:**
- `src/utils/notesTagsData.js` - use `normalizeTagsList` from tagUtils
- `src/features/playlist/PlaylistProvider.jsx` - use `normalizeTagsList` for remote merge
- `src/App.jsx` - use `validateTagInput` for user input validation

**Files to modify:**
- `src/features/tags/tagUtils.js` (consolidate logic)
- `src/utils/notesTagsData.js` (import and use normalizeTagsList)
- `src/features/playlist/PlaylistProvider.jsx` (import and use)
- `src/App.jsx` (use validateTagInput for UI validation)
- Add tests in `src/features/tags/__tests__/tagUtils.test.js`

**Estimated complexity:** Low-Medium (3-4 hours)

---

## Phase 5: Update Documentation

### Goal
Document the new architecture and behaviors in CLAUDE.md.

### Changes Required

**File:** `CLAUDE.md`

#### Section: API Structure (Lines ~94-108)

Add documentation for new `/api/db/tags` endpoint:

```markdown
### Database Endpoints
- **GET /api/db/notes** → Returns an array of `{ id, trackId, body, tags[] }` records
- **POST /api/db/notes** → Body: { trackId, body, noteId?, timestampMs?, tags? } → Creates new note (append-only)
- **DELETE /api/db/notes?noteId=X** → Deletes a specific note by ID
- **POST /api/db/tags** → Body: { trackId, tags: string[] } → Upserts tags for a track (creates/updates tags-only row)

**Note Storage:**
- Notes are append-only: each POST creates a new row (never updates existing notes)
- Multiple notes can exist per track (e.g., timestamped annotations)
- Tags are stored separately in tags-only rows (body: '')
- GET endpoint returns all note rows + tags-only rows, client performs union merge
```

#### Section: Tag Storage (NEW - add after line 108)

```markdown
### Tag Storage and Sync

**Storage Model:**
- Tags are stored in a separate "tags-only" row per (anonId, deviceId, trackId) tuple
- Tags-only rows have `body: ''` and contain the current tag set for that track on that device
- When notes are created with tags, those tags are also stored on the note row for historical record
- The client performs union merge of tags from all rows (note rows + tags-only rows)

**Sync Flow:**
1. User adds/removes tag → Updates local `tagsByTrack[trackId]` state
2. Tag sync queue batches changes (350ms debounce)
3. POST /api/db/tags with new tag set
4. Server upserts tags-only row
5. On sync, GET /api/db/notes returns all rows
6. Client unions tags from all rows into `tagsByTrack[trackId]`

**Normalization:**
- Tags are lowercase, alphanumeric + spaces + hyphens only
- Max 50 characters per tag
- Max 32 tags per track
- Always sorted alphabetically
- Centralized in `src/features/tags/tagUtils.js` (client) and `api/db/_lib/tagValidation.js` (server)
```

#### Section: Common Gotchas (Add to existing list)

```markdown
9. **Note Deletion Queue:** Deletion operations are queued in localStorage and flushed on mount/online. If a deletion fails with 401/403 (unauthorized), it's removed from the queue but logged as a warning. This prevents infinite retries for notes the user no longer owns.

10. **Tag Union Merge:** Tags are always merged using union strategy (local ∪ remote). This means tags added on any device will propagate to all devices. There is no "delete all tags" operation - to remove tags, explicitly remove each one.
```

**Files to modify:**
- `CLAUDE.md` (add ~60 lines of documentation)

**Estimated complexity:** Low (1 hour)

---

## Summary of Changes

| Phase | Description | Files Modified | New Files | Test Files | Complexity | Hours |
|-------|-------------|----------------|-----------|------------|------------|-------|
| 1 | DELETE endpoint error handling | 1 | 0 | 1 | Low | 2-3 |
| 2 | Edge case test coverage | 3 | 0 | 3 | Medium | 4-5 |
| 3 | API endpoint refactor | 3 | 3 | 2 | Med-High | 6-8 |
| 4 | Centralize tag normalization | 4 | 0 | 1 | Low-Med | 3-4 |
| 5 | Documentation updates | 1 | 0 | 0 | Low | 1 |
| **Total** | | **12** | **3** | **7** | | **16-21** |

---

## Implementation Order

**Recommended sequence:**

1. **Phase 1** (DELETE error handling) - Quick win, improves observability
2. **Phase 4** (Tag normalization) - Reduces duplication, makes Phase 3 easier
3. **Phase 3** (API refactor) - Major structural improvement, builds on Phase 4
4. **Phase 2** (Edge case tests) - Validates all changes work correctly
5. **Phase 5** (Documentation) - Final polish

**Alternative (minimal) approach:**
- If time is limited, prioritize **Phase 1 + Phase 2 only** (testing improvements)
- Defer Phase 3-4 refactoring to a future PR

---

## Testing Strategy

**All phases must maintain 100% test coverage:**
- Unit tests for new utilities
- Integration tests for API endpoints
- E2E tests for sync flows
- Run full test suite before merging each phase

**Manual testing checklist:**
- Create/delete notes with offline queue
- Sync across two devices
- Test 401/403 scenarios (change recovery code mid-session)
- Verify tag union merge with cross-device tag changes

---

## Risks and Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| API endpoint split breaks existing clients | Low | High | Maintain backward compatibility for 1 version, add deprecation warning |
| Queue overflow in localStorage | Low | Medium | Add queue size limit (100 items), truncate oldest |
| UUID collision (paranoia) | Very Low | Medium | Add retry logic on 409 Conflict |
| Tag normalization drift between client/server | Medium | Low | Shared validation constants, comprehensive tests |

---

## Out of Scope (Future Work)

- Note editing support (would require additional UPDATE endpoint)
- Pagination for GET /api/db/notes (not needed until users have 100+ notes)
- Separate `track_tags` table (current denormalized approach works fine)
- Migration for existing users (no current users)

---

## Critical Files Reference

**API:**
- `api/db/notes.js` - Note CRUD operations
- `api/db/tags.js` - Tag upsert operations (NEW)
- `api/db/_lib/tagValidation.js` - Shared tag validation (NEW)

**Client:**
- `src/features/notes/noteDeleteQueue.js` - Offline deletion queue
- `src/features/tags/tagUtils.js` - Tag normalization utilities
- `src/utils/notesTagsData.js` - Note/tag merge logic
- `src/features/playlist/PlaylistProvider.jsx` - Sync orchestration

**Tests:**
- `src/features/notes/__tests__/recoverySyncScenarios.test.js` - Integration tests
- `src/features/notes/__tests__/noteDeleteQueue.test.js` - Queue tests (NEW)
- `api/db/__tests__/tags.test.js` - Tag API tests (NEW)
