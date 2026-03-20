import { useEffect, useMemo, useState } from "react";

import { BROWSE_GENRES, type BrowseGenreDefinition } from "@/lib/browseGenres";
import { fetchTidalGenres } from "@/lib/tidalGenresApi";

export function useTidalGenres() {
  const [liveGenres, setLiveGenres] = useState<BrowseGenreDefinition[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    void fetchTidalGenres()
      .then((genres) => {
        if (!cancelled) {
          setLiveGenres(genres);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError(true);
          setLiveGenres([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoaded(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const genres = useMemo(
    () => (liveGenres.length > 0 ? liveGenres : BROWSE_GENRES),
    [liveGenres],
  );

  return {
    genres,
    loaded,
    error,
    usingLiveGenres: liveGenres.length > 0,
  };
}
