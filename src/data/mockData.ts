export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number; // seconds
  year: number;
  coverUrl: string;
  canvasColor: string; // HSL dominant color e.g. "0 70% 55%"
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  year: number;
  coverUrl: string;
  tracks: Track[];
  canvasColor: string;
}

export interface Playlist {
  id: string;
  title: string;
  description: string;
  coverUrl: string;
  tracks: Track[];
  canvasColor: string;
}

const covers = [
  "https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1504898770365-14faca6a7320?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1571330735066-03aaa9429d89?w=300&h=300&fit=crop",
  "https://images.unsplash.com/photo-1598387993441-a364f854c3e1?w=300&h=300&fit=crop",
];

const accentColors = [
  "0 70% 55%",     // red
  "220 70% 55%",   // blue
  "280 60% 55%",   // purple
  "30 80% 55%",    // orange
  "160 60% 45%",   // teal
  "340 70% 55%",   // pink
  "45 80% 50%",    // gold
  "190 70% 50%",   // cyan
];

function makeTrack(id: number, albumTitle: string, artist: string, coverUrl: string, color: string): Track {
  const titles = [
    "Midnight Drive", "Echoes of You", "Neon Skyline", "Fading Light",
    "Crystal Waves", "Burning Out", "Golden Hour", "Afterglow",
    "Starfall", "Phantom Touch", "Deep End", "Lost Signal",
    "Velvet Night", "Solar Flare", "Drift Away", "Electric Dreams",
    "Hollow Crown", "Paper Moon", "Wildfire", "Ocean Floor",
  ];
  return {
    id: `track-${id}`,
    title: titles[id % titles.length],
    artist,
    album: albumTitle,
    duration: 180 + Math.floor(Math.random() * 120),
    year: 2020 + Math.floor(Math.random() * 5),
    coverUrl,
    canvasColor: color,
  };
}

export const albums: Album[] = [
  { id: "album-1", title: "Neon Nights", artist: "Synthwave Collective", year: 2024, coverUrl: covers[0], canvasColor: accentColors[0], tracks: [] },
  { id: "album-2", title: "Ocean Depths", artist: "Luna Bay", year: 2023, coverUrl: covers[1], canvasColor: accentColors[1], tracks: [] },
  { id: "album-3", title: "Purple Haze", artist: "Violet Storm", year: 2024, coverUrl: covers[2], canvasColor: accentColors[2], tracks: [] },
  { id: "album-4", title: "Golden State", artist: "Sunset Radio", year: 2023, coverUrl: covers[3], canvasColor: accentColors[3], tracks: [] },
  { id: "album-5", title: "Emerald City", artist: "Forest Echo", year: 2024, coverUrl: covers[4], canvasColor: accentColors[4], tracks: [] },
  { id: "album-6", title: "Rose Garden", artist: "Petal & Thorn", year: 2022, coverUrl: covers[5], canvasColor: accentColors[5], tracks: [] },
  { id: "album-7", title: "Amber Waves", artist: "Desert Wind", year: 2024, coverUrl: covers[6], canvasColor: accentColors[6], tracks: [] },
  { id: "album-8", title: "Arctic Light", artist: "Polar Circuit", year: 2023, coverUrl: covers[7], canvasColor: accentColors[7], tracks: [] },
];

let trackId = 0;
albums.forEach((album) => {
  const count = 8 + Math.floor(Math.random() * 5);
  for (let i = 0; i < count; i++) {
    album.tracks.push(makeTrack(trackId++, album.title, album.artist, album.coverUrl, album.canvasColor));
  }
});

export const allTracks: Track[] = albums.flatMap((a) => a.tracks);

export const playlists: Playlist[] = [
  {
    id: "playlist-1",
    title: "Today's Hits",
    description: "The biggest songs right now",
    coverUrl: covers[0],
    canvasColor: accentColors[0],
    tracks: allTracks.slice(0, 15),
  },
  {
    id: "playlist-2",
    title: "Chill Vibes",
    description: "Relax and unwind",
    coverUrl: covers[3],
    canvasColor: accentColors[3],
    tracks: allTracks.slice(10, 25),
  },
  {
    id: "playlist-3",
    title: "Late Night",
    description: "Songs for the small hours",
    coverUrl: covers[2],
    canvasColor: accentColors[2],
    tracks: allTracks.slice(20, 35),
  },
  {
    id: "playlist-4",
    title: "Energy Boost",
    description: "Get pumped up",
    coverUrl: covers[5],
    canvasColor: accentColors[5],
    tracks: allTracks.slice(5, 20),
  },
];

export const recentlyPlayed = albums.slice(0, 6);
export const madeForYou = playlists;
export const popularAlbums = albums.slice(2, 8);

export const mockLyrics = [
  { time: 0, text: "♪ Instrumental ♪" },
  { time: 8, text: "Walking through the neon lights" },
  { time: 14, text: "Feeling like we own the night" },
  { time: 20, text: "Every beat drops like a dream" },
  { time: 26, text: "Nothing's ever what it seems" },
  { time: 32, text: "We're dancing in the afterglow" },
  { time: 38, text: "Where the midnight rivers flow" },
  { time: 44, text: "Hold me close, don't let me go" },
  { time: 50, text: "In this world we'll never know" },
  { time: 58, text: "♪ ♪ ♪" },
  { time: 64, text: "Stars are falling from the sky" },
  { time: 70, text: "We don't need a reason why" },
  { time: 76, text: "Lost inside this melody" },
  { time: 82, text: "You're the only one I see" },
  { time: 90, text: "♪ Instrumental ♪" },
  { time: 100, text: "Echoes fading in the dark" },
  { time: 106, text: "You left a fire in my heart" },
  { time: 112, text: "Every word you never said" },
  { time: 118, text: "Still plays on inside my head" },
  { time: 126, text: "♪ ♪ ♪" },
];

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function getTotalDuration(tracks: Track[]): string {
  const total = tracks.reduce((sum, t) => sum + t.duration, 0);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  return hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;
}
