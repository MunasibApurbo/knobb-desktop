export type BrowseGenreDefinition = {
  id: string;
  label: string;
  query: string;
  color: string;
};

export const BROWSE_GENRES: BrowseGenreDefinition[] = [
  { id: "hip-hop", label: "Hip-Hop", query: "hip hop rap new hits", color: "28 86% 54%" },
  { id: "pop", label: "Pop", query: "pop hits 2026", color: "338 80% 58%" },
  { id: "rnb-soul", label: "R&B / Soul", query: "r&b soul new hits", color: "286 58% 56%" },
  { id: "country", label: "Country", query: "country hits 2026", color: "35 58% 46%" },
  { id: "latin", label: "Latin", query: "latin hits reggaeton", color: "16 84% 56%" },
  { id: "rock-indie", label: "Rock / Indie", query: "rock indie anthems", color: "2 70% 52%" },
  { id: "dance-electronic", label: "Dance & Electronic", query: "dance electronic club hits", color: "196 76% 56%" },
  { id: "jazz", label: "Jazz", query: "jazz essentials modern classics", color: "45 70% 50%" },
  { id: "classical", label: "Classical", query: "classical essentials", color: "220 48% 58%" },
  { id: "reggae-dancehall", label: "Reggae / Dancehall", query: "reggae dancehall hits", color: "132 48% 44%" },
  { id: "gospel-christian", label: "Gospel / Christian", query: "gospel christian worship hits", color: "52 74% 54%" },
  { id: "metal", label: "Metal", query: "metal heavy essentials", color: "0 0% 38%" },
  { id: "kids", label: "Kids", query: "kids music favorites", color: "198 52% 58%" },
  { id: "blues", label: "Blues", query: "blues legends essentials", color: "214 44% 50%" },
  { id: "folk-americana", label: "Folk / Americana", query: "folk americana essentials", color: "24 54% 48%" },
  { id: "legacy", label: "Legacy", query: "legacy classics greatest hits", color: "0 0% 60%" },
  { id: "global", label: "Global", query: "global music hits", color: "164 48% 46%" },
  { id: "k-pop", label: "K-Pop", query: "k-pop trending", color: "314 68% 58%" },
];
