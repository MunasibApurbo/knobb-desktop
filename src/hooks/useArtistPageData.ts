import { Dispatch, SetStateAction, useEffect, useLayoutEffect, useState } from "react";
import {
  filterAudioTracks,
  getAlbumWithTracks,
  getArtistAlbums,
  getArtistBio,
  getArtistById,
  getArtistPopularTracks,
  getMixWithTracks,
  getSimilarArtists,
  searchAlbums,
  getTidalImageUrl,
  searchArtists,
  searchTracks,
  TidalAlbum,
  TidalArtist,
  TidalTrack,
  tidalTrackToAppTrack,
} from "@/lib/musicApi";
import { Track } from "@/types/music";
import { useMainScrollY } from "@/hooks/useMainScrollY";

export type RelatedArtist = {
  id: number;
  name: string;
  picture: string;
};

type UseArtistPageDataOptions = {
  artistName: string;
  includeRadio?: boolean;
  id?: string;
};

type UseArtistPageDataResult = {
  albums: TidalAlbum[];
  artist: TidalArtist | null;
  bio: string;
  loading: boolean;
  radioLoading: boolean;
  radioTracks: Track[];
  relatedArtists: RelatedArtist[];
  scrollY: number;
  setShowAllAlbums: Dispatch<SetStateAction<boolean>>;
  setShowAllRelated: Dispatch<SetStateAction<boolean>>;
  setShowAllRadio: Dispatch<SetStateAction<boolean>>;
  setShowAllSinglesAndEps: Dispatch<SetStateAction<boolean>>;
  setShowAllTracks: Dispatch<SetStateAction<boolean>>;
  showAllAlbums: boolean;
  showAllRelated: boolean;
  showAllRadio: boolean;
  showAllSinglesAndEps: boolean;
  showAllTracks: boolean;
  singlesAndEps: TidalAlbum[];
  topTracks: Track[];
  tracksLoading: boolean;
};

type ArtistPageSnapshot = {
  albums: TidalAlbum[];
  artist: TidalArtist | null;
  bio: string;
  radioTracks: Track[];
  relatedArtists: RelatedArtist[];
  singlesAndEps: TidalAlbum[];
  topTracks: Track[];
};

function getReleaseType(album: TidalAlbum): "ALBUM" | "EP" | "SINGLE" | "UNKNOWN" {
  if (album.type === "ALBUM" || album.type === "EP" || album.type === "SINGLE") {
    return album.type;
  }

  const trackCount = album.numberOfTracks || 0;
  if (trackCount <= 1) return "SINGLE";
  if (trackCount > 1 && trackCount <= 6) return "EP";
  if (trackCount > 6) return "ALBUM";
  return "UNKNOWN";
}

function albumBelongsToArtist(album: TidalAlbum, artistId: number) {
  return (
    album.artist?.id === artistId ||
    album.artists?.some((artist) => artist.id === artistId) ||
    (!album.artist?.id && !album.artists?.length)
  );
}

function normalizeArtistPicture(value: string | null | undefined) {
  if (!value) return "";
  return /^https?:\/\//i.test(value) ? value : getTidalImageUrl(value, "320x320");
}

function partitionArtistReleases(releases: TidalAlbum[], artistId: number) {
  const scoped = releases.filter((album) => albumBelongsToArtist(album, artistId));
  return {
    albums: scoped.filter((album) => getReleaseType(album) === "ALBUM"),
    singlesAndEps: scoped.filter((album) => {
      const type = getReleaseType(album);
      return type === "SINGLE" || type === "EP";
    }),
  };
}

function createEmptySnapshot(): ArtistPageSnapshot {
  return {
    albums: [],
    artist: null,
    bio: "",
    radioTracks: [],
    relatedArtists: [],
    singlesAndEps: [],
    topTracks: [],
  };
}

function getArtistPageRequestKey({ artistName, id }: UseArtistPageDataOptions) {
  const normalizedName = artistName.trim().toLowerCase();
  return id ? `id:${id}` : `name:${normalizedName}`;
}

