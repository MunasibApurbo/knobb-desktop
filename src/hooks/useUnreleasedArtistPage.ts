import { useEffect, useState } from "react";

import {
  fetchUnreleasedArtistPage,
  type UnreleasedArtist,
  type UnreleasedProject,
} from "@/lib/unreleasedApi";

export function useUnreleasedArtistPage(sheetId: string | undefined) {
  const [artist, setArtist] = useState<UnreleasedArtist | null>(null);
  const [projects, setProjects] = useState<UnreleasedProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sheetId) {
      setArtist(null);
      setProjects([]);
      setLoading(false);
      setError("Missing artist id");
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const data = await fetchUnreleasedArtistPage(sheetId);
        if (!cancelled) {
          setArtist(data.artist);
          setProjects(data.projects);
          setError(null);
        }
      } catch (fetchError) {
        if (!cancelled) {
          setError(fetchError instanceof Error ? fetchError.message : "Failed to load unreleased artist");
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
  }, [sheetId]);

  return { artist, projects, loading, error };
}
