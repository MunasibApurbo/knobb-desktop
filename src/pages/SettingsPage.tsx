import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowDown, ArrowUp, Check, ChevronRight, LogOut, RefreshCw } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { usePlayer, AudioQuality } from "@/contexts/PlayerContext";
import { useSettings } from "@/contexts/SettingsContext";
import { EQ_BANDS } from "@/lib/audioEngine";
import { API_INSTANCE_POOL, STREAMING_INSTANCE_POOL } from "@/lib/monochromeApi";

const QUALITY_OPTIONS: { value: AudioQuality; label: string; desc: string; badge?: string }[] = [
  { value: "LOW", label: "Low", desc: "96 kbps · AAC" },
  { value: "MEDIUM", label: "Normal", desc: "160 kbps · AAC" },
  { value: "HIGH", label: "High", desc: "320 kbps · AAC" },
  { value: "LOSSLESS", label: "HiFi / Lossless", desc: "16-bit, 44.1 kHz · FLAC", badge: "MASTER" },
];

const THEMES = [
  { id: "default", name: "Default Dark", preview: "linear-gradient(135deg, #1a1a2e, #16213e)" },
  { id: "midnight", name: "Midnight Blue", preview: "linear-gradient(135deg, #0f0c29, #302b63)" },
  { id: "forest", name: "Forest", preview: "linear-gradient(135deg, #0b3d0b, #1a472a)" },
  { id: "crimson", name: "Crimson", preview: "linear-gradient(135deg, #2d0a0a, #4a1a1a)" },
  { id: "ocean", name: "Ocean", preview: "linear-gradient(135deg, #0a192f, #172a45)" },
  { id: "amber", name: "Warm Amber", preview: "linear-gradient(135deg, #2d1f0e, #3d2b14)" },
  { id: "monochrome", name: "Monochrome", preview: "linear-gradient(135deg, #111, #222)" },
  { id: "amoled", name: "AMOLED Black", preview: "linear-gradient(135deg, #000, #0a0a0a)" },
] as const;

const FONTS = ["System Default", "Inter", "Roboto", "Outfit", "JetBrains Mono", "Poppins", "Nunito"] as const;
const PLAYBACK_SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;
const INSTANCE_VERSIONS: Record<string, string> = {
  "https://us-west.monochrome.tf": "v2.5",
  "https://eu-central.monochrome.tf": "v2.5",
  "https://api.monochrome.tf": "v2.5",
  "https://arran.monochrome.tf": "v2.4",
  "https://triton.squid.wtf": "v2.4",
  "https://monochrome-api.samidy.com": "v2.3",
  "https://wolf.qqdl.site": "v2.2",
  "https://maus.qqdl.site": "v2.2",
  "https://vogel.qqdl.site": "v2.2",
  "https://katze.qqdl.site": "v2.2",
  "https://hund.qqdl.site": "v2.2",
  "https://tidal.kinoplus.online": "v2.2",
};

const EQ_PRESETS: Record<string, number[]> = {
  Flat: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  "Bass Attack": [6, 5, 4, 2, 0, -1, -2, -2, -1, 0],
  "Vocal Lift": [-2, -1, 0, 2, 4, 5, 4, 2, 1, 0],
  "Night Drive": [4, 3, 1, -1, -2, 0, 2, 3, 2, 1],
  Air: [-3, -2, -1, 0, 1, 2, 3, 5, 6, 6],
  Hyper: [5, 2, -1, -2, 3, 5, 1, -1, 4, 6],
};

function useStoredBoolean(key: string, defaultValue: boolean) {
  const [value, setValue] = useState(() => {
    const stored = localStorage.getItem(key);
    if (stored === null) return defaultValue;
    return stored === "true";
  });

  const setAndStore = (next: boolean) => {
    setValue(next);
    localStorage.setItem(key, String(next));
  };

  return [value, setAndStore] as const;
}

function useStoredString(key: string, defaultValue: string) {
  const [value, setValue] = useState(() => localStorage.getItem(key) || defaultValue);

  const setAndStore = (next: string) => {
    setValue(next);
    localStorage.setItem(key, next);
  };

  return [value, setAndStore] as const;
}

