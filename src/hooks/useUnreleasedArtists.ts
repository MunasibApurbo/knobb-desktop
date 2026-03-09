import { useEffect, useState } from "react";

import { fetchUnreleasedArtists, type UnreleasedArtist } from "@/lib/unreleasedApi";

export function useUnreleasedArtists() {
  const [artists, setArtists] = useState<UnreleasedArtist[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const nextArtists = await fetchUnreleasedArtists();
        if (!cancelled) {
          setArtists(nextArtists);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load unreleased artists");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return { artists, loading, error };
}
