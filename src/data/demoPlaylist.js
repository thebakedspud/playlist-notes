// src/data/demoPlaylist.js
// Demo playlist configuration: Notable Samples — classic funk and soul tracks
// annotated with timestamps where they were sampled in hip-hop.

export const DEMO_PLAYLIST_ID = 'demo-notable-samples'

/**
 * Demo playlist source URL - a curated Spotify playlist
 * that will be imported using the standard import flow.
 *
 * The playlist will be loaded via Spotify adapter, then
 * provider will be overridden to 'demo' to enable read-only mode
 * and prevent it from appearing in recent playlists.
 */
export const DEMO_PLAYLIST_URL = 'https://open.spotify.com/playlist/3sX5G9KAfZG0DRQnCfIxd8?si=6c96e5754c3643e8'

/**
 * Pre-authored notes to be merged with the imported playlist data.
 * These notes demonstrate timestamp annotation patterns to new users.
 *
 * Keys are Spotify track IDs from the demo playlist.
 */
export const DEMO_NOTES_BY_TRACK = {
  // I Got The.. - 2006 Remaster (Labi Siffre)
  '20VuO95A8RxUPlShnfYArW': [
    {
      id: 'demo-note-1a',
      body: 'is sampled in "My Name Is", the hit single off Eminem\'s The Slim Shady LP.',
      timestampMs: 130000,
      timestampEndMs: 180000,
      createdAt: 1765843551460,
    },
    {
      id: 'demo-note-1b',
      body: 'is also sampled in Jay Z\'s "Streets is Watching" off In My Lifetime, Vol.1',
      timestampMs: 24000,
      timestampEndMs: 40000,
      createdAt: 1765843563066,
    },
  ],

  // Through the Fire (Chaka Khan)
  '7gh2v4IHnxdiwSgA6xluhe': [
    {
      id: 'demo-note-2a',
      body: 'sampled in Kanye West\'s solo breakout hit "Through the Wire".',
      timestampMs: 191000,
      timestampEndMs: 242000,
      createdAt: 1765843820314,
    },
    {
      id: 'demo-note-2b',
      body: 'This song is known for launching Kanye\'s career as the lead single off The College Dropout.',
      createdAt: 1765843828889,
    },
  ],

  // Today (Tom Scott, The California Dreamers)
  '0u1URCwVrREjrQpQ6D1YQD': [
    {
      id: 'demo-note-3a',
      body: 'chops in this section were beautifully crafted into "They Reminisce Over YOU (T.R.O.Y) by Pete Rock & CL Smooth.',
      timestampMs: 55000,
      timestampEndMs: 98000,
      createdAt: 1765843836293,
    },
    {
      id: 'demo-note-3b',
      body: 'Listen for the iconic horns!',
      createdAt: 1765843843782,
    },
  ],

  // Rubber Band (The Trammps)
  '30qGwfY1Vuc4Xbdswn3cjF': [
    {
      id: 'demo-note-4a',
      body: 'sampled in "Hate it or Love it" by The Game ft. 50 Cent.',
      timestampMs: 123000,
      createdAt: 1765843849995,
    },
    {
      id: 'demo-note-4b',
      body: 'sampled by J Dilla in "Dilla Says Go"',
      timestampMs: 0,
      timestampEndMs: 10000,
      createdAt: 1765843867378,
    },
    {
      id: 'demo-note-4c',
      body: 'Check out how each song sampled the original track!',
      createdAt: 1765843876677,
    },
  ],

  // Don't Say Goodnight (It's Time for Love), Pts. 1 & 2 (The Isley Brothers)
  '6DVOThiin61bmeIwf6fzGx': [
    {
      id: 'demo-note-5a',
      body: '"So Far to Go" by J Dilla feat Common & D\'Angelo (RIP) uses a lovely chop from this section that I\'ve always loved.',
      timestampMs: 40000,
      createdAt: 1765843890934,
    },
    {
      id: 'demo-note-5b',
      body: 'J Dilla returns to this sample for his song "Bye." utilized more of the melody but keeping the original soul.',
      timestampMs: 300000,
      createdAt: 1765843971419,
    },
    {
      id: 'demo-note-5c',
      body: 'See if you can hear the difference in how the sample was used.',
      createdAt: 1765843977084,
    },
  ],

  // Yearning For Your Love (The Gap Band)
  '1kSxm4vU26W5xSUdnPUkyB': [
    {
      id: 'demo-note-6',
      body: 'Nas\' infamous track "Life\'s a Bitch" feat AZ and Olu Dara loops this chop.',
      timestampMs: 22000,
      createdAt: 1765843982149,
    },
  ],

  // You've Got the Makings of a Lover (The Festivals)
  '5GmfIhuF4LsPJxg9Z2FAIl': [
    {
      id: 'demo-note-7',
      body: 'the intro of this song is sampled on "BBO (Bad Bitches Only) by Migos feat 21 Savage.',
      timestampMs: 1000,
      createdAt: 1765844042636,
    },
  ],

  // Heaven & Hell (El Michels Affair)
  '6mmi0wu2uGDWKeDx4ufLEj': [
    {
      id: 'demo-note-8a',
      body: 'Used in both a classic and modern hip hop track',
      createdAt: 1765844049777,
    },
    {
      id: 'demo-note-8b',
      body: '"Wavybone" off AT.LONG.LAST.A$AP and "Heaven & Hell" by Raekwon feat. Ghostface Killah',
      timestampMs: 0,
      timestampEndMs: 10000,
      createdAt: 1765844056514,
    },
  ],

  // I Can't Help It (Michael Jackson)
  '1HibhNhwk2tljwC4BGGLXV': [
    {
      id: 'demo-note-9a',
      body: 'sampled by De La Soul in the song "Breakadawn"',
      timestampMs: 0,
      timestampEndMs: 15000,
      createdAt: 1765844074220,
    },
    {
      id: 'demo-note-9b',
      body: 'The lyrics of this sample also appear in "Sexy" by Mary J Blige and Jadakiss.',
      createdAt: 1765844079498,
    },
  ],

  // Ain't No Woman (Like the One I've Got) (Four Tops)
  '1tP2zymw1lurXGGw0rc7uR': [
    {
      id: 'demo-note-10a',
      body: 'sampled by Big Pun feat. Fat Joe on the track "Still not a Player"',
      timestampMs: 0,
      timestampEndMs: 10000,
      createdAt: 1765844216648,
    },
    {
      id: 'demo-note-10b',
      body: 'This Big Pun song and this sample were also used and referenced in "The Way" by Ariana Grande feat. Mac Miller (RIP).',
      createdAt: 1765844220913,
    },
  ],
}

