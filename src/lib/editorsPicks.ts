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
const EDITORS_PICKS_SEED: EditorsPickAlbumRecord[] = [
  {
    type: "album",
    id: 89313048,
    title: "DAYTONA",
    artist: { id: 3972883, name: "Pusha T" },
    releaseDate: "2018-05-25",
    cover: "30288caf-2bdd-4511-a95c-57117936b2b6",
  },
  {
    type: "album",
    id: 324660713,
    title: "JOECHILLWORLD",
    artist: { id: 3972883, name: "Devon Hendryx" },
    releaseDate: "2010-08-10",
    cover: "25d45544-3e82-4184-b8c2-2c2c6f0f152a",
  },
  {
    type: "album",
    id: 418729278,
    title: "I LAY DOWN MY LIFE FOR YOU: DIRECTOR'S CUT",
    artist: { id: 7958797, name: "JPEGMAFIA" },
    releaseDate: "2025-02-03",
    cover: "9c84302b-2584-4c0a-9db7-e648542f459f",
  },
  {
    type: "album",
    id: 118353565,
    title: "Dyn-O-Mite",
    artist: { id: 5755811, name: "ZelooperZ" },
    releaseDate: "2019-05-18",
    cover: "c42f0025-9839-4dd2-b5de-9fd05ed5e917",
  },
  {
    type: "album",
    id: 4527433,
    title: "Flockaveli",
    artist: { id: 3654061, name: "Waka Flocka Flame" },
    releaseDate: "2010-10-05",
    cover: "05702b51-45cf-4157-b9ed-dd7ca7e7b7b3",
  },
  {
    type: "album",
    id: 90502209,
    title: "NASIR",
    artist: { id: 1003, name: "Nas" },
    releaseDate: "2018-06-15",
    cover: "503ea6b2-0829-438e-8e4e-9a988154b3bc",
  },
  {
    type: "album",
    id: 413189044,
    title: "Jump Out",
    artist: { id: 27836827, name: "OsamaSon" },
    releaseDate: "2025-01-24",
    cover: "ec4a4ef2-69fe-4d3c-aaba-05dc2d546e84",
  },
  {
    type: "album",
    id: 209061256,
    title: "Super Tecmo Bo",
    artist: { id: 4839917, name: "Boldy James" },
    releaseDate: "2021-12-17",
    cover: "f58ca804-1da7-4953-a26d-2b3258310db5",
  },
];

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

function mapEditorsPickAlbums(records: EditorsPickAlbumRecord[]) {
  return records
    .map((entry) => mapEditorsPickAlbum(entry))
    .filter((entry): entry is HomeAlbum => Boolean(entry));
}

export function getSeedEditorsPicks() {
  return mapEditorsPickAlbums(EDITORS_PICKS_SEED);
}

export async function fetchEditorsPicks() {
  try {
    const response = await fetch(EDITORS_PICKS_URL);
    if (!response.ok) {
      return getSeedEditorsPicks();
    }

    const payload = await response.json() as unknown;
    if (!Array.isArray(payload)) return getSeedEditorsPicks();

    const picks = mapEditorsPickAlbums(payload as EditorsPickAlbumRecord[]);
    return picks.length > 0 ? picks : getSeedEditorsPicks();
  } catch {
    return getSeedEditorsPicks();
  }
}
