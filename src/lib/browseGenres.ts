export type BrowseGenreDefinition = {
  id: string;
  label: string;
  query: string;
  color: string;
  apiPath?: string;
  imageUrl?: string;
  hasPlaylists?: boolean;
  hasArtists?: boolean;
  hasAlbums?: boolean;
  hasTracks?: boolean;
  hasVideos?: boolean;
  source?: "fallback" | "tidal-api";
};

export const BROWSE_GENRES: BrowseGenreDefinition[] = [
  { id: "hip-hop", label: "Hip-Hop", query: "hip hop rap new hits", color: "28 86% 54%", apiPath: "Hiphop", source: "fallback" },
  { id: "pop", label: "Pop", query: "pop hits 2026", color: "338 80% 58%", apiPath: "Pop", source: "fallback" },
  { id: "rnb-soul", label: "R&B / Soul", query: "r&b soul new hits", color: "286 58% 56%", apiPath: "Funk", source: "fallback" },
  { id: "country", label: "Country", query: "country hits 2026", color: "35 58% 46%", apiPath: "Country", source: "fallback" },
  { id: "latin", label: "Latin", query: "latin hits reggaeton", color: "16 84% 56%", apiPath: "Latin", source: "fallback" },
  { id: "rock-indie", label: "Rock / Indie", query: "rock indie anthems", color: "2 70% 52%", apiPath: "Rock", source: "fallback" },
  { id: "dance-electronic", label: "Dance & Electronic", query: "dance electronic club hits", color: "196 76% 56%", apiPath: "Dance", source: "fallback" },
  { id: "jazz", label: "Jazz", query: "jazz essentials modern classics", color: "45 70% 50%", apiPath: "Jazz", source: "fallback" },
  { id: "classical", label: "Classical", query: "classical essentials", color: "220 48% 58%", apiPath: "Classical", source: "fallback" },
  { id: "reggae-dancehall", label: "Reggae / Dancehall", query: "reggae dancehall hits", color: "132 48% 44%", apiPath: "Reggae", source: "fallback" },
  { id: "gospel-christian", label: "Gospel / Christian", query: "gospel christian worship hits", color: "52 74% 54%", apiPath: "Gospel", source: "fallback" },
  { id: "metal", label: "Metal", query: "metal heavy essentials", color: "0 0% 38%", apiPath: "Metal", source: "fallback" },
  { id: "kids", label: "Kids", query: "kids music favorites", color: "198 52% 58%", apiPath: "Kids", source: "fallback" },
  { id: "blues", label: "Blues", query: "blues legends essentials", color: "214 44% 50%", apiPath: "Blues", source: "fallback" },
  { id: "folk-americana", label: "Folk / Americana", query: "folk americana essentials", color: "24 54% 48%", apiPath: "Americana", source: "fallback" },
  { id: "legacy", label: "Legacy", query: "legacy classics greatest hits", color: "0 0% 60%", apiPath: "Retro", source: "fallback" },
  { id: "global", label: "Global", query: "global music hits", color: "164 48% 46%", apiPath: "World", source: "fallback" },
  { id: "k-pop", label: "K-Pop", query: "k-pop trending", color: "314 68% 58%", source: "fallback" },
];
