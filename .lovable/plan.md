

## Music Streaming App — Glassmorphic UI with Dynamic Accent

A music streaming frontend with frosted glass UI panels over a blurred background, dynamic accent colors derived from the currently playing track's canvas/artwork, and layouts inspired by Deezer and Spotify.

### Layout & Shell

- **Background**: Full-screen animated gradient or artwork-based blurred background that changes dynamically based on the current track's dominant color
- **All panels** (sidebar, top bar, cards, bottom player, right panel) use `backdrop-filter: blur()` with semi-transparent backgrounds — true glassmorphism
- **Accent color** adapts dynamically to the dominant color extracted from the current track's canvas/cover art

### Sidebar (Left)
- Collapsible glassmorphic sidebar with icon-only mini mode
- Sections: Home, Search, Library, Liked Songs
- Playlists list at the bottom

### Top Bar
- Back/forward navigation, search input, user avatar/menu

### Home Page
- Hero banner with featured album/playlist
- Horizontal scroll rows: "Recently Played", "Made For You", "Popular Albums"
- Glassmorphic album/playlist cards with cover art, title, subtitle

### Album / Playlist / Liked Songs Page (Deezer-style)
- Large header with cover art, title, artist, metadata (year, track count, duration)
- Action buttons: Play, Shuffle, Like, Download, Share
- Track list table: #, Title, Artist, Album, Duration with hover-to-play
- Clean table rows with subtle separators, like Deezer's layout

### Right Panel — Canvas & Lyrics (Spotify-style)
- Toggleable right sidebar panel
- Shows the current track's **canvas** (looping visual/video or animated artwork)
- Below canvas: **synced lyrics** display (scrolling with playback, mock data)
- Can be collapsed/hidden

### Bottom Player Bar (matching your screenshot)
- Full-width glassmorphic bar fixed at bottom
- Left: Playback controls (shuffle, previous, play/pause, next, repeat) + download, volume, queue icons
- Center: **Red waveform visualization** with elapsed/total time
- Right: Track info (title, artist, year), like button, HD badge
- Waveform uses canvas element for visual effect

### Search Page
- Search input with instant filter
- Results in tabs: Tracks, Albums, Artists, Playlists
- Glassmorphic result cards/rows

### Data
- All mock/static data — no real streaming backend
- Demo playback controls (visual only)

