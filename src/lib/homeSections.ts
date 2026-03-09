export const HOME_SECTION_CONFIG = {
  recommended: {
    title: "Recommended Songs",
    itemType: "track",
  },
  newreleases: {
    title: "New Releases for You",
    itemType: "album",
  },
  recent: {
    title: "Recently Played",
    itemType: "track",
  },
  recalbums: {
    title: "Albums You Might Like",
    itemType: "album",
  },
  recartists: {
    title: "Artists You Might Like",
    itemType: "artist",
  },
} as const;

export type HomeSectionKey = keyof typeof HOME_SECTION_CONFIG;

export function isHomeSectionKey(value: string): value is HomeSectionKey {
  return value in HOME_SECTION_CONFIG;
}