/**
 * Pre-authored tags to be merged with the imported playlist data.
 * Keys are Spotify track IDs from the demo playlist.
 */
export const DEMO_TAGS_BY_TRACK = {
  '20VuO95A8RxUPlShnfYArW': ['bass', 'loop'],
  '7gh2v4IHnxdiwSgA6xluhe': ['bass', 'drums', 'vocal'],
  '0u1URCwVrREjrQpQ6D1YQD': ['bass', 'drums', 'horns'],
  '30qGwfY1Vuc4Xbdswn3cjF': ['bass', 'drums', 'loop'],
  '1kSxm4vU26W5xSUdnPUkyB': ['bass', 'drums'],
  '1tP2zymw1lurXGGw0rc7uR': ['bass', 'drums', 'melodic', 'strings'],
  '6mmi0wu2uGDWKeDx4ufLEj': ['bass', 'drums'],
  '1HibhNhwk2tljwC4BGGLXV': ['bass', 'vocal'],
}

/**
 * Check if a playlist ID is the demo playlist
 * @param {string | null | undefined} playlistId
 * @returns {boolean}
 */
export function isDemoPlaylistId(playlistId) {
  return playlistId === DEMO_PLAYLIST_ID
}

// localStorage key for tracking demo views (analytics only)
export const DEMO_VIEWED_KEY = 'sta:demo-viewed'

/**
 * Mark that the user has viewed the demo playlist (for analytics)
 */
export function markDemoViewed() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(DEMO_VIEWED_KEY, 'true')
    }
  } catch {
    // ignore storage errors
  }
}

/**
 * Check if the user has previously viewed the demo
 * @returns {boolean}
 */
export function hasDemoBeenViewed() {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(DEMO_VIEWED_KEY) === 'true'
    }
  } catch {
    // ignore storage errors
  }
  return false
}
