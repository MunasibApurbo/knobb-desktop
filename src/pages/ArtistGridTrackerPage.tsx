import { useCallback, useDeferredValue, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, ArrowUpRight, ExternalLink, FileSpreadsheet, Pause, Play, Plus, Search, Share, Shuffle, X } from "lucide-react";
import { toast } from "sonner";

import { PageTransition } from "@/components/PageTransition";
import { DetailActionBar, DETAIL_ACTION_BUTTON_CLASS } from "@/components/detail/DetailActionBar";
import { DetailHero } from "@/components/detail/DetailHero";
import { TrackContextMenu } from "@/components/TrackContextMenu";
import { TrackListRow } from "@/components/detail/TrackListRow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { extractDominantColor } from "@/lib/colorExtractor";
import { copyPlainTextToClipboard } from "@/lib/mediaNavigation";
import { resolveArtistGridTrackCanvasColor } from "@/lib/artistGridTrackColors";
import { getArtworkColorSampleUrl } from "@/lib/trackArtwork";
import { cn } from "@/lib/utils";
import { isSameTrack, normalizeTrackIdentity } from "@/lib/trackIdentity";
import {
  buildArtistGridPlaybackProxyUrl,
  normalizeArtistGridSourceUrl,
  resolveArtistGridPlayableUrl,
} from "@/lib/artistGridPlayback";
import {
  buildArtistGridTrackerUrl,
  fetchArtistGridTracker,
  getArtistGridSheetEditUrl,
  getArtistGridTrackCount,
  normalizeArtistGridArtistName,
  type ArtistGridTrackerEra,
  type ArtistGridTrackerLeak,
  type ArtistGridTrackerResponse,
} from "@/lib/unreleasedArchiveApi";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import type { Track } from "@/types/music";

const artistGridArtworkColorCache = new Map<string, string>();

function generateArtistGridTrackId(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) - hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return `artistgrid-${Math.abs(hash).toString(36)}`;
}

function isHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;
  return /^https?:\/\//i.test(value.trim());
}

function getArtistGridLeakCandidateUrls(leak: ArtistGridTrackerLeak) {
  const values = [
    ...(Array.isArray(leak.urls) ? leak.urls : []),
    leak.url,
    leak.quality,
    leak.available_length,
  ];

  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    if (!isHttpUrl(value)) continue;
    const normalized = normalizeArtistGridSourceUrl(value);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }

  return result;
}

function getPrimaryLeakUrl(leak: ArtistGridTrackerLeak) {
  return getArtistGridLeakCandidateUrls(leak)[0] || null;
}

