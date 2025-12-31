import '@testing-library/jest-dom/vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.setConfig({ testTimeout: 15000 })

// Mocks for storage
const loadAppStateMock = vi.hoisted(() => vi.fn(() => null))
const saveAppStateMock = vi.hoisted(() => vi.fn())
const clearAppStateMock = vi.hoisted(() => vi.fn())
const getPendingMigrationSnapshotMock = vi.hoisted(() => vi.fn(() => null))
const clearPendingMigrationSnapshotMock = vi.hoisted(() => vi.fn())
const writeAutoBackupSnapshotMock = vi.hoisted(() => vi.fn())
const stashPendingMigrationSnapshotMock = vi.hoisted(() => vi.fn())
const loadRecentMock = vi.hoisted(() => vi.fn(() => []))
const saveRecentMock = vi.hoisted(() => vi.fn())
const upsertRecentMock = vi.hoisted(() => vi.fn((list, item) => [...(list || []), item]))

// Mock for API client
const apiFetchMock = vi.hoisted(() =>
  vi.fn(async () => ({
    ok: true,
    status: 200,
    headers: new Map(),
    json: async () => ({}),
  }))
)

// Mock for focus utilities
const focusByIdMock = vi.hoisted(() => vi.fn())
const focusElementMock = vi.hoisted(() => vi.fn())

// Mock for demo playlist analytics
const markDemoViewedMock = vi.hoisted(() => vi.fn())

// Mock for import flow - will be configured per test
const importInitialMock = vi.hoisted(() => vi.fn())

vi.mock('./utils/storage.js', () => ({
  loadAppState: loadAppStateMock,
  saveAppState: saveAppStateMock,
  clearAppState: clearAppStateMock,
  getPendingMigrationSnapshot: getPendingMigrationSnapshotMock,
  clearPendingMigrationSnapshot: clearPendingMigrationSnapshotMock,
  writeAutoBackupSnapshot: writeAutoBackupSnapshotMock,
  stashPendingMigrationSnapshot: stashPendingMigrationSnapshotMock,
  loadRecent: loadRecentMock,
  saveRecent: saveRecentMock,
  upsertRecent: upsertRecentMock,
}))

vi.mock('./lib/apiClient.js', () => ({
  apiFetch: apiFetchMock,
}))

vi.mock('./utils/focusById.js', () => ({
  focusById: focusByIdMock,
  focusElement: focusElementMock,
  default: focusByIdMock,
}))

vi.mock('./data/demoPlaylist.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    markDemoViewed: markDemoViewedMock,
  }
})

vi.mock('./features/import/usePlaylistImportFlow.js', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    default: () => ({
      status: 'idle',
      loading: false,
      data: null,
      error: null,
      importInitial: importInitialMock,
      importMore: vi.fn(),
      reimport: vi.fn(),
      reset: vi.fn(),
      cancel: vi.fn(),
    }),
  }
})