function useStoredInstanceOrder(key: string, defaults: readonly string[]) {
  const [order, setOrder] = useState<string[]>(() => {
    const raw = localStorage.getItem(key);
    if (!raw) return [...defaults];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [...defaults];
      const cleaned = parsed
        .filter((entry): entry is string => typeof entry === "string")
        .filter((entry) => defaults.includes(entry as any));
      const remaining = defaults.filter((entry) => !cleaned.includes(entry));
      return [...cleaned, ...remaining];
    } catch {
      return [...defaults];
    }
  });

  const setAndStore = (next: string[]) => {
    setOrder(next);
    localStorage.setItem(key, JSON.stringify(next));
  };

  return [order, setAndStore] as const;
}

function Toggle({ on, onToggle, disabled = false }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      onClick={onToggle}
      disabled={disabled}
      className={`relative w-[56px] h-[32px]  transition-all duration-200 ${disabled ? "opacity-45 cursor-not-allowed" : ""
        } ${on ? "bg-[#e6cfa6]" : "bg-white/12"}`}
    >
      <motion.div
        className={`absolute top-[4px] w-6 h-6  shadow-md ${on ? "bg-black" : "bg-white"}`}
        animate={{ left: on ? 28 : 4 }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />
    </button>
  );
}

function Group({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <div className="mb-4 px-1">
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h2>
        {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
      </div>
      <div className="bg-white/[0.02] border border-white/5">{children}</div>
    </section>
  );
}

function Row({
  label,
  description,
  action,
  onClick,
}: {
  label: string;
  description?: string;
  action?: React.ReactNode;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      onClick={onClick}
      className={`flex items-center justify-between gap-4 w-full px-4 py-4 ${onClick ? "hover:bg-white/[0.04]" : ""}`}
    >
      <div className="min-w-0 text-left">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground mt-0.5 leading-tight">{description}</p>}
      </div>
      <div className="shrink-0 flex items-center gap-2">{action}</div>
    </Wrapper>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const { user, signOut } = useAuth();

  const {
    theme,
    setTheme,
    font,
    setFont,
    compactMode,
    setCompactMode,
    animationsEnabled,
    setAnimationsEnabled,
    blurEffects,
    setBlurEffects,
    downloadFormat,
    setDownloadFormat,
    clearCacheAndReset,
  } = useSettings();

  const {
    quality,
    setQuality,
    normalization,
    toggleNormalization,
    crossfadeDuration,
    setCrossfadeDuration,
    playbackSpeed,
    setPlaybackSpeed,
    equalizerEnabled,
    toggleEqualizer,
    eqGains,
    setEqBandGain,
  } = usePlayer();

  const [lastfmConnected, setLastfmConnected] = useStoredBoolean("lastfm-connected", false);
  const [lastfmUsername, setLastfmUsername] = useStoredString("lastfm-username", "");

  const [zippedBulkDownloads, setZippedBulkDownloads] = useStoredBoolean("download-zipped-bulk", true);
  const [downloadLyrics, setDownloadLyrics] = useStoredBoolean("download-lyrics", true);
  const [romajiLyrics, setRomajiLyrics] = useStoredBoolean("download-romaji-lyrics", false);
  const [filenameTemplate, setFilenameTemplate] = useStoredString("download-filename-template", "{trackNumber} - {artist} - {title}");
  const [zipFolderTemplate, setZipFolderTemplate] = useStoredString("download-zip-folder-template", "{albumTitle} - {albumArtist}");
  const [generateM3U, setGenerateM3U] = useStoredBoolean("download-generate-m3u", true);
  const [generateM3U8, setGenerateM3U8] = useStoredBoolean("download-generate-m3u8", true);
  const [generateCUE, setGenerateCUE] = useStoredBoolean("download-generate-cue", true);
  const [generateNFO, setGenerateNFO] = useStoredBoolean("download-generate-nfo", true);
  const [generateJSON, setGenerateJSON] = useStoredBoolean("download-generate-json", true);
  const [relativePaths, setRelativePaths] = useStoredBoolean("download-relative-paths", true);
  const [separateDiscsInZip, setSeparateDiscsInZip] = useStoredBoolean("download-separate-discs", true);
  const [apiInstanceOrder, setApiInstanceOrder] = useStoredInstanceOrder("api-instance-priority", API_INSTANCE_POOL);
  const [streamingInstanceOrder, setStreamingInstanceOrder] = useStoredInstanceOrder("streaming-instance-priority", STREAMING_INSTANCE_POOL);

  const [cacheRefreshTick, setCacheRefreshTick] = useState(0);
  const [isClearing, setIsClearing] = useState(false);

  const activeEqPreset = useMemo(() => {
    const found = Object.entries(EQ_PRESETS).find(([, values]) => values.every((value, index) => value === eqGains[index]));
    return found?.[0] || "Custom";
  }, [eqGains]);

  const cacheEntries = useMemo(() => {
    void cacheRefreshTick;
    const localKeys = Object.keys(localStorage);
    const cacheLikeLocal = localKeys.filter((key) => key.toLowerCase().includes("cache") || key.startsWith("search-") || key.startsWith("api-")).length;
    return cacheLikeLocal + sessionStorage.length;
  }, [cacheRefreshTick]);

  const applyEqPreset = (name: string) => {
    const values = EQ_PRESETS[name];
    if (!values) return;
    values.forEach((value, index) => setEqBandGain(index, value));
    toast.success(`EQ preset: ${name}`);
  };

  const connectLastfm = () => {
    const typed = window.prompt("Last.fm username", lastfmUsername || "");
    if (!typed || !typed.trim()) return;
    setLastfmUsername(typed.trim());
    setLastfmConnected(true);
    toast.success(`Last.fm connected as ${typed.trim()}`);
  };

  const disconnectLastfm = () => {
    setLastfmConnected(false);
    toast.success("Last.fm disconnected");
  };

  const clearCacheOnly = () => {
    const keys = Object.keys(localStorage);
    for (const key of keys) {
      const lower = key.toLowerCase();
      if (lower.includes("cache") || key.startsWith("search-") || key.startsWith("api-")) {
        localStorage.removeItem(key);
      }
    }
    sessionStorage.clear();
    setCacheRefreshTick((prev) => prev + 1);
    toast.success("Cache cleared");
  };

  const moveInstance = (
    list: string[],
    index: number,
    direction: "up" | "down",
    setter: (next: string[]) => void,
  ) => {
    const target = direction === "up" ? index - 1 : index + 1;
    if (target < 0 || target >= list.length) return;
    const next = [...list];
    const [moved] = next.splice(index, 1);
    next.splice(target, 0, moved);
    setter(next);
  };

  return (
    <div className="py-6 pb-32">
      <h1 className="text-2xl font-bold text-foreground mb-6">Settings</h1>

      <Group title="Appearance" description="Visual preferences that are fully applied in-app.">
        <div className="p-4 border-b border-white/5">
          <p className="text-sm font-medium text-foreground mb-3">Theme</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {THEMES.map((item) => (
              <button
                key={item.id}
                onClick={() => setTheme(item.id as any)}
                className={`relative h-16 overflow-hidden transition-all ${theme === item.id
                    ? "ring-2 ring-[hsl(var(--dynamic-accent))] ring-offset-1 ring-offset-background"
                    : "hover:opacity-80"
                  }`}
              >
                <div className="absolute inset-0" style={{ background: item.preview }} />
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1">
                  <span className="text-xs font-semibold text-white/90">{item.name}</span>
                </div>
                {theme === item.id && <Check className="w-3.5 h-3.5 text-[hsl(var(--dynamic-accent))] absolute top-1 right-1" />}
              </button>
            ))}
          </div>
        </div>

        <Row
          label="Font Family"
          description="Choose your preferred app font"
          action={
            <select
              value={font}
              onChange={(event) => setFont(event.target.value as any)}
              className="text-xs bg-white/5 border border-white/10 px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dynamic-accent))]"
            >
              {FONTS.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          }
        />

        <Row
          label="Compact Mode"
          description="Reduce spacing for denser layouts"
          action={<Toggle on={compactMode} onToggle={() => setCompactMode(!compactMode)} />}
        />

        <Row
          label="Animations"
          description="Enable motion and transitions"
          action={<Toggle on={animationsEnabled} onToggle={() => setAnimationsEnabled(!animationsEnabled)} />}
        />

        <Row
          label="Blur Effects"
          description="Enable blurred surfaces where supported"
          action={<Toggle on={blurEffects} onToggle={() => setBlurEffects(!blurEffects)} />}
        />
      </Group>

      <Group title="Audio Playback" description="Playback settings wired directly to the player engine.">
        <div className="p-3 border-b border-white/5 space-y-1">
          {QUALITY_OPTIONS.map((option) => (
            <button
              key={option.value}
              onClick={() => setQuality(option.value)}
              className={`w-full flex items-center justify-between px-4 py-3 transition-all ${quality === option.value
                  ? "bg-[hsl(var(--dynamic-accent)/0.1)] ring-1 ring-[hsl(var(--dynamic-accent)/0.3)]"
                  : "hover:bg-white/[0.04]"
                }`}
            >
              <div className="text-left">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-semibold ${quality === option.value ? "text-[hsl(var(--dynamic-accent))]" : "text-foreground"}`}>
                    {option.label}
                  </span>
                  {option.badge && (
                    <span className="px-1.5 py-0.5 text-xs font-black bg-yellow-500 text-black rounded-[2px] leading-none uppercase tracking-tighter">
                      {option.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs text-muted-foreground">{option.desc}</span>
              </div>
              {quality === option.value && <Check className="w-5 h-5 text-[hsl(var(--dynamic-accent))]" />}
            </button>
          ))}
        </div>

        <Row
          label="Normalize Volume"
          description="Balance loud and quiet tracks"
          action={<Toggle on={normalization} onToggle={toggleNormalization} />}
        />

        <Row
          label="Playback Speed"
          description="Change playback rate"
          action={
            <select
              value={playbackSpeed}
              onChange={(event) => setPlaybackSpeed(Number(event.target.value))}
              className="text-xs bg-white/5 border border-white/10 px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dynamic-accent))]"
            >
              {PLAYBACK_SPEEDS.map((speed) => (
                <option key={speed} value={speed}>
                  {speed}x
                </option>
              ))}
            </select>
          }
        />

        <Row
          label="Crossfade"
          description="Blend between tracks"
          action={
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="12"
                step="1"
                value={crossfadeDuration}
                onChange={(event) => setCrossfadeDuration(parseInt(event.target.value, 10))}
                className="w-24 accent-[hsl(var(--dynamic-accent))] h-1 bg-white/10  appearance-none [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:"
              />
              <span className="text-xs text-muted-foreground font-medium w-8 text-right">
                {crossfadeDuration > 0 ? `${crossfadeDuration}s` : "Off"}
              </span>
            </div>
          }
        />
      </Group>

      <Group title="Equalizer" description="Edge-tuned 10-band EQ with presets and live neon response.">
        <Row
          label="Enable Equalizer"
          description={`Current preset: ${activeEqPreset}`}
          action={<Toggle on={equalizerEnabled} onToggle={toggleEqualizer} />}
        />

        {equalizerEnabled && (
          <div className="border-t border-white/5 p-4 sm:p-6 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0))]">
            <div className="flex flex-wrap gap-2 mb-5">
              {Object.keys(EQ_PRESETS).map((name) => (
                <button
                  key={name}
                  onClick={() => applyEqPreset(name)}
                  className={`px-3 py-1.5 text-xs font-semibold border transition-all ${activeEqPreset === name
                      ? "border-[hsl(var(--dynamic-accent))] text-[hsl(var(--dynamic-accent))] bg-[hsl(var(--dynamic-accent)/0.12)]"
                      : "border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
                    }`}
                >
                  {name}
                </button>
              ))}
              <button
                onClick={() => applyEqPreset("Flat")}
                className="px-3 py-1.5 text-xs font-semibold border border-white/10 text-muted-foreground hover:text-foreground hover:border-white/20"
              >
                Reset
              </button>
            </div>

            <div className="grid grid-cols-10 gap-2 sm:gap-3">
              {EQ_BANDS.map((frequency, index) => (
                <div key={frequency} className=" border border-white/10 bg-black/30 p-2">
                  <div className="text-center mb-2">
                    <p className="text-[10px] text-muted-foreground/90 font-semibold">
                      {frequency >= 1000 ? `${frequency / 1000}k` : frequency}
                    </p>
                    <p className="text-[10px] font-bold text-foreground/90 mt-0.5">
                      {eqGains[index] > 0 ? "+" : ""}
                      {eqGains[index]}
                    </p>
                  </div>

                  <div className="relative h-[150px] flex items-center justify-center">
                    <div className="absolute h-[130px] w-2  bg-white/10 overflow-hidden">
                      <div
                        className="absolute bottom-0 left-0 right-0  bg-[linear-gradient(180deg,hsl(var(--dynamic-accent)),hsl(var(--dynamic-accent)/0.35))] shadow-[0_0_18px_hsl(var(--dynamic-accent)/0.45)]"
                        style={{ height: `${((eqGains[index] + 12) / 24) * 100}%` }}
                      />
                    </div>

                    <input
                      type="range"
                      min="-12"
                      max="12"
                      step="1"
                      value={eqGains[index]}
                      onChange={(event) => setEqBandGain(index, parseInt(event.target.value, 10))}
                      className="absolute inset-0 opacity-0 cursor-ns-resize"
                      style={{ WebkitAppearance: "slider-vertical" } as { WebkitAppearance: "slider-vertical" }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Group>

      <Group title="Downloads & Export" description="Persistent download/export preferences.">
        <Row
          label="Format"
          description="Audio format for downloads"
          action={
            <select
              value={downloadFormat}
              onChange={(event) => setDownloadFormat(event.target.value)}
              className="text-xs bg-white/5 border border-white/10 px-2.5 py-1.5 text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dynamic-accent))]"
            >
              <option value="flac">FLAC</option>
              <option value="alac">ALAC</option>
              <option value="aac">AAC</option>
              <option value="mp3">MP3</option>
              <option value="ogg">OGG</option>
            </select>
          }
        />

        <Row
          label="Zipped Bulk Downloads"
          description="Download multiple tracks as one ZIP"
          action={<Toggle on={zippedBulkDownloads} onToggle={() => setZippedBulkDownloads(!zippedBulkDownloads)} />}
        />

        <Row
          label="Download Lyrics"
          description="Include lyric files in track downloads"
          action={<Toggle on={downloadLyrics} onToggle={() => setDownloadLyrics(!downloadLyrics)} />}
        />

        <Row
          label="Romaji Lyrics"
          description="Convert Japanese lyrics to Romaji"
          action={
            <Toggle
              on={romajiLyrics}
              onToggle={() => setRomajiLyrics(!romajiLyrics)}
              disabled={!downloadLyrics}
            />
          }
        />

        <div className="px-4 py-4 border-t border-white/5">
          <label className="text-sm font-medium text-foreground block mb-1">Filename Template</label>
          <p className="text-xs text-muted-foreground mb-2">Available: {'{trackNumber}'}, {'{artist}'}, {'{title}'}, {'{album}'}, {'{year}'}</p>
          <input
            type="text"
            value={filenameTemplate}
            onChange={(event) => setFilenameTemplate(event.target.value)}
            className="w-full text-sm bg-white/6 border border-white/10 px-4 py-3 text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dynamic-accent))]"
          />
        </div>

        <div className="px-4 py-4 border-t border-white/5">
          <label className="text-sm font-medium text-foreground block mb-1">ZIP Folder Template</label>
          <p className="text-xs text-muted-foreground mb-2">Available: {'{albumTitle}'}, {'{albumArtist}'}, {'{year}'}</p>
          <input
            type="text"
            value={zipFolderTemplate}
            onChange={(event) => setZipFolderTemplate(event.target.value)}
            className="w-full text-sm bg-white/6 border border-white/10 px-4 py-3 text-foreground focus:outline-none focus:ring-1 focus:ring-[hsl(var(--dynamic-accent))]"
          />
        </div>

        <Row
          label="Generate M3U"
          description="Create M3U playlists with downloads"
          action={<Toggle on={generateM3U} onToggle={() => setGenerateM3U(!generateM3U)} />}
        />

        <Row
          label="Generate M3U8"
          description="Create UTF-8 M3U8 playlists"
          action={<Toggle on={generateM3U8} onToggle={() => setGenerateM3U8(!generateM3U8)} />}
        />

        <Row
          label="Generate CUE"
          description="Create CUE sheets for gapless sets"
          action={<Toggle on={generateCUE} onToggle={() => setGenerateCUE(!generateCUE)} />}
        />

        <Row
          label="Generate NFO"
          description="Create NFO metadata files"
          action={<Toggle on={generateNFO} onToggle={() => setGenerateNFO(!generateNFO)} />}
        />

        <Row
          label="Generate JSON"
          description="Create rich JSON metadata files"
          action={<Toggle on={generateJSON} onToggle={() => setGenerateJSON(!generateJSON)} />}
        />

        <Row
          label="Relative Paths"
          description="Use relative paths in generated playlists"
          action={<Toggle on={relativePaths} onToggle={() => setRelativePaths(!relativePaths)} />}
        />

        <Row
          label="Separate Discs in ZIP"
          description="Split tracks into disc folders when applicable"
          action={<Toggle on={separateDiscsInZip} onToggle={() => setSeparateDiscsInZip(!separateDiscsInZip)} />}
        />
      </Group>

      <Group title="API Instances" description="All metadata/search API backends in priority order.">
        <div className="p-3 space-y-2">
          {apiInstanceOrder.map((instance, index) => (
            <div key={instance} className="flex items-center justify-between  border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{instance}</p>
                <p className="text-xs text-muted-foreground">{INSTANCE_VERSIONS[instance] || "v2.x"}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveInstance(apiInstanceOrder, index, "up", setApiInstanceOrder)}
                  className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={index === 0}
                  aria-label={`Move ${instance} up`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveInstance(apiInstanceOrder, index, "down", setApiInstanceOrder)}
                  className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={index === apiInstanceOrder.length - 1}
                  aria-label={`Move ${instance} down`}
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Streaming Instances" description="All stream providers used for track playback fallback.">
        <div className="p-3 space-y-2">
          {streamingInstanceOrder.map((instance, index) => (
            <div key={instance} className="flex items-center justify-between  border border-white/10 bg-white/[0.02] px-4 py-3">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{instance}</p>
                <p className="text-xs text-muted-foreground">{INSTANCE_VERSIONS[instance] || "v2.x"}</p>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => moveInstance(streamingInstanceOrder, index, "up", setStreamingInstanceOrder)}
                  className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={index === 0}
                  aria-label={`Move ${instance} up`}
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <button
                  onClick={() => moveInstance(streamingInstanceOrder, index, "down", setStreamingInstanceOrder)}
                  className="w-8 h-8 flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30"
                  disabled={index === streamingInstanceOrder.length - 1}
                  aria-label={`Move ${instance} down`}
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </Group>

      <Group title="Scrobbling" description="Connected music tracking accounts.">
        <Row
          label="Last.fm Scrobbling"
          description={lastfmConnected ? `Connected as ${lastfmUsername || "user"}` : "Not connected"}
          action={
            lastfmConnected ? (
              <Button
                variant="destructive"
                size="sm"
                className="h-9 px-4"
                onClick={(event) => {
                  event.stopPropagation();
                  disconnectLastfm();
                }}
              >
                Disconnect
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                className="h-9 px-4"
                onClick={(event) => {
                  event.stopPropagation();
                  connectLastfm();
                }}
              >
                Connect
              </Button>
            )
          }
        />
      </Group>

      <Group title="System" description="Utilities and maintenance tools.">
        <Row
          label="Keyboard Shortcuts"
          description="View and customize keyboard shortcuts"
          action={
            <Button
              variant="secondary"
              size="sm"
              className="h-9 px-4"
              onClick={(event) => {
                event.stopPropagation();
                toast.info("Shortcuts: Space play/pause, Shift+Arrows next/prev/volume, M mute");
              }}
            >
              Customize
            </Button>
          }
        />

        <Row
          label="Cache"
          description={`Cache: ${cacheEntries}/200 entries`}
          action={
            <Button
              variant="secondary"
              size="sm"
              className="h-9 px-4"
              onClick={(event) => {
                event.stopPropagation();
                clearCacheOnly();
              }}
            >
              Clear Cache
            </Button>
          }
        />

        {user ? (
          <>
            <Row
              label={user.email || "Signed in"}
              description="Your account is connected"
              action={<span className="px-2 py-0.5 text-xs font-bold uppercase bg-[hsl(var(--dynamic-accent)/0.15)] text-[hsl(var(--dynamic-accent))]">Active</span>}
            />
            <Row
              label="Sign out"
              description="Log out of your account"
              onClick={() => {
                signOut();
                toast.success("Signed out");
              }}
              action={<LogOut className="w-4 h-4 text-muted-foreground" />}
            />
          </>
        ) : (
          <Row
            label="Sign in"
            description="Connect your account"
            onClick={() => navigate("/auth")}
            action={<ChevronRight className="w-4 h-4 text-muted-foreground" />}
          />
        )}

        <Row
          label="Factory Reset"
          description="Clears all local settings and reloads"
          action={
            <Button
              variant="outline"
              size="sm"
              className="h-9 px-4"
              onClick={(event) => {
                event.stopPropagation();
                setIsClearing(true);
                clearCacheAndReset();
              }}
              disabled={isClearing}
            >
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isClearing ? "animate-spin" : ""}`} />
              Reset
            </Button>
          }
        />
      </Group>
    </div>
  );
}
