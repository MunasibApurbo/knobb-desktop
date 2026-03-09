import { getTidalImageUrl } from "@/lib/musicApiTransforms";
import type { HomeAlbum } from "@/hooks/useHomeFeeds";

type EditorsPickAlbumRecord = {
  type: "album";
  id: number;
  title?: string;
  artist?: {
    id?: number;
    name?: string;
  };
  releaseDate?: string;
  cover?: string;
};

const EDITORS_PICKS_URL = "/editors-picks.json";

function mapEditorsPickAlbum(record: EditorsPickAlbumRecord): HomeAlbum | null {
  if (record.type !== "album" || !record.id || !record.title) {
    return null;
  }

  return {
    id: record.id,
    title: record.title,
    artist: record.artist?.name || "Various Artists",
    artistId: record.artist?.id,
    coverUrl: record.cover ? getTidalImageUrl(record.cover, "750x750") : "/placeholder.svg",
    releaseDate: record.releaseDate,
  };
}

export async function fetchEditorsPicks() {
  const response = await fetch(EDITORS_PICKS_URL);
  if (!response.ok) {
    throw new Error("Failed to load editor's picks");
  }

  const payload = await response.json() as unknown;
  if (!Array.isArray(payload)) return [] as HomeAlbum[];

  return payload
    .map((entry) => mapEditorsPickAlbum(entry as EditorsPickAlbumRecord))
    .filter((entry): entry is HomeAlbum => Boolean(entry));
}