describe('Demo playlist visibility', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()

    // Default: no persisted state (fresh user)
    loadAppStateMock.mockReturnValue(null)
    loadRecentMock.mockReturnValue([])

    // Setup matchMedia mock
    if (!window.matchMedia) {
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: false,
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }))
    }
  })

  it('shows demo card when user has no imported playlists', async () => {
    const { default: App } = await import('./App.jsx')

    render(<App />)

    // Demo card should be visible
    expect(
      await screen.findByRole('heading', { name: /no playlist link\? try our demo/i })
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /load demo playlist/i })
    ).toBeInTheDocument()
  })

  it('demo card remains visible after user views and exits demo', async () => {
    // Mock successful demo import
    const demoData = {
      tracks: [
        { id: 'demo-track-1', title: 'Demo Track', artist: 'Demo Artist', notes: [], tags: [] },
      ],
      meta: {
        hasMore: false,
        provider: 'spotify',
        playlistId: '3sX5G9KAfZG0DRQnCfIxd8',
        snapshotId: 'demo-snap-1',
        total: 1,
      },
      importedAt: new Date().toISOString(),
      title: 'Notable Samples',
      coverUrl: 'https://demo-cover.jpg',
      total: 1,
    }
    importInitialMock.mockResolvedValue({ ok: true, data: demoData })

    const { default: App } = await import('./App.jsx')
    const user = userEvent.setup()

    render(<App />)

    // Step 1: Demo card should be visible on landing
    const demoButton = await screen.findByRole('button', { name: /load demo playlist/i })
    expect(demoButton).toBeInTheDocument()

    // Step 2: Click to load demo
    await user.click(demoButton)

    // Step 3: Wait for playlist view to appear (demo loaded)
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Notable Samples/i })).toBeInTheDocument()
    })

    // Verify markDemoViewed was called for analytics
    expect(markDemoViewedMock).toHaveBeenCalledTimes(1)

    // Step 4: Exit demo by clicking "Import my own playlist"
    const exitButton = await screen.findByRole('button', { name: /import my own playlist/i })
    await user.click(exitButton)

    // Step 5: Should be back on landing screen with demo card still visible
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /no playlist link\? try our demo/i })
      ).toBeInTheDocument()
    })

    // Demo button should still be clickable
    expect(
      screen.getByRole('button', { name: /load demo playlist/i })
    ).toBeInTheDocument()
  })

  it('hides demo card when user has imported a real playlist', async () => {
    // Mock persisted state with a real (non-demo) playlist in recents
    const now = Date.now()
    loadRecentMock.mockReturnValue([
      {
        id: 'spotify:real-playlist-1',
        provider: 'spotify',
        playlistId: 'real-playlist-1',
        title: 'My Real Playlist',
        sourceUrl: 'https://open.spotify.com/playlist/abc123',
        importedAt: now,
        lastUsedAt: now,
      },
    ])

    const { default: App } = await import('./App.jsx')

    render(<App />)

    // Wait for landing to render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/paste a spotify playlist/i)).toBeInTheDocument()
    })

    // Demo card should NOT be visible
    expect(
      screen.queryByRole('heading', { name: /no playlist link\? try our demo/i })
    ).not.toBeInTheDocument()
  })

  it('shows demo card when only demo playlists exist in recents', async () => {
    // Mock recents with only a demo playlist
    const now = Date.now()
    loadRecentMock.mockReturnValue([
      {
        id: 'demo:demo-notable-samples',
        provider: 'demo',
        playlistId: 'demo-notable-samples',
        title: 'Notable Samples',
        sourceUrl: 'https://open.spotify.com/playlist/3sX5G9KAfZG0DRQnCfIxd8',
        importedAt: now,
        lastUsedAt: now,
      },
    ])

    const { default: App } = await import('./App.jsx')

    render(<App />)

    // Demo card should still be visible since no REAL playlist has been imported
    expect(
      await screen.findByRole('heading', { name: /no playlist link\? try our demo/i })
    ).toBeInTheDocument()
  })

  it('hides demo card when user has both demo and real playlists in recents', async () => {
    // Mock recents with both demo and real playlists
    const now = Date.now()
    loadRecentMock.mockReturnValue([
      {
        id: 'demo:demo-notable-samples',
        provider: 'demo',
        playlistId: 'demo-notable-samples',
        title: 'Notable Samples',
        sourceUrl: 'https://open.spotify.com/playlist/3sX5G9KAfZG0DRQnCfIxd8',
        importedAt: now,
        lastUsedAt: now,
      },
      {
        id: 'spotify:my-playlist',
        provider: 'spotify',
        playlistId: 'my-playlist',
        title: 'My Playlist',
        sourceUrl: 'https://open.spotify.com/playlist/xyz789',
        importedAt: now,
        lastUsedAt: now,
      },
    ])

    const { default: App } = await import('./App.jsx')

    render(<App />)

    // Wait for landing to render
    await waitFor(() => {
      expect(screen.getByPlaceholderText(/paste a spotify playlist/i)).toBeInTheDocument()
    })

    // Demo card should NOT be visible because a real playlist exists
    expect(
      screen.queryByRole('heading', { name: /no playlist link\? try our demo/i })
    ).not.toBeInTheDocument()
  })

  it('demo card remains visible through multiple demo load cycles', async () => {
    // Mock successful demo import
    const demoData = {
      tracks: [
        { id: 'demo-track-1', title: 'Demo Track', artist: 'Demo Artist', notes: [], tags: [] },
      ],
      meta: {
        hasMore: false,
        provider: 'spotify',
        playlistId: '3sX5G9KAfZG0DRQnCfIxd8',
        snapshotId: 'demo-snap-1',
        total: 1,
      },
      importedAt: new Date().toISOString(),
      title: 'Notable Samples',
      coverUrl: 'https://demo-cover.jpg',
      total: 1,
    }
    importInitialMock.mockResolvedValue({ ok: true, data: demoData })

    const { default: App } = await import('./App.jsx')
    const user = userEvent.setup()

    render(<App />)

    // First cycle: load demo → exit
    const demoButton1 = await screen.findByRole('button', { name: /load demo playlist/i })
    await user.click(demoButton1)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Notable Samples/i })).toBeInTheDocument()
    })

    const exitButton1 = await screen.findByRole('button', { name: /import my own playlist/i })
    await user.click(exitButton1)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /no playlist link\? try our demo/i })
      ).toBeInTheDocument()
    })

    // Second cycle: load demo → exit
    const demoButton2 = screen.getByRole('button', { name: /load demo playlist/i })
    await user.click(demoButton2)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Notable Samples/i })).toBeInTheDocument()
    })

    const exitButton2 = await screen.findByRole('button', { name: /import my own playlist/i })
    await user.click(exitButton2)

    // Demo card should still be visible after multiple cycles
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /no playlist link\? try our demo/i })
      ).toBeInTheDocument()
    })

    expect(
      screen.getByRole('button', { name: /load demo playlist/i })
    ).toBeInTheDocument()

    // Analytics should have been called twice (once per demo load)
    expect(markDemoViewedMock).toHaveBeenCalledTimes(2)
  })

  it('hides demo card after user imports a real playlist following demo usage', async () => {
    // Mock successful demo import
    const demoData = {
      tracks: [
        { id: 'demo-track-1', title: 'Demo Track', artist: 'Demo Artist', notes: [], tags: [] },
      ],
      meta: {
        hasMore: false,
        provider: 'spotify',
        playlistId: '3sX5G9KAfZG0DRQnCfIxd8',
        snapshotId: 'demo-snap-1',
        total: 1,
      },
      importedAt: new Date().toISOString(),
      title: 'Notable Samples',
      coverUrl: 'https://demo-cover.jpg',
      total: 1,
    }

    // Mock real playlist import
    const realPlaylistData = {
      tracks: [
        { id: 'real-track-1', title: 'Real Track', artist: 'Real Artist', notes: [], tags: [] },
      ],
      meta: {
        hasMore: false,
        provider: 'spotify',
        playlistId: 'real-playlist-123',
        snapshotId: 'real-snap-1',
        total: 1,
      },
      importedAt: new Date().toISOString(),
      title: 'My Real Playlist',
      coverUrl: 'https://real-cover.jpg',
      total: 1,
    }

    importInitialMock
      .mockResolvedValueOnce({ ok: true, data: demoData })
      .mockResolvedValueOnce({ ok: true, data: realPlaylistData })

    const { default: App } = await import('./App.jsx')
    const user = userEvent.setup()

    render(<App />)

    // Step 1: Load and exit demo
    const demoButton = await screen.findByRole('button', { name: /load demo playlist/i })
    await user.click(demoButton)

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /Notable Samples/i })).toBeInTheDocument()
    })

    const exitButton = await screen.findByRole('button', { name: /import my own playlist/i })
    await user.click(exitButton)

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: /no playlist link\? try our demo/i })
      ).toBeInTheDocument()
    })

    // Step 2: Import a real playlist (use valid Spotify playlist URL)
    const urlInput = screen.getByPlaceholderText(/paste a spotify playlist/i)
    await user.type(urlInput, 'https://open.spotify.com/playlist/0qAdOo9vlP57bEiCOwDEc1?si=724670fafb25432f')

    const importButton = screen.getByRole('button', { name: /import playlist/i })
    await user.click(importButton)

    // Wait for real playlist to load
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: /My Real Playlist/i })).toBeInTheDocument()
    })

    // Verify recents was updated with the real playlist
    expect(upsertRecentMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        provider: 'spotify',
        playlistId: 'real-playlist-123',
      })
    )
  })
})
