import type { ReactNode } from "react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

import { localFilesStore } from "@/lib/localFilesStore";
import { scheduleBackgroundTask } from "@/lib/performanceProfile";
import type { Track } from "@/types/music";

type LocalFilesContextType = {
  importFiles: (files: File[]) => Promise<number>;
  isLoading: boolean;
  localFiles: Track[];
  refresh: () => Promise<void>;
  removeLocalFile: (localFileId: string) => Promise<void>;
  totalBytes: number;
  clearLocalFiles: () => Promise<void>;
};

const LocalFilesContext = createContext<LocalFilesContextType | null>(null);

function revokeTrackUrls(tracks: Track[]) {
  for (const track of tracks) {
    if (track.isLocal && track.streamUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(track.streamUrl);
    }
  }
}

function revokeUrlMap(urls: Map<string, string>) {
  for (const url of urls.values()) {
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
  }
}

export function LocalFilesProvider({ children }: { children: ReactNode }) {
  const [localFiles, setLocalFiles] = useState<Track[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const tracksRef = useRef<Track[]>([]);
  const objectUrlsRef = useRef(new Map<string, string>());

  const refresh = useCallback(async () => {
    setIsLoading(true);

    try {
      const records = await localFilesStore.list();
      const nextUrls = new Map<string, string>();
      const nextTracks = records.map((record) => ({
        ...record.track,
        localFileId: record.id,
        localFileSize: record.size,
        localImportedAt: record.createdAt,
        streamUrl: (() => {
          const cachedUrl = objectUrlsRef.current.get(record.id);
          const nextUrl = cachedUrl || URL.createObjectURL(record.blob);
          nextUrls.set(record.id, nextUrl);
          return nextUrl;
        })(),
      }));

      for (const [id, url] of objectUrlsRef.current.entries()) {
        if (nextUrls.has(id)) continue;
        if (url.startsWith("blob:")) {
          URL.revokeObjectURL(url);
        }
      }

      objectUrlsRef.current = nextUrls;
      const previousTracks = tracksRef.current;
      tracksRef.current = nextTracks;
      setLocalFiles(nextTracks);
      revokeTrackUrls(previousTracks.filter((track) => !track.localFileId || !nextUrls.has(track.localFileId)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const cancel = scheduleBackgroundTask(() => {
      void refresh();
    }, 900);

    return () => {
      cancel();
      revokeUrlMap(objectUrlsRef.current);
    };
  }, [refresh]);

  const importFiles = useCallback(async (files: File[]) => {
    const importedCount = await localFilesStore.addFiles(files);
    await refresh();
    return importedCount;
  }, [refresh]);

  const removeLocalFile = useCallback(async (localFileId: string) => {
    await localFilesStore.remove(localFileId);
    await refresh();
  }, [refresh]);

  const clearLocalFiles = useCallback(async () => {
    await localFilesStore.clear();
    await refresh();
  }, [refresh]);

  const totalBytes = useMemo(
    () => localFiles.reduce((sum, track) => sum + (track.localFileSize || 0), 0),
    [localFiles],
  );

  const value = useMemo(
    () => ({
      importFiles,
      isLoading,
      localFiles,
      refresh,
      removeLocalFile,
      totalBytes,
      clearLocalFiles,
    }),
    [clearLocalFiles, importFiles, isLoading, localFiles, refresh, removeLocalFile, totalBytes],
  );

  return (
    <LocalFilesContext.Provider value={value}>{children}</LocalFilesContext.Provider>
  );
}

export function useLocalFiles() {
  const context = useContext(LocalFilesContext);
  if (!context) {
    throw new Error("useLocalFiles must be used inside LocalFilesProvider");
  }

  return context;
}