function parseArtistId(id?: string) {
  const parsed = Number.parseInt((id || "").replace(/^tidal-/, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function buildFallbackArtist(track: TidalTrack): TidalArtist {
  return {
    id: track.artist.id,
    name: track.artist.name,
    picture: track.artist.picture,
    popularity: 0,
    url: "",
  };
}

function normalizeArtistName(value: string | null | undefined) {
  return value?.trim().toLowerCase() || "";
}

function albumMatchesArtistName(album: TidalAlbum, artistName: string) {
  const normalizedArtistName = normalizeArtistName(artistName);
  if (!normalizedArtistName) return false;

  return (
    normalizeArtistName(album.artist?.name) === normalizedArtistName ||
    album.artists?.some((artist) => normalizeArtistName(artist.name) === normalizedArtistName) ||
    false
  );
}

function getCandidateArtistTracks({
  artistId,
  artistName,
  tracks,
}: {
  artistId: number | null;
  artistName: string;
  tracks: TidalTrack[];
}) {
  const normalizedArtistName = normalizeArtistName(artistName);
  return tracks
    .filter((track) => {
      if (
        artistId &&
        (
          track.artist?.id === artistId ||
          track.artists?.some((artist) => artist.id === artistId)
        )
      ) {
        return true;
      }

      if (!normalizedArtistName) return false;

      return (
        normalizeArtistName(track.artist?.name) === normalizedArtistName ||
        track.artists?.some((artist) => normalizeArtistName(artist.name) === normalizedArtistName)
      );
    })
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 25);
}

function getCandidateArtistReleases({
  artistId,
  artistName,
  releases,
}: {
  artistId: number | null;
  artistName: string;
  releases: TidalAlbum[];
}) {
  const filtered = releases.filter((album) =>
    artistId ? albumBelongsToArtist(album, artistId) : albumMatchesArtistName(album, artistName),
  );

  return filtered.sort(
    (a, b) => new Date(b.releaseDate || 0).getTime() - new Date(a.releaseDate || 0).getTime(),
  );
}

function getRelatedArtistsFromTracks(found: TidalArtist, tracks: TidalTrack[]) {
  const relatedMap = new Map<number, RelatedArtist>();

  for (const track of tracks) {
    if (!track.artists) continue;

    for (const collaborator of track.artists) {
      if (
        collaborator.id !== found.id &&
        !relatedMap.has(collaborator.id) &&
        collaborator.name !== found.name
      ) {
        relatedMap.set(collaborator.id, {
          id: collaborator.id,
          name: collaborator.name,
          picture: normalizeArtistPicture((collaborator as { picture?: string | null }).picture),
        });
      }
    }
  }

  return Array.from(relatedMap.values()).slice(0, 12);
}

function dedupeTidalTracks(tracks: TidalTrack[]) {
  const seen = new Set<number>();
  const deduped: TidalTrack[] = [];

  for (const track of tracks) {
    if (!track?.id || seen.has(track.id)) continue;
    seen.add(track.id);
    deduped.push(track);
  }

  return deduped;
}

async function loadArtistCatalogTracks(found: TidalArtist) {
  const releases = await getArtistAlbums(found.id).catch(() => [] as TidalAlbum[]);
  if (releases.length === 0) {
    return [] as TidalTrack[];
  }

  const collectedTracks: TidalTrack[] = [];
  const seenTrackIds = new Set<number>();

  for (let index = 0; index < releases.length; index += 3) {
    const releaseChunk = releases.slice(index, index + 3);
    const chunkResults = await Promise.all(
      releaseChunk.map(async (release) => {
        const result = await getAlbumWithTracks(release.id).catch(() => ({ album: null, tracks: [] as TidalTrack[] }));
        return result.tracks;
      }),
    );

    for (const tracks of chunkResults) {
      for (const track of tracks) {
        if (!track?.id || seenTrackIds.has(track.id)) continue;
        seenTrackIds.add(track.id);
        collectedTracks.push(track);
      }
    }
  }

  return collectedTracks;
}

async function loadArtistRadioTracks(found: TidalArtist, loadSeedTracks: () => Promise<TidalTrack[]>) {
  const artistMixId = found.mixes?.ARTIST_MIX;
  if (artistMixId) {
    const mixTracks = await getMixWithTracks(String(artistMixId)).catch(() => [] as TidalTrack[]);
    if (mixTracks.length > 0) {
      return dedupeTidalTracks(mixTracks).slice(0, 50);
    }
  }

  const catalogTracks = await loadArtistCatalogTracks(found);
  if (catalogTracks.length > 0) {
    return dedupeTidalTracks(catalogTracks).slice(0, 100);
  }

  const seedTracks = await loadSeedTracks();
  return dedupeTidalTracks(seedTracks).slice(0, 25);
}

async function resolveArtist({
  artistId,
  artistName,
  directArtistPromise,
}: {
  artistId: number | null;
  artistName: string;
  directArtistPromise: Promise<TidalArtist | null>;
}) {
  const normalizedArtistName = artistName.trim().toLowerCase();
  let found = await directArtistPromise;

  if (!found && artistName) {
    const artists = await searchArtists(artistName);
    found =
      artists.find((candidate) => candidate.name.trim().toLowerCase() === normalizedArtistName) ||
      artists.find((candidate) => candidate.id === artistId) ||
      artists[0] ||
      null;
  }

  if (!found && artistName) {
    const trackResults = await searchTracks(artistName, 5);
    if (trackResults.length > 0) {
      found = buildFallbackArtist(trackResults[0]);
    }
  }

  return found;
}

async function loadArtistTracks(found: TidalArtist, seededTracks?: TidalTrack[] | null) {
  const directTracks = seededTracks ?? (await getArtistPopularTracks(found.id, 25).catch(() => [] as TidalTrack[]));
  if (directTracks.length > 0) return directTracks;

  const fallbackTracks = await searchTracks(found.name, 50).catch(() => [] as TidalTrack[]);
  return fallbackTracks
    .filter((track) =>
      track.artist?.id === found.id ||
      track.artists?.some((artist) => artist.id === found.id),
    )
    .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
    .slice(0, 25);
}

const artistPageCache = new Map<string, ArtistPageSnapshot>();
const artistRadioRequestCache = new Map<string, Promise<Track[]>>();

function updateArtistPageCache(requestKey: string, partial: Partial<ArtistPageSnapshot>) {
  artistPageCache.set(requestKey, {
    ...(artistPageCache.get(requestKey) ?? createEmptySnapshot()),
    ...partial,
  });
}

async function loadAndCacheArtistRadioTracks({
  requestKey,
  found,
  loadSeedTracks,
}: {
  requestKey: string;
  found: TidalArtist;
  loadSeedTracks: () => Promise<TidalTrack[]>;
}) {
  const cached = artistPageCache.get(requestKey) ?? createEmptySnapshot();
  if (cached.radioTracks.length > 0) {
    return cached.radioTracks;
  }

  const pending = artistRadioRequestCache.get(requestKey);
  if (pending) {
    return pending;
  }

  const radioPromise = (async () => {
    const radioSourceTracks = await loadArtistRadioTracks(found, loadSeedTracks);
    const appRadioTracks = filterAudioTracks(
      radioSourceTracks.map((track) => tidalTrackToAppTrack(track)),
    );

    updateArtistPageCache(requestKey, {
      artist: found,
      radioTracks: appRadioTracks,
    });

    return appRadioTracks;
  })();

  artistRadioRequestCache.set(requestKey, radioPromise);

  try {
    return await radioPromise;
  } finally {
    artistRadioRequestCache.delete(requestKey);
  }
}

export function useArtistPageData({ artistName, includeRadio = true, id }: UseArtistPageDataOptions): UseArtistPageDataResult {
  const requestKey = getArtistPageRequestKey({ artistName, id });
  const initialSnapshot = artistPageCache.get(requestKey) ?? createEmptySnapshot();
  const hasInitialTopTracks = initialSnapshot.topTracks.length > 0;
  const hasInitialReleases = initialSnapshot.albums.length > 0 || initialSnapshot.singlesAndEps.length > 0;
  const hasInitialRelatedArtists = initialSnapshot.relatedArtists.length > 0;
  const hasInitialRadioTracks = initialSnapshot.radioTracks.length > 0;
  const [artist, setArtist] = useState<TidalArtist | null>(() => initialSnapshot.artist);
  const [topTracks, setTopTracks] = useState<Track[]>(() => initialSnapshot.topTracks);
  const [radioTracks, setRadioTracks] = useState<Track[]>(() => initialSnapshot.radioTracks);
  const [albums, setAlbums] = useState<TidalAlbum[]>(() => initialSnapshot.albums);
  const [singlesAndEps, setSinglesAndEps] = useState<TidalAlbum[]>(() => initialSnapshot.singlesAndEps);
  const [relatedArtists, setRelatedArtists] = useState<RelatedArtist[]>(() => initialSnapshot.relatedArtists);
  const [bio, setBio] = useState(() => initialSnapshot.bio);
  const [loading, setLoading] = useState(() => !initialSnapshot.artist);
  const [tracksLoading, setTracksLoading] = useState(() => !initialSnapshot.topTracks.length);
  const [radioLoading, setRadioLoading] = useState(() => includeRadio && !initialSnapshot.radioTracks.length);
  const [showAllTracks, setShowAllTracks] = useState(false);
  const [showAllRadio, setShowAllRadio] = useState(false);
  const [showAllRelated, setShowAllRelated] = useState(false);
  const [showAllAlbums, setShowAllAlbums] = useState(false);
  const [showAllSinglesAndEps, setShowAllSinglesAndEps] = useState(false);
  const scrollY = useMainScrollY();

  useLayoutEffect(() => {
    const cached = artistPageCache.get(requestKey) ?? createEmptySnapshot();

    setArtist(cached.artist);
    setTopTracks(cached.topTracks);
    setRadioTracks(cached.radioTracks);
    setAlbums(cached.albums);
    setSinglesAndEps(cached.singlesAndEps);
    setRelatedArtists(cached.relatedArtists);
    setBio(cached.bio);
    setLoading(!cached.artist);
    setTracksLoading(!cached.topTracks.length);
    setRadioLoading(includeRadio && !cached.radioTracks.length);
    setShowAllTracks(false);
    setShowAllRadio(false);
    setShowAllAlbums(false);
    setShowAllSinglesAndEps(false);
    setShowAllRelated(false);
  }, [includeRadio, requestKey]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const artistId = parseArtistId(id);
        const searchFallbackTracksPromise = artistName
          ? searchTracks(artistName, 50).catch(() => [] as TidalTrack[])
          : Promise.resolve([] as TidalTrack[]);
        const searchFallbackAlbumsPromise = artistName
          ? searchAlbums(artistName, 30).catch(() => [] as TidalAlbum[])
          : Promise.resolve([] as TidalAlbum[]);
        const directArtistPromise = artistId
          ? getArtistById(artistId).catch(() => null)
          : Promise.resolve<TidalArtist | null>(null);
        const directTracksPromise = artistId
          ? getArtistPopularTracks(artistId, 25).catch(() => [] as TidalTrack[])
          : Promise.resolve<TidalTrack[] | null>(null);
        const directSecondaryPromise = artistId
          ? Promise.all([
              getArtistAlbums(artistId).catch(() => [] as TidalAlbum[]),
              getSimilarArtists(artistId).catch(() => [] as TidalArtist[]),
              getArtistBio(artistId).catch(() => ""),
            ])
          : null;

        if (!hasInitialTopTracks && artistName) {
          void (async () => {
            const quickTracks = getCandidateArtistTracks({
              artistId,
              artistName,
              tracks: await searchFallbackTracksPromise,
            });
            if (cancelled || quickTracks.length === 0) return;
            if ((artistPageCache.get(requestKey)?.topTracks.length ?? 0) > 0) return;

            const quickAppTracks = filterAudioTracks(quickTracks.map((track) => tidalTrackToAppTrack(track)));
            if (quickAppTracks.length === 0) return;

            setTopTracks(quickAppTracks);
            setTracksLoading(false);
            updateArtistPageCache(requestKey, {
              topTracks: quickAppTracks,
            });
          })();
        }

        const found = await resolveArtist({
          artistId,
          artistName,
          directArtistPromise,
        });
        if (cancelled) return;

        if (!found) {
          if (!cancelled) {
            setLoading(false);
            setTracksLoading(false);
            setRadioLoading(false);
          }
          return;
        }

        setArtist(found);
        setLoading(false);
        updateArtistPageCache(requestKey, {
          artist: found,
        });

        if (found.bio) {
          setBio(found.bio);
          updateArtistPageCache(requestKey, {
            artist: found,
            bio: found.bio,
          });
        }

        const artistBioPromise = artistId && found.id === artistId && directSecondaryPromise
          ? directSecondaryPromise.then(([, , artistBio]) => artistBio)
          : getArtistBio(found.id).catch(() => "");

        void (async () => {
          try {
            const artistBio = (await artistBioPromise) || found.bio || "";
            if (cancelled || !artistBio) return;

            setBio(artistBio);
            updateArtistPageCache(requestKey, {
              artist: found,
              bio: artistBio,
            });
          } catch (e) {
            console.error("Failed to load artist biography:", e);
          }
        })();

        if (!hasInitialReleases) {
          void (async () => {
            const quickReleases = getCandidateArtistReleases({
              artistId: found.id,
              artistName: found.name,
              releases: await searchFallbackAlbumsPromise,
            });
            if (cancelled || quickReleases.length === 0) return;
            const cached = artistPageCache.get(requestKey) ?? createEmptySnapshot();
            if (cached.albums.length > 0 || cached.singlesAndEps.length > 0) return;

            const { albums: quickAlbums, singlesAndEps: quickSinglesAndEps } = partitionArtistReleases(
              quickReleases,
              found.id,
            );

            if (quickAlbums.length === 0 && quickSinglesAndEps.length === 0) return;

            setAlbums(quickAlbums);
            setSinglesAndEps(quickSinglesAndEps);
            artistPageCache.set(requestKey, {
              ...cached,
              artist: found,
              albums: quickAlbums,
              singlesAndEps: quickSinglesAndEps,
            });
          })();
        }

        if (!hasInitialRelatedArtists) {
          void (async () => {
            const quickRelatedArtists = getRelatedArtistsFromTracks(
              found,
              getCandidateArtistTracks({
                artistId: found.id,
                artistName: found.name,
                tracks: await searchFallbackTracksPromise,
              }),
            );
            if (cancelled || quickRelatedArtists.length === 0) return;
            const cached = artistPageCache.get(requestKey) ?? createEmptySnapshot();
            if (cached.relatedArtists.length > 0) return;

            setRelatedArtists(quickRelatedArtists);
            artistPageCache.set(requestKey, {
              ...cached,
              artist: found,
              relatedArtists: quickRelatedArtists,
            });
          })();
        }

        const tracksPromise = (async () => {
          const seededTracks = artistId && found.id === artistId ? await directTracksPromise : null;
          return loadArtistTracks(found, seededTracks);
        })();

        if (!hasInitialRadioTracks) {
          if (includeRadio) {
            setRadioLoading(true);
          }

          void loadAndCacheArtistRadioTracks({
            requestKey,
            found,
            loadSeedTracks: async () => await tracksPromise,
          }).then((appRadioTracks) => {
            if (cancelled || !includeRadio) return;
            setRadioTracks(appRadioTracks);
            setRadioLoading(false);
          }).catch((e) => {
            console.error("Failed to load artist radio:", e);
            if (!cancelled && includeRadio) setRadioLoading(false);
          });
        } else {
          setRadioLoading(false);
        }

        const tracks = await tracksPromise;
        if (cancelled) return;

        const appTracks = filterAudioTracks(tracks.map((track) => tidalTrackToAppTrack(track)));
        setTopTracks(appTracks);
        setTracksLoading(false);
        updateArtistPageCache(requestKey, {
          artist: found,
          topTracks: appTracks,
        });

        void (async () => {
          try {
            const [allAlbumsList, similarArtists, artistBio] =
              artistId && found.id === artistId && directSecondaryPromise
                ? await directSecondaryPromise
                : await Promise.all([
                    getArtistAlbums(found.id).catch(() => [] as TidalAlbum[]),
                    getSimilarArtists(found.id).catch(() => [] as TidalArtist[]),
                    artistBioPromise,
                  ]);
            if (cancelled) return;

            const { albums: mainAlbums, singlesAndEps: releaseSinglesAndEps } = partitionArtistReleases(
              allAlbumsList,
              found.id,
            );

            setBio(artistBio);
            setAlbums(mainAlbums);
            setSinglesAndEps(releaseSinglesAndEps);

            const relatedFromApi = similarArtists
              .filter((related) => related.id !== found.id && related.name !== found.name)
              .map((related) => ({
                id: related.id,
                name: related.name,
                picture: normalizeArtistPicture(related.picture),
              }));

            if (relatedFromApi.length > 0) {
              const resolvedRelatedArtists = relatedFromApi.slice(0, 12);
              setRelatedArtists(resolvedRelatedArtists);
              artistPageCache.set(requestKey, {
                ...(artistPageCache.get(requestKey) ?? createEmptySnapshot()),
                artist: found,
                topTracks: appTracks,
                albums: mainAlbums,
                singlesAndEps: releaseSinglesAndEps,
                relatedArtists: resolvedRelatedArtists,
                bio: artistBio,
              });
              return;
            }

            const relatedMap = new Map<number, RelatedArtist>();

            for (const track of tracks) {
              if (!track.artists) continue;

              for (const collaborator of track.artists) {
                if (
                  collaborator.id !== found.id &&
                  !relatedMap.has(collaborator.id) &&
                  collaborator.name !== found.name
                ) {
                  relatedMap.set(collaborator.id, {
                    id: collaborator.id,
                    name: collaborator.name,
                    picture: normalizeArtistPicture((collaborator as { picture?: string | null }).picture),
                  });
                }
              }
            }

            if (appTracks.length > 0 && appTracks[0].tidalId) {
              try {
                const recommendations = await getRecommendations(appTracks[0].tidalId);
                if (!cancelled) {
                  for (const recommendation of recommendations) {
                    if (
                      recommendation.artist &&
                      recommendation.artist.id !== found.id &&
                      !relatedMap.has(recommendation.artist.id)
                    ) {
                      relatedMap.set(recommendation.artist.id, {
                        id: recommendation.artist.id,
                        name: recommendation.artist.name,
                        picture: normalizeArtistPicture(recommendation.artist.picture),
                      });
                    }
                  }
                }
              } catch {
                // Ignore related fallback failures.
              }
            }

            if (!cancelled) {
              const resolvedRelatedArtists = Array.from(relatedMap.values()).slice(0, 12);
              setRelatedArtists(resolvedRelatedArtists);
              artistPageCache.set(requestKey, {
                ...(artistPageCache.get(requestKey) ?? createEmptySnapshot()),
                artist: found,
                topTracks: appTracks,
                albums: mainAlbums,
                singlesAndEps: releaseSinglesAndEps,
                relatedArtists: resolvedRelatedArtists,
                bio: artistBio,
              });
            }
          } catch (e) {
            console.error("Failed to load artist secondary sections:", e);
          }
        })();
      } catch (e) {
        console.error("Failed to load artist:", e);
        if (!cancelled) {
          setLoading(false);
          setTracksLoading(false);
          setRadioLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artistName, hasInitialRadioTracks, hasInitialRelatedArtists, hasInitialReleases, hasInitialTopTracks, id, includeRadio, requestKey]);

  return {
    albums,
    artist,
    bio,
    loading,
    radioLoading,
    radioTracks,
    relatedArtists,
    scrollY,
    setShowAllAlbums,
    setShowAllRelated,
    setShowAllRadio,
    setShowAllSinglesAndEps,
    setShowAllTracks,
    showAllAlbums,
    showAllRelated,
    showAllRadio,
    showAllSinglesAndEps,
    showAllTracks,
    singlesAndEps,
    topTracks,
    tracksLoading,
  };
}
