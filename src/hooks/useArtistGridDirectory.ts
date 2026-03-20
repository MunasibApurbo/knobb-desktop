import { useEffect, useMemo, useState } from "react";

import {
  fetchArtistGridArtists,
  fetchArtistGridTestedTrackers,
  fetchArtistGridTrends,
  sortArtistGridArtistsByPopularity,
  type ArtistGridArtist,
} from "@/lib/unreleasedArchiveApi";

export function useArtistGridDirectory() {
  const [artists, setArtists] = useState<ArtistGridArtist[]>([]);
  const [testedTrackers, setTestedTrackers] = useState<string[]>([]);
  const [trends, setTrends] = useState<Map<string, number>>(new Map());
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const artistRows = await fetchArtistGridArtists();
        if (cancelled) return;
        setArtists(artistRows);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Could not load ArtistGrid data.");
        }
      } finally {
        if (!cancelled) {
          setLoaded(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const [trendMap, tested] = await Promise.all([
          fetchArtistGridTrends().catch(() => new Map<string, number>()),
          fetchArtistGridTestedTrackers().catch(() => [] as string[]),
        ]);

        if (cancelled) return;

        setTrends(trendMap);
        setTestedTrackers(tested);
      } catch {
        // Non-fatal enrichment fetches.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const sortedArtists = useMemo(
    () => sortArtistGridArtistsByPopularity(artists, trends),
    [artists, trends],
  );

  return {
    artists,
    error,
    loaded,
    sortedArtists,
    testedTrackers,
    trends,
  };
}