function getArtistGridPlayableSource(url: string) {
  const normalized = normalizeArtistGridSourceUrl(url);

  if (/\.(mp3|m4a|aac|wav|flac|ogg|opus)(?:$|[?#])/i.test(normalized)) return "direct";
  if (/https?:\/\/pillows\.su\/f\//i.test(normalized)) return "pillows";
  if (/https?:\/\/music\.froste\.lol\/song\//i.test(normalized)) return "froste";
  if (/https?:\/\/krakenfiles\.com\/view\//i.test(normalized)) return "krakenfiles";
  if (/https?:\/\/pixeldrain\.com\/d\//i.test(normalized)) return "pixeldrain";
  if (/https?:\/\/juicewrldapi\.com\/juicewrld/i.test(normalized)) return "juicewrldapi";
  if (/https?:\/\/.*imgur\.gg/i.test(normalized)) return "imgur";
  if (/https?:\/\/files\.yetracker\.org\/f\//i.test(normalized)) return "yetracker";
  if (/https?:\/\/(www\.)?soundcloud\.com\//i.test(normalized)) return "soundcloud";
  if (/https?:\/\/tidal\.com\//i.test(normalized)) return "tidal";
  if (/https?:\/\/(open\.)?qobuz\.com\/track\//i.test(normalized)) return "qobuz";
  return "unknown";
}

function canResolveArtistGridPlayableUrl(leak: ArtistGridTrackerLeak) {
  return getArtistGridLeakCandidateUrls(leak).some((url) => getArtistGridPlayableSource(url) !== "unknown");
}

function parseArtistGridTrackDuration(value?: string) {
  if (!value) return 0;
  const normalized = value.trim();
  const parts = normalized.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => !Number.isFinite(part))) return 0;
  if (parts.length === 2) return (parts[0] * 60) + parts[1];
  if (parts.length === 3) return (parts[0] * 3600) + (parts[1] * 60) + parts[2];
  return 0;
}

function getArtistGridTrackYear(...values: Array<string | undefined>) {
  for (const value of values) {
    const match = value?.match(/\b(19|20)\d{2}\b/);
    if (match) return Number.parseInt(match[0], 10);
  }
  return 0;
}

function filterEraData(era: ArtistGridTrackerEra, normalizedQuery: string) {
  if (!normalizedQuery) return era;

  const groups = Object.entries(era.data || {}).reduce<Record<string, ArtistGridTrackerLeak[]>>((acc, [groupName, tracks]) => {
    const filteredTracks = tracks.filter((track) => {
      const haystack = [
        track.name,
        track.extra,
        track.description,
        track.type,
        track.available_length,
        track.quality,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedQuery) || groupName.toLowerCase().includes(normalizedQuery);
    });

    if (filteredTracks.length > 0) {
      acc[groupName] = filteredTracks;
    }

    return acc;
  }, {});

  return {
    ...era,
    data: groups,
  };
}

export default function ArtistGridTrackerPage() {
  const navigate = useNavigate();
  const { sheetId = "" } = useParams<{ sheetId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToQueue, currentTrack, isPlaying, play, togglePlay } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const [data, setData] = useState<ArtistGridTrackerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedEraDescriptions, setExpandedEraDescriptions] = useState<Record<string, boolean>>({});
  const [resolvedPlayableUrls, setResolvedPlayableUrls] = useState<Map<string, string>>(new Map());
  const requestedTab = searchParams.get("tab")?.trim() || undefined;
  const deferredQuery = useDeferredValue(searchQuery);
  useEffect(() => {
    if (!/^[a-zA-Z0-9_-]{44}$/.test(sheetId)) {
      setError("This ArtistGrid tracker id is not valid.");
      return;
    }

    let cancelled = false;
    setError(null);

    void (async () => {
      try {
        const next = await fetchArtistGridTracker(sheetId, requestedTab);
        if (cancelled) return;
        if (!next?.eras || Object.keys(next.eras).length === 0) {
          setError("This tracker returned no eras for the selected tab.");
          setData(null);
          return;
        }

        setData(next);
      } catch (nextError) {
        if (!cancelled) {
          setError(nextError instanceof Error ? nextError.message : "Could not load ArtistGrid tracker.");
          setData(null);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [requestedTab, sheetId]);

  const artistQueryName = searchParams.get("artist")?.trim() || "";
  const pageTitle = useMemo(
    () => artistQueryName || normalizeArtistGridArtistName(String(data?.name || "ArtistGrid Tracker")),
    [artistQueryName, data?.name],
  );

  const filteredEras = useMemo(() => {
    if (!data) return [];
    const normalizedQuery = deferredQuery.trim().toLowerCase();

    return Object.entries(data.eras)
      .map(([eraKey, era]) => [eraKey, filterEraData(era, normalizedQuery)] as const)
      .filter(([, era]) => Object.values(era.data || {}).some((items) => items.length > 0));
  }, [data, deferredQuery]);

  const trackCount = useMemo(() => (data ? getArtistGridTrackCount(data.eras) : 0), [data]);
  const currentTab = data?.current_tab || requestedTab || "";
  const artworkUrl = Object.values(data?.eras || {}).find((era) => era.image)?.image || "/placeholder.svg";
  const [resolvedArtworkColors, setResolvedArtworkColors] = useState<Record<string, string>>({});
  const visiblePlayableLeaks = useMemo(
    () =>
      filteredEras.flatMap(([, era]) =>
        Object.values(era.data || {})
          .flatMap((leaks) => leaks)
          .filter((leak) => canResolveArtistGridPlayableUrl(leak))
          .map((leak) => ({ era, leak })),
      ),
    [filteredEras],
  );

  useEffect(() => {
    const distinctArtworkUrls = Array.from(new Set(
      [artworkUrl, ...filteredEras.map(([, era]) => era.image).filter((value): value is string => Boolean(value))],
    )).filter((value) => value !== "/placeholder.svg");

    if (distinctArtworkUrls.length === 0) return;

    let cancelled = false;

    const cachedEntries = distinctArtworkUrls
      .map((url) => [url, artistGridArtworkColorCache.get(url)] as const)
      .filter((entry): entry is readonly [string, string] => Boolean(entry[1]));

    if (cachedEntries.length > 0) {
      setResolvedArtworkColors((current) => {
        const next = { ...current };
        let changed = false;
        for (const [url, color] of cachedEntries) {
          if (next[url] === color) continue;
          next[url] = color;
          changed = true;
        }
        return changed ? next : current;
      });
    }

    distinctArtworkUrls.forEach((url) => {
      if (artistGridArtworkColorCache.has(url)) return;

      void extractDominantColor(getArtworkColorSampleUrl(url)).then((color) => {
        if (cancelled || !color) return;
        artistGridArtworkColorCache.set(url, color);
        setResolvedArtworkColors((current) => (
          current[url] === color
            ? current
            : { ...current, [url]: color }
        ));
      });
    });

    return () => {
      cancelled = true;
    };
  }, [artworkUrl, filteredEras]);

  const createArtistGridTrack = useCallback(({
    leak,
    era,
    fallbackKey,
    isUnavailable = false,
    playableUrl,
    sourceUrl,
  }: {
    leak: ArtistGridTrackerLeak;
    era: ArtistGridTrackerEra;
    fallbackKey: string;
    isUnavailable?: boolean;
    playableUrl?: string;
    sourceUrl?: string | null;
  }): Track => {
    const coverUrl = era.image || artworkUrl;
    const proxiedPlayableUrl = playableUrl ? buildArtistGridPlaybackProxyUrl(playableUrl) : null;

    return normalizeTrackIdentity({
      id: generateArtistGridTrackId(fallbackKey),
      title: leak.name || "Unknown Track",
      artist: pageTitle,
      album: era.name || pageTitle,
      duration: parseArtistGridTrackDuration(leak.track_length),
      year: getArtistGridTrackYear(leak.file_date, leak.leak_date, era.timeline),
      coverUrl,
      canvasColor: resolveArtistGridTrackCanvasColor({
        artworkColor: resolvedArtworkColors[coverUrl],
        eraBackgroundColor: era.backgroundColor,
      }),
      sourceId: sourceUrl ? `${sheetId}:${sourceUrl}` : undefined,
      streamUrl: proxiedPlayableUrl || undefined,
      streamUrls: proxiedPlayableUrl ? {
        HIGH: proxiedPlayableUrl,
      } : undefined,
      streamTypes: proxiedPlayableUrl ? {
        HIGH: "direct",
      } : undefined,
      audioQuality: "HIGH",
      isUnavailable,
    });
  }, [artworkUrl, pageTitle, resolvedArtworkColors, sheetId]);

  const createPlayableTrack = useCallback((leak: ArtistGridTrackerLeak, era: ArtistGridTrackerEra, sourceUrl: string, playableUrl: string): Track => {
    return createArtistGridTrack({
      leak,
      era,
      fallbackKey: `${sheetId}:${era.name}:${leak.name}:${sourceUrl}`,
      playableUrl,
      sourceUrl,
    });
  }, [createArtistGridTrack, sheetId]);

  const playableQueue = useMemo(
    () =>
      filteredEras.flatMap(([, era]) =>
        Object.values(era.data || {}).flatMap((leaks) =>
          leaks.flatMap((leak) => {
            const sourceUrl = getPrimaryLeakUrl(leak);
            if (!sourceUrl) return [];

            const playableUrl = resolvedPlayableUrls.get(sourceUrl);
            if (!playableUrl) return [];

            return [createPlayableTrack(leak, era, sourceUrl, playableUrl)];
          }),
        ),
      ),
    [createPlayableTrack, filteredEras, resolvedPlayableUrls],
  );

  const buildPlayableQueue = useCallback((selectedUrl: string, selectedPlayableUrl: string) => {
    const queue: Track[] = [];

    for (const [, era] of filteredEras) {
      for (const leaks of Object.values(era.data || {})) {
        for (const leak of leaks) {
          const sourceUrl = getPrimaryLeakUrl(leak);
          if (!sourceUrl) continue;

          const playableUrl = sourceUrl === selectedUrl
            ? selectedPlayableUrl
            : resolvedPlayableUrls.get(sourceUrl);

          if (!playableUrl) continue;
          queue.push(createPlayableTrack(leak, era, sourceUrl, playableUrl));
        }
      }
    }

    return queue;
  }, [createPlayableTrack, filteredEras, resolvedPlayableUrls]);

  const resolveLeakPlayback = useCallback(async (leak: ArtistGridTrackerLeak) => {
    const candidates = getArtistGridLeakCandidateUrls(leak);

    for (const candidate of candidates) {
      const cached = resolvedPlayableUrls.get(candidate);
      if (cached) {
        return { playableUrl: cached, sourceUrl: candidate };
      }

      const playableUrl = await resolveArtistGridPlayableUrl(candidate);
      if (!playableUrl) continue;

      setResolvedPlayableUrls((current) => {
        const next = new Map(current);
        next.set(candidate, playableUrl);
        return next;
      });

      return { playableUrl, sourceUrl: candidate };
    }

    return null;
  }, [resolvedPlayableUrls]);

  const handlePlayLeak = useCallback(async (leak: ArtistGridTrackerLeak, era: ArtistGridTrackerEra) => {
    const resolved = await resolveLeakPlayback(leak);
    if (!resolved) {
      toast.error("This ArtistGrid link could not be turned into an in-app stream.");
      return;
    }

    const track = createPlayableTrack(leak, era, resolved.sourceUrl, resolved.playableUrl);
    if (currentTrack && isSameTrack(currentTrack, track)) {
      togglePlay();
      return;
    }

    const queue = buildPlayableQueue(resolved.sourceUrl, resolved.playableUrl);
    play(track, queue.length > 0 ? queue : [track]);
  }, [buildPlayableQueue, createPlayableTrack, currentTrack, play, resolveLeakPlayback, togglePlay]);

  const handleQueueLeak = useCallback(async (leak: ArtistGridTrackerLeak, era: ArtistGridTrackerEra) => {
    const resolved = await resolveLeakPlayback(leak);
    if (!resolved) {
      toast.error("This ArtistGrid link is not available for in-app queueing yet.");
      return;
    }

    addToQueue(createPlayableTrack(leak, era, resolved.sourceUrl, resolved.playableUrl));
    toast.success(`Queued ${leak.name || "track"}`);
  }, [addToQueue, createPlayableTrack, resolveLeakPlayback]);

  const handlePlayVisibleLeak = useCallback(async (mode: "first" | "shuffle" = "first") => {
    if (visiblePlayableLeaks.length === 0) {
      toast.error("No playable entries are currently available in this view.");
      return;
    }

    const selected =
      mode === "shuffle"
        ? visiblePlayableLeaks[Math.floor(Math.random() * visiblePlayableLeaks.length)]
        : visiblePlayableLeaks[0];

    await handlePlayLeak(selected.leak, selected.era);
  }, [handlePlayLeak, visiblePlayableLeaks]);

  const handleShareTracker = useCallback(async () => {
    await copyPlainTextToClipboard(window.location.href);
    toast.success("Tracker link copied to clipboard");
  }, []);

  const handleSelectTab = (tab: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (!data || tab === data.tabs[0]) {
      nextParams.delete("tab");
    } else {
      nextParams.set("tab", tab);
    }

    setSearchParams(nextParams);
  };

  const sheetUrl = getArtistGridSheetEditUrl(`https://docs.google.com/spreadsheets/d/${sheetId}/edit`);
  const sourceTrackerUrl = buildArtistGridTrackerUrl(sheetId, artistQueryName || pageTitle, currentTab || undefined);
  const isCurrentTracker = Boolean(currentTrack?.sourceId?.startsWith(`${sheetId}:`));
  const heroBody = (
    <div className="space-y-2">
      <p className="max-w-2xl text-sm leading-6 text-white/68">
        A cleaner in-app view of the current ArtistGrid tab with search, quick play, and source links.
      </p>
      {artistQueryName && data?.name && normalizeArtistGridArtistName(String(data.name)) !== artistQueryName ? (
        <p className="text-xs uppercase tracking-[0.16em] text-white/42">
          Source tracker name: {normalizeArtistGridArtistName(String(data.name))}
        </p>
      ) : null}
    </div>
  );
  const heroMetaItems = [
    currentTab ? { label: "Tab", value: currentTab } : null,
    { label: "Entries", value: String(trackCount) },
    { label: "Playable", value: String(visiblePlayableLeaks.length) },
  ].filter(Boolean) as Array<{ label: string; value: string }>;
  const heroMeta = (
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-white/54">
      {heroMetaItems.map((item) => (
        <span key={item.label} className="inline-flex items-center gap-2">
          <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">{item.label}</span>
          <span className="font-medium text-white/88">{item.value}</span>
        </span>
      ))}
    </div>
  );

  return (
    <PageTransition>
      <div className="page-shell hover-desaturate-page">
        <div className="page-substack">
          <DetailHero
            artworkUrl={artworkUrl}
            backgroundVariant="plain-black"
            label="ArtistGrid Tracker"
            title={pageTitle}
            body={heroBody}
            meta={heroMeta}
            cornerAction={(
              <Button
                variant="secondary"
                size="icon"
                onClick={() => navigate("/browse/artistgrid")}
                aria-label="Back to ArtistGrid"
                className="h-11 w-11 rounded-full border border-white/12 bg-black/32 text-white/78 backdrop-blur-md hover:bg-white/[0.08] hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
          />

          {error ? (
            <section className={cn("page-panel px-5 py-12 md:px-6", PANEL_SURFACE_CLASS)}>
              <div className="flex flex-col items-center gap-4 text-center">
                <AlertTriangle className="h-8 w-8 text-white/48" />
                <div className="space-y-2">
                  <h2 className="text-2xl font-black tracking-tight text-white">Tracker unavailable</h2>
                  <p className="max-w-xl text-sm leading-6 text-white/60">{error}</p>
                </div>
              </div>
            </section>
          ) : data ? (
            <>
                <DetailActionBar columns={5}>
                  <Button
                    variant="secondary"
                    className={DETAIL_ACTION_BUTTON_CLASS}
                    onClick={() => {
                      if (isCurrentTracker) {
                        togglePlay();
                        return;
                      }

                      void handlePlayVisibleLeak("first");
                    }}
                    disabled={visiblePlayableLeaks.length === 0}
                  >
                    {isCurrentTracker && isPlaying ? (
                      <Pause className="hero-action-icon w-4 h-4 mr-2 fill-current" />
                    ) : (
                      <Play className="hero-action-icon w-4 h-4 mr-2 fill-current" />
                    )}
                    <span className="hero-action-label relative z-10">Play</span>
                  </Button>
                  <Button
                    variant="secondary"
                    className={DETAIL_ACTION_BUTTON_CLASS}
                    onClick={() => void handlePlayVisibleLeak("shuffle")}
                    disabled={visiblePlayableLeaks.length === 0}
                  >
                    <Shuffle className="hero-action-icon w-4 h-4 mr-2" />
                    <span className="hero-action-label relative z-10">Shuffle</span>
                  </Button>
                  <Button
                    variant="secondary"
                    className={DETAIL_ACTION_BUTTON_CLASS}
                    onClick={() => window.open(sheetUrl, "_blank", "noopener,noreferrer")}
                  >
                    <FileSpreadsheet className="hero-action-icon w-4 h-4 mr-2" />
                    <span className="hero-action-label relative z-10">Open Sheet</span>
                  </Button>
                  <Button
                    variant="secondary"
                    className={DETAIL_ACTION_BUTTON_CLASS}
                    onClick={() => window.open(sourceTrackerUrl, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="hero-action-icon w-4 h-4 mr-2" />
                    <span className="hero-action-label relative z-10">Open Original</span>
                  </Button>
                  <Button
                    variant="secondary"
                    className={DETAIL_ACTION_BUTTON_CLASS}
                    onClick={() => void handleShareTracker()}
                  >
                    <Share className="hero-action-icon w-4 h-4 mr-2" />
                    <span className="hero-action-label relative z-10">Share</span>
                  </Button>
                </DetailActionBar>

                <section className={cn("page-panel overflow-hidden", PANEL_SURFACE_CLASS)}>
                  <div className="border-b border-white/10 px-4 py-4 md:px-6">
                    <div className="hide-scrollbar flex gap-2 overflow-x-auto">
                      {data.tabs.map((tab) => {
                        const active = tab === currentTab;
                        return (
                          <button
                            key={tab}
                            type="button"
                            onClick={() => handleSelectTab(tab)}
                            className={cn(
                              "menu-sweep-hover inline-flex h-11 shrink-0 items-center justify-center rounded-full border px-4 text-xs font-semibold uppercase tracking-[0.14em] transition-colors",
                              active
                                ? "border-[hsl(var(--player-waveform))] bg-[hsl(var(--player-waveform))] text-black"
                                : "border-white/10 bg-white/[0.03] text-white/68 hover:text-black",
                            )}
                          >
                            {tab}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-col gap-4 px-4 py-4 md:px-6 md:py-5 xl:flex-row xl:items-center xl:justify-between">
                    <div className="relative max-w-xl flex-1">
                      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/38" />
                      <Input
                        value={searchQuery}
                        onChange={(event) => setSearchQuery(event.target.value)}
                        placeholder={`Search ${pageTitle} entries...`}
                        className="h-12 border-white/10 bg-white/[0.04] pl-11 pr-12 text-white placeholder:text-white/36"
                      />
                      {searchQuery ? (
                        <button
                          type="button"
                          onClick={() => setSearchQuery("")}
                          className="menu-sweep-hover absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/8 hover:text-white"
                          aria-label="Clear search"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>

                    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm text-white/46">
                      <span>{filteredEras.length} eras visible</span>
                      <span>{visiblePlayableLeaks.length} playable entries</span>
                    </div>
                  </div>
                </section>

                <section className="page-substack">
                  {filteredEras.length > 0 ? (
                    filteredEras.map(([eraKey, era]) => (
                      <section key={eraKey} className={cn("page-panel overflow-hidden", PANEL_SURFACE_CLASS)}>
                        <div className="border-b border-white/8 bg-white/[0.015] px-5 py-5 md:px-6">
                          <div className="flex flex-col gap-3">
                            <div className="max-w-3xl">
                              <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/38">
                                <span
                                  className="h-2.5 w-2.5 rounded-full border border-white/10"
                                  style={era.backgroundColor ? { backgroundColor: era.backgroundColor } : undefined}
                                />
                                <span>{currentTab || "Tracker"}</span>
                                {era.extra ? <span className="text-white/28">/</span> : null}
                                {era.extra ? <span>{era.extra}</span> : null}
                              </div>
                              <h2 className="mt-2 text-[1.85rem] font-black tracking-tight text-white md:text-[2.15rem]">
                                {era.name}
                              </h2>
                              {(() => {
                                const eraSummary = [era.timeline, era.description].filter(Boolean).join(" ");
                                const isExpanded = Boolean(expandedEraDescriptions[eraKey]);
                                const canExpand = eraSummary.length > 220;

                                if (!eraSummary) return null;

                                return (
                                  <div className="mt-3 max-w-2xl">
                                    <p
                                      className={cn(
                                        "text-sm leading-6 text-white/56",
                                        !isExpanded && canExpand && "line-clamp-2",
                                      )}
                                    >
                                      {eraSummary}
                                    </p>
                                    {canExpand ? (
                                      <button
                                        type="button"
                                        className="mt-2 text-sm font-semibold text-white/62 transition-colors hover:text-white"
                                        onClick={() => setExpandedEraDescriptions((current) => ({
                                          ...current,
                                          [eraKey]: !current[eraKey],
                                        }))}
                                      >
                                        {isExpanded ? "Show less" : "See more"}
                                      </button>
                                    ) : null}
                                  </div>
                                );
                              })()}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-6 px-4 py-4 md:px-6 md:py-5">
                          {Object.entries(era.data || {}).map(([groupName, leaks]) => (
                            <div key={`${eraKey}-${groupName}`} className="space-y-3">
                              <div className="flex items-center justify-between gap-3">
                                <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-white/42">{groupName}</h3>
                                <p className="text-xs uppercase tracking-[0.16em] text-white/30">{leaks.length} entries</p>
                              </div>

                              <div className="overflow-hidden rounded-[var(--surface-radius-md)] border border-white/10 bg-white/[0.02]">
                                {leaks.map((leak, index) => {
                                  const primaryUrl = getPrimaryLeakUrl(leak);
                                  const resolvedPrimaryPlayableUrl = primaryUrl ? resolvedPlayableUrls.get(primaryUrl) : undefined;
                                  const leakPlayable = canResolveArtistGridPlayableUrl(leak);
                                  const isCurrentLeak = Boolean(
                                    currentTrack
                                      && primaryUrl
                                      && resolvedPrimaryPlayableUrl
                                      && isSameTrack(currentTrack, createPlayableTrack(leak, era, primaryUrl, resolvedPrimaryPlayableUrl)),
                                  );
                                  const leakTrack: Track = resolvedPrimaryPlayableUrl && primaryUrl
                                    ? createPlayableTrack(leak, era, primaryUrl, resolvedPrimaryPlayableUrl)
                                    : createArtistGridTrack({
                                        leak,
                                        era,
                                        fallbackKey: `${sheetId}:${eraKey}:${groupName}:${leak.name}:${index}`,
                                        isUnavailable: !leakPlayable,
                                        sourceUrl: primaryUrl,
                                      });
                                  const contextMenuTrack = resolvedPrimaryPlayableUrl && primaryUrl
                                    ? leakTrack
                                    : { ...leakTrack, isUnavailable: true };
                                  const titleBadges = [leak.type, leak.quality, leak.available_length].filter(Boolean).slice(0, 2);
                                  const rowSubtitle = leak.extra && leak.extra !== groupName ? leak.extra : groupName;
                                  const rowDescription = leak.description && leak.description !== rowSubtitle
                                    ? leak.description
                                    : null;

                                  return (
                                    <div
                                      key={`${eraKey}-${groupName}-${leak.name}-${index}`}
                                      className={cn(index > 0 && "border-t border-white/8")}
                                    >
                                      <TrackContextMenu track={contextMenuTrack} tracks={playableQueue}>
                                        <TrackListRow
                                          actionSlotLayout="double"
                                          className={cn("!min-h-[68px] py-2.5", !isCurrentLeak && "bg-transparent")}
                                          desktopMeta={(
                                            <div
                                              className={cn(
                                                "truncate text-sm",
                                                isCurrentLeak
                                                  ? "text-black"
                                                  : "text-white/46 transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground))]",
                                              )}
                                            >
                                              {leak.leak_date || leak.file_date || groupName}
                                            </div>
                                          )}
                                          disabled={!leakPlayable}
                                          disabledLabel="Unavailable"
                                          index={index}
                                          isCurrent={isCurrentLeak}
                                          isLiked={leakPlayable && isLiked(leakTrack.id)}
                                          isPlaying={isCurrentLeak && isPlaying}
                                          middleContent={(
                                            rowDescription ? (
                                              <span
                                                className={cn(
                                                  "block truncate text-sm",
                                                  isCurrentLeak
                                                    ? "text-black/78"
                                                    : "text-white/52 transition-colors duration-200 group-hover:text-[hsl(var(--dynamic-accent-foreground))]",
                                                )}
                                                title={rowDescription}
                                              >
                                                {rowDescription}
                                              </span>
                                            ) : null
                                          )}
                                          onPlay={() => {
                                            if (leakPlayable) {
                                              void handlePlayLeak(leak, era);
                                              return;
                                            }

                                            if (primaryUrl) {
                                              window.open(primaryUrl, "_blank", "noopener,noreferrer");
                                            }
                                          }}
                                          subtitle={(
                                            <span className={cn(isCurrentLeak ? "text-black/82" : "text-white/56")}>
                                              {rowSubtitle}
                                            </span>
                                          )}
                                          title={(
                                            <div className="flex min-w-0 flex-wrap items-center gap-2">
                                              <span className="truncate">{leak.name || "Unknown Track"}</span>
                                              {titleBadges.map((item) => (
                                                <span
                                                  key={`${leak.name}-${item}`}
                                                  className={cn(
                                                    "rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.16em]",
                                                    isCurrentLeak
                                                      ? "border-black/15 bg-black/10 text-black/72"
                                                      : "border-white/8 text-white/40",
                                                  )}
                                                >
                                                  {item}
                                                </span>
                                              ))}
                                            </div>
                                          )}
                                          onToggleLike={leakPlayable ? () => toggleLike(leakTrack) : undefined}
                                          track={leakTrack}
                                          actionSlot={(
                                            <>
                                              {leakPlayable ? (
                                                <button
                                                  type="button"
                                                  aria-label={`Queue ${leak.name || "track"}`}
                                                  className={cn(
                                                    "inline-flex h-8 w-8 items-center justify-center rounded-[var(--control-radius)] transition-colors",
                                                    isCurrentLeak
                                                      ? "text-black/78 hover:bg-black/10 hover:text-black"
                                                      : "text-white/66 hover:bg-white/10 hover:text-white",
                                                  )}
                                                  onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    void handleQueueLeak(leak, era);
                                                  }}
                                                >
                                                  <Plus className="h-4 w-4" />
                                                </button>
                                              ) : null}
                                              {primaryUrl ? (
                                                <button
                                                  type="button"
                                                  aria-label={`Open source for ${leak.name || "track"}`}
                                                  className={cn(
                                                    "inline-flex h-8 w-8 items-center justify-center rounded-[var(--control-radius)] transition-colors",
                                                    isCurrentLeak
                                                      ? "text-black/78 hover:bg-black/10 hover:text-black"
                                                      : "text-white/66 hover:bg-white/10 hover:text-white",
                                                  )}
                                                  onClick={(event) => {
                                                    event.preventDefault();
                                                    event.stopPropagation();
                                                    window.open(primaryUrl, "_blank", "noopener,noreferrer");
                                                  }}
                                                >
                                                  <ArrowUpRight className="h-4 w-4" />
                                                </button>
                                              ) : null}
                                            </>
                                          )}
                                        />
                                      </TrackContextMenu>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    ))
                  ) : (
                    <section className={cn("page-panel px-5 py-12 md:px-6", PANEL_SURFACE_CLASS)}>
                      <div className="flex flex-col items-center gap-4 text-center">
                        <Search className="h-6 w-6 text-white/36" />
                        <div className="space-y-2">
                          <h2 className="text-2xl font-black tracking-tight text-white">No entries matched</h2>
                          <p className="max-w-xl text-sm leading-6 text-white/60">Try a looser query or switch to another tracker tab.</p>
                        </div>
                      </div>
                    </section>
                  )}
                </section>
            </>
          ) : null}
        </div>
      </div>
    </PageTransition>
  );
}
