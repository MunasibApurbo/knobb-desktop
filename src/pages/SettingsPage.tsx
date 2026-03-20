import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircle2, ExternalLink, HelpCircle, Loader2, Search, Shield } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { DiscordConnectDialog } from "@/components/DiscordConnectDialog";
import { VolumeBar } from "@/components/VolumeBar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { PANEL_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import { SettingsEqualizer } from "@/components/SettingsEqualizer";
import { Switch } from "@/components/ui/switch";
import { PageTransition } from "@/components/PageTransition";
import { UtilityPageLayout, UtilityPagePanel } from "@/components/UtilityPageLayout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLanguage } from "@/contexts/LanguageContext";
import { useLocalFiles } from "@/contexts/LocalFilesContext";
import { usePlayer } from "@/contexts/PlayerContext";
import { AudioQuality } from "@/contexts/player/playerTypes";
import { DownloadFormat, useSettings } from "@/contexts/SettingsContext";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { subscribeToDiscordPresenceBridge } from "@/lib/discordPresence";
import { type AudioQualityOption, getAudioQualityOptions } from "@/lib/audioQuality";
import {
  clearDiscordWebhookPresence,
  getDiscordWebhookUrl,
  isDiscordWebhookEnabled,
  setDiscordWebhookEnabled as persistDiscordWebhookEnabled,
  setDiscordWebhookUrl as persistDiscordWebhookUrl,
  validateDiscordWebhook,
} from "@/lib/discordWebhookPresence";
import {
  getListenBrainzToken,
  isListenBrainzEnabled,
  setListenBrainzEnabled as persistListenBrainzEnabled,
  setListenBrainzToken as persistListenBrainzToken,
  validateListenBrainzToken,
} from "@/lib/externalScrobbling";
import { getLocalDiscordPresenceBridgeStatus } from "@/lib/localDiscordPresenceBridge";
import { clearMusicApiCache } from "@/lib/musicApi";
import {
  getPlaybackDeviceId,
  listPlaybackSessions,
  removeOtherPlaybackSessions,
  type PlaybackSessionSnapshot,
} from "@/lib/playbackSessions";
import { cn } from "@/lib/utils";
import { DESTRUCTIVE_OUTLINE_BUTTON_CLASS } from "@/components/ui/surfaceStyles";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function normalizeSearchValue(value: string) {
  return value.trim().toLowerCase();
}

type BrowserStorageSnapshot = {
  usageBytes: number | null;
  quotaBytes: number | null;
  persisted: boolean | null;
  cacheBytes: number | null;
  persistenceSupported: boolean;
};

function getStorageUsageDetail(
  estimate: (StorageEstimate & { usageDetails?: Record<string, number | undefined> }) | null,
  key: string,
) {
  const value = estimate?.usageDetails?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function matchesSearchQuery(query: string, ...values: Array<string | number | null | undefined>) {
  if (!query) return true;
  return values.some((value) => normalizeSearchValue(String(value ?? "")).includes(query));
}

function getAuthProviders(appMetadata: { provider?: unknown; providers?: unknown } | undefined) {
  const providers = Array.isArray(appMetadata?.providers)
    ? appMetadata.providers.filter((provider): provider is string => typeof provider === "string")
    : [];

  if (providers.length > 0) {
    return providers.map((provider) => provider.trim().toLowerCase()).filter(Boolean);
  }

  const fallbackProvider = appMetadata?.provider;
  return typeof fallbackProvider === "string" && fallbackProvider.trim()
    ? [fallbackProvider.trim().toLowerCase()]
    : [];
}

function requiresPasswordForDeletion(appMetadata: { provider?: unknown; providers?: unknown } | undefined) {
  const providers = getAuthProviders(appMetadata);
  return providers.length === 0 || providers.includes("email");
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-2">
      <h2 className="px-1 py-1 text-xl font-bold text-foreground">{title}</h2>
      <UtilityPagePanel
        className={cn(
          "overflow-hidden",
        )}
      >
        {children}
      </UtilityPagePanel>
    </section>
  );
}

function Row({
  title,
  description,
  action,
  className = "",
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`settings-row flex flex-col gap-4 border-b border-white/10 px-4 py-4 transition-colors last:border-b-0 sm:px-5 lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center ${className}`}
    >
      <div className="min-w-0">
        <p className="text-base font-semibold text-foreground">{title}</p>
        {description ? <div className="mt-1 text-sm text-muted-foreground">{description}</div> : null}
      </div>
      {action ? <div className="w-full shrink-0 lg:w-auto">{action}</div> : null}
    </div>
  );
}

function SelectControl({
  value,
  onChange,
  options,
  className = "",
}: {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string; tag?: string }[];
  className?: string;
}) {
  const selectedOption = options.find((option) => option.value === value);
  const selectedLabel = selectedOption?.label ?? value;
  const selectedTag = selectedOption?.tag;

  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger
        className={`settings-select-trigger website-form-control h-11 w-full min-w-0 rounded-[var(--settings-control-radius)] border-white/10 bg-white/[0.04] px-4 text-sm text-foreground focus:ring-0 focus:ring-offset-0 sm:min-w-[220px] ${className}`}
      >
        <SelectValue aria-label={selectedTag ? `${selectedLabel} ${selectedTag}` : selectedLabel}>
          <span className="flex min-w-0 items-center gap-3">
            <span className="truncate">{selectedLabel}</span>
            {selectedTag ? (
              <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.08] px-2 py-0.5 text-[11px] font-medium tracking-[0.02em] text-white/72">
                {selectedTag}
              </span>
            ) : null}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="settings-select-content text-foreground">
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className="text-sm text-foreground focus:bg-white/[0.12] focus:text-foreground"
          >
            <span className="flex min-w-0 items-center justify-between gap-3">
              <span className="truncate">{option.label}</span>
              {option.tag ? (
                <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.06] px-2 py-0.5 text-[11px] font-medium tracking-[0.02em] text-white/68">
                  {option.tag}
                </span>
              ) : null}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function ToggleControl({
  checked,
  onCheckedChange,
  disabled = false,
}: {
  checked: boolean;
  onCheckedChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <Switch
      checked={checked}
      disabled={disabled}
      onCheckedChange={onCheckedChange}
      className="data-[state=checked]:bg-[hsl(var(--dynamic-accent))] data-[state=unchecked]:bg-white/25"
    />
  );
}

function VolumeStyleControl({
  value,
  onChange,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  ariaLabel: string;
}) {
  const normalizedValue = Math.min(Math.max(Math.round(value), 0), 100);

  return (
    <div className="flex w-full items-center gap-3 sm:w-[320px]">
      <div className="flex-1 rounded-full border border-white/10 bg-white/[0.03] px-3 py-2">
        <VolumeBar
          volume={normalizedValue / 100}
          onChange={(nextValue) => onChange(Math.round(nextValue * 100))}
          ariaLabel={ariaLabel}
          ariaValueText={(nextValue) => `${Math.round(nextValue * 100)}%`}
          className="h-3 w-full opacity-95"
          variant="straight"
        />
      </div>
      <div className="flex items-center gap-1 rounded-[var(--settings-control-radius)] border border-white/10 bg-white/[0.04] px-3 py-2 text-sm font-semibold text-white/82">
        <span className="w-9 text-right tabular-nums">{normalizedValue}</span>
        <span className="text-white/56">%</span>
      </div>
    </div>
  );
}

const SETTINGS_ACTION_BUTTON_CLASS =
  "settings-action-button website-form-control menu-sweep-hover h-11 w-full justify-center rounded-[var(--settings-control-radius)] border-white/12 bg-white/[0.03] px-5 text-sm font-semibold text-foreground hover:bg-white/[0.05] hover:text-black focus-visible:text-black focus:ring-0 focus:ring-offset-0 sm:w-auto";
const SETTINGS_DESTRUCTIVE_BUTTON_CLASS =
  `${DESTRUCTIVE_OUTLINE_BUTTON_CLASS} settings-action-button w-full sm:w-auto`;

export default function SettingsPage() {
  const navigate = useNavigate();
  const {
    isAdmin,
    requestPasswordReset,
    signOut,
    signOutOtherSessions,
    user,
  } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const {
    dynamicCardsEnabled,
    setDynamicCardsEnabled,
    font,
    setFont,
    showLocalFiles,
    setShowLocalFiles,
    libraryItemStyle,
    setLibraryItemStyle,
    cardSize,
    setCardSize,
    discordPresenceEnabled,
    setDiscordPresenceEnabled,
    pageDensity,
    setPageDensity,
    rightPanelAutoOpen,
    setRightPanelAutoOpen,
    rightPanelStyle,
    setRightPanelStyle,
    bottomPlayerStyle,
    setBottomPlayerStyle,
    showFullScreenLyrics,
    setShowFullScreenLyrics,
    fullScreenBackgroundBlur,
    setFullScreenBackgroundBlur,
    fullScreenBackgroundDarkness,
    setFullScreenBackgroundDarkness,
    showScrollbar,
    setShowScrollbar,
    downloadFormat,
    setDownloadFormat,
    scrobblePercent,
    setScrobblePercent,
  } = useSettings();
  const { localFiles, totalBytes } = useLocalFiles();
  const {
    autoQualityEnabled,
    setAutoQualityEnabled,
    monoAudioEnabled,
    setMonoAudioEnabled,
    quality,
    setQuality,
    normalization,
    toggleNormalization,
    equalizerEnabled,
    toggleEqualizer,
    eqGains,
    eqPreset,
    setEqBandGain,
    applyEqPreset,
    resetEqualizer,
    preampDb,
    setPreampDb,
    preservePitch,
    setPreservePitch,
  } = usePlayer();

  const [storageVersion, setStorageVersion] = useState(0);
  const [browserStorageSnapshot, setBrowserStorageSnapshot] = useState<BrowserStorageSnapshot>({
    usageBytes: null,
    quotaBytes: null,
    persisted: null,
    cacheBytes: null,
    persistenceSupported: false,
  });
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);
  const [discordConnectOpen, setDiscordConnectOpen] = useState(false);
  const [discordBridgeStatus, setDiscordBridgeStatus] = useState(() => getLocalDiscordPresenceBridgeStatus());
  const [discordWebhookEnabled, setDiscordWebhookEnabledState] = useState(() => isDiscordWebhookEnabled());
  const [discordWebhookInput, setDiscordWebhookInput] = useState(() => getDiscordWebhookUrl());
  const [discordWebhookName, setDiscordWebhookName] = useState<string | null>(null);
  const [isCheckingDiscordWebhook, setIsCheckingDiscordWebhook] = useState(false);
  const [listenBrainzEnabled, setListenBrainzEnabledState] = useState(() => isListenBrainzEnabled());
  const [listenBrainzTokenInput, setListenBrainzTokenInput] = useState(() => getListenBrainzToken());
  const [listenBrainzUserName, setListenBrainzUserName] = useState<string | null>(null);
  const [isCheckingListenBrainz, setIsCheckingListenBrainz] = useState(false);
  const [playbackSessions, setPlaybackSessions] = useState<PlaybackSessionSnapshot[]>([]);
  const [isLoadingPlaybackSessions, setIsLoadingPlaybackSessions] = useState(false);
  const [accountAction, setAccountAction] = useState<"password-reset" | "sign-out-others" | "sign-out" | "delete-account" | null>(null);
  const [settingsSearchQuery, setSettingsSearchQuery] = useState("");
  const [isSettingsSearchOpen, setIsSettingsSearchOpen] = useState(false);
  const [deleteAccountDialogOpen, setDeleteAccountDialogOpen] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const settingsSearchInputRef = useRef<HTMLInputElement | null>(null);
  const discordBridgeReady = discordBridgeStatus.ok;
  const discordBridgeConfigured = discordBridgeStatus.ok && discordBridgeStatus.configured;
  const discordDesktopConnected = discordBridgeStatus.discordConnected;
  const currentPlaybackDeviceId = useMemo(() => getPlaybackDeviceId(), []);

  const qualityOptions = useMemo<AudioQualityOption[]>(
    () => getAudioQualityOptions(language),
    [language],
  );
  const downloadFormatOptions = useMemo<{ value: DownloadFormat; label: string }[]>(() => [
    { value: "flac", label: "FLAC" },
    { value: "mp3_320", label: "MP3 320 kbps" },
    { value: "mp3_128", label: "MP3 128 kbps" },
  ], []);

  const storageSnapshot = useMemo(() => {
    void storageVersion;
    let localStorageBytes = 0;
    let cacheBytes = 0;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key) continue;
      const value = localStorage.getItem(key) || "";
      const entryBytes = (key.length + value.length) * 2;
      localStorageBytes += entryBytes;
      if (
        key.toLowerCase().includes("api-cache")
        || key.toLowerCase().includes("search-cache")
        || key.toLowerCase().includes("image-cache")
      ) {
        cacheBytes += entryBytes;
      }
    }
    return {
      localStorageBytes,
      cacheBytes,
    };
  }, [storageVersion]);
  const isDesktopApp = Boolean(window.knobbDesktop?.isDesktopApp);
  const resolvedStorageUsageBytes = browserStorageSnapshot.usageBytes ?? (storageSnapshot.localStorageBytes + totalBytes);
  const resolvedStorageQuotaBytes = browserStorageSnapshot.quotaBytes;
  const resolvedCacheBytes = browserStorageSnapshot.cacheBytes ?? storageSnapshot.cacheBytes;
  const discordStatusTitle = isDesktopApp ? t("settings.discordNativeStatus") : t("settings.discordConnect");
  const discordWebhookDescription = discordWebhookName
    ? `${t("settings.discordWebhookDescription")} ${t("settings.connectedAs", { name: discordWebhookName })}.`
    : t("settings.discordWebhookDescription");
  const listenBrainzDescription = listenBrainzUserName
    ? `${t("settings.listenBrainzDescription")} ${t("settings.connectedAs", { name: listenBrainzUserName })}.`
    : t("settings.listenBrainzDescription");
  const scrobblePercentLabel = `${Math.min(95, Math.max(5, Number.parseInt(scrobblePercent, 10) || 50))}%`;

  const discordConnectionDescription = useMemo(() => {
    if (isDesktopApp) {
      if (!discordBridgeReady) {
        return t("settings.discordNativeUnavailable");
      }

      if (!discordDesktopConnected) {
        return t("settings.discordAppWaiting");
      }

      return t("settings.discordNativeConnected");
    }

    if (!discordBridgeReady) {
      return t("settings.discordBridgeMissing");
    }

    if (!discordBridgeConfigured) {
      return t("settings.discordBridgeSetupRequired");
    }

    if (!discordDesktopConnected) {
      return t("settings.discordAppWaiting");
    }

    return t("settings.discordAppConnected");
  }, [discordBridgeConfigured, discordBridgeReady, discordDesktopConnected, isDesktopApp, t]);
  const normalizedSettingsSearchQuery = normalizeSearchValue(settingsSearchQuery);
  const hasSettingsSearchQuery = normalizedSettingsSearchQuery.length > 0;
  const showSettingsSearchInput = isSettingsSearchOpen || hasSettingsSearchQuery;
  const deleteAccountNeedsPassword = requiresPasswordForDeletion(user?.app_metadata);
  const deleteAccountSelfServeSupported = deleteAccountNeedsPassword;

  const clearCache = () => {
    clearMusicApiCache();
    Object.keys(localStorage).forEach((key) => {
      const k = key.toLowerCase();
      if (k.includes("api-cache") || k.includes("search-cache") || k.includes("image-cache")) {
        localStorage.removeItem(key);
      }
    });
    if ("caches" in window) {
      void caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))));
    }
    setStorageVersion((prev) => prev + 1);
    toast.success(t("settings.cacheCleared"));
  };

  const refreshBrowserStorage = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.storage?.estimate) {
      setBrowserStorageSnapshot({
        usageBytes: null,
        quotaBytes: null,
        persisted: null,
        cacheBytes: null,
        persistenceSupported: false,
      });
      return;
    }

    try {
      const estimate = await navigator.storage.estimate() as StorageEstimate & {
        usageDetails?: Record<string, number | undefined>;
      };
      const persisted = typeof navigator.storage.persisted === "function"
        ? await navigator.storage.persisted().catch(() => null)
        : null;

      setBrowserStorageSnapshot({
        usageBytes: typeof estimate.usage === "number" ? estimate.usage : null,
        quotaBytes: typeof estimate.quota === "number" ? estimate.quota : null,
        persisted,
        cacheBytes: getStorageUsageDetail(estimate, "caches") ?? getStorageUsageDetail(estimate, "cacheStorage"),
        persistenceSupported: typeof navigator.storage.persist === "function",
      });
    } catch {
      setBrowserStorageSnapshot({
        usageBytes: null,
        quotaBytes: null,
        persisted: null,
        cacheBytes: null,
        persistenceSupported: typeof navigator.storage.persist === "function",
      });
    }
  }, []);

  const requestPersistentStorage = useCallback(async () => {
    if (typeof navigator === "undefined" || typeof navigator.storage?.persist !== "function") {
      toast.info(t("settings.storagePersistenceUnsupported"));
      return;
    }

    try {
      const granted = await navigator.storage.persist();
      await refreshBrowserStorage();
      toast.success(granted ? t("settings.storagePersistenceGranted") : t("settings.storagePersistenceDenied"));
    } catch {
      toast.error(t("settings.storagePersistenceFailed"));
    }
  }, [refreshBrowserStorage, t]);

  const handleDiscordWebhookBlur = useCallback(() => {
    const nextUrl = discordWebhookInput.trim();
    persistDiscordWebhookUrl(nextUrl);

    if (!nextUrl) {
      persistDiscordWebhookEnabled(false);
      setDiscordWebhookEnabledState(false);
      setDiscordWebhookName(null);
      void clearDiscordWebhookPresence();
    }
  }, [discordWebhookInput]);

  const validateDiscordWebhookConnection = useCallback(async (enableOnSuccess: boolean) => {
    const candidate = discordWebhookInput.trim();
    if (!candidate) {
      toast.info(t("settings.discordWebhookUrlRequired"));
      return false;
    }

    if (!user) {
      toast.info(t("settings.discordWebhookSignInRequired"));
      return false;
    }

    setIsCheckingDiscordWebhook(true);
    try {
      const result = await validateDiscordWebhook(candidate);
      persistDiscordWebhookUrl(candidate);
      setDiscordWebhookName(result.name);

      if (enableOnSuccess) {
        persistDiscordWebhookEnabled(true);
        setDiscordWebhookEnabledState(true);
      }

      toast.success(
        result.name
          ? t("settings.connectedAs", { name: result.name })
          : t("settings.discordWebhookConnected"),
      );
      return true;
    } catch (error) {
      persistDiscordWebhookEnabled(false);
      setDiscordWebhookEnabledState(false);
      setDiscordWebhookName(null);
      toast.error(error instanceof Error ? error.message : t("settings.discordWebhookConnectionFailed"));
      return false;
    } finally {
      setIsCheckingDiscordWebhook(false);
    }
  }, [discordWebhookInput, t, user]);

  const handleDiscordWebhookToggle = useCallback((next: boolean) => {
    if (!next) {
      persistDiscordWebhookEnabled(false);
      setDiscordWebhookEnabledState(false);
      void clearDiscordWebhookPresence();
      toast.success(t("settings.discordWebhookDisabled"));
      return;
    }

    void validateDiscordWebhookConnection(true);
  }, [t, validateDiscordWebhookConnection]);

  const handleListenBrainzTokenBlur = useCallback(() => {
    const nextToken = listenBrainzTokenInput.trim();
    persistListenBrainzToken(nextToken);

    if (!nextToken) {
      persistListenBrainzEnabled(false);
      setListenBrainzEnabledState(false);
      setListenBrainzUserName(null);
    }
  }, [listenBrainzTokenInput]);

  const validateListenBrainz = useCallback(async (enableOnSuccess: boolean) => {
    const candidate = listenBrainzTokenInput.trim();
    if (!candidate) {
      toast.info(t("settings.listenBrainzTokenRequired"));
      return false;
    }

    setIsCheckingListenBrainz(true);
    try {
      const result = await validateListenBrainzToken(candidate);

      if (!result.valid) {
        persistListenBrainzEnabled(false);
        setListenBrainzEnabledState(false);
        setListenBrainzUserName(null);
        toast.error(t("settings.listenBrainzInvalidToken"));
        return false;
      }

      persistListenBrainzToken(candidate);
      setListenBrainzUserName(result.userName);

      if (enableOnSuccess) {
        persistListenBrainzEnabled(true);
        setListenBrainzEnabledState(true);
      }

      toast.success(
        result.userName
          ? t("settings.connectedAs", { name: result.userName })
          : t("settings.listenBrainzConnected"),
      );
      return true;
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("settings.listenBrainzConnectionFailed"));
      return false;
    } finally {
      setIsCheckingListenBrainz(false);
    }
  }, [listenBrainzTokenInput, t]);

  const handleListenBrainzToggle = useCallback((next: boolean) => {
    if (!next) {
      persistListenBrainzEnabled(false);
      setListenBrainzEnabledState(false);
      toast.success(t("settings.listenBrainzDisabled"));
      return;
    }

    void validateListenBrainz(true);
  }, [t, validateListenBrainz]);

  useEffect(() => {
    const syncDiscordBridgeStatus = () => {
      setDiscordBridgeStatus(getLocalDiscordPresenceBridgeStatus());
    };

    const unsubscribe = subscribeToDiscordPresenceBridge(syncDiscordBridgeStatus);

    syncDiscordBridgeStatus();
    return unsubscribe;
  }, []);

  useEffect(() => {
    void refreshBrowserStorage();
  }, [localFiles.length, refreshBrowserStorage, serviceWorkerReady, storageVersion, totalBytes]);

  const refreshPlaybackSessions = useCallback(async () => {
    if (!user) {
      setPlaybackSessions([]);
      return;
    }

    setIsLoadingPlaybackSessions(true);
    try {
      const sessions = await listPlaybackSessions(user.id);
      setPlaybackSessions(sessions);
    } catch (error) {
      console.error("Failed to load playback sessions", error);
      setPlaybackSessions([]);
    } finally {
      setIsLoadingPlaybackSessions(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPlaybackSessions([]);
      return;
    }

    void refreshPlaybackSessions();
    const intervalId = window.setInterval(() => {
      void refreshPlaybackSessions();
    }, 15000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [refreshPlaybackSessions, user]);

  const handleSendPasswordReset = async () => {
    if (!user?.email) return;

    setAccountAction("password-reset");
    const { error } = await requestPasswordReset(user.email);
    setAccountAction(null);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success(`Password reset email sent to ${user.email}.`);
  };

  const handleSignOutOtherSessions = async () => {
    if (!user) return;

    setAccountAction("sign-out-others");
    const { error } = await signOutOtherSessions();

    if (!error) {
      try {
        await removeOtherPlaybackSessions(user.id, currentPlaybackDeviceId);
      } catch (cleanupError) {
        console.error("Failed to clear other playback sessions", cleanupError);
      }
    }

    setAccountAction(null);

    if (error) {
      toast.error(error);
      return;
    }

    toast.success("Signed out your other sessions.");
    await refreshPlaybackSessions();
  };

  const handleSignOutCurrentSession = async () => {
    setAccountAction("sign-out");
    await signOut();
    setAccountAction(null);
    navigate("/auth");
  };

  const handleDeleteAccount = async () => {
    if (!user) return;
    if (!deleteAccountSelfServeSupported) {
      toast.error("In-app deletion for social sign-in accounts is not available yet.");
      return;
    }
    if (deleteAccountNeedsPassword && deleteAccountPassword.trim().length < 6) {
      toast.error("Enter your current password to delete this account.");
      return;
    }

    setAccountAction("delete-account");
    const { error } = await supabase.functions.invoke<{ ok: true }>("delete-account", {
      body: deleteAccountNeedsPassword
        ? { password: deleteAccountPassword.trim() }
        : {},
    });
    setAccountAction(null);

    if (error) {
      toast.error(error.message || "Could not delete your account.");
      return;
    }

    setDeleteAccountDialogOpen(false);
    setDeleteAccountPassword("");
    toast.success("Your account has been deleted.");
    await signOut();
    navigate("/", { replace: true });
  };

  const focusSettingsSearchInput = useCallback(() => {
    window.requestAnimationFrame(() => {
      settingsSearchInputRef.current?.focus();
      settingsSearchInputRef.current?.select();
    });
  }, []);

  const handleSettingsSearchButtonClick = useCallback(() => {
    if (!showSettingsSearchInput) {
      setIsSettingsSearchOpen(true);
    }
    focusSettingsSearchInput();
  }, [focusSettingsSearchInput, showSettingsSearchInput]);

  const currentPlaybackSession = playbackSessions.find((session) => session.deviceId === currentPlaybackDeviceId) || null;
  const otherPlaybackSessions = playbackSessions.filter((session) => session.deviceId !== currentPlaybackDeviceId);
  const visiblePlaybackSessionCount = (currentPlaybackSession ? 1 : 0) + otherPlaybackSessions.length;

  useEffect(() => {
    const handleOnlineState = () => {
      setIsOnline(navigator.onLine);
    };

    window.addEventListener("online", handleOnlineState);
    window.addEventListener("offline", handleOnlineState);

    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker.ready
        .then(() => {
          setServiceWorkerReady(true);
        })
        .catch(() => {
          setServiceWorkerReady(false);
        });
    }

    return () => {
      window.removeEventListener("online", handleOnlineState);
      window.removeEventListener("offline", handleOnlineState);
    };
  }, []);

  useEffect(() => {
    if (!showSettingsSearchInput) return;
    focusSettingsSearchInput();
  }, [focusSettingsSearchInput, showSettingsSearchInput]);

  const accountSectionTitle = t("settings.account");
  const languageSectionTitle = t("settings.language");
  const audioQualitySectionTitle = t("settings.audioQuality");
  const librarySectionTitle = t("settings.yourLibrary");
  const displaySectionTitle = t("settings.display");
  const socialSectionTitle = t("settings.social");
  const storageSectionTitle = t("settings.storage");
  const adminSectionTitle = "Admin";

  const accountSectionTitleMatch = matchesSearchQuery(normalizedSettingsSearchQuery, accountSectionTitle);
  const accountProfileRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    user?.user_metadata?.display_name,
    user?.email,
    currentPlaybackSession?.deviceName,
    currentPlaybackSession?.currentTrack?.title,
    currentPlaybackSession?.currentTrack?.artist,
    "profile account session",
  );
  const passwordResetRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    "Password reset",
    "Send a reset link to your account email and finish the change securely in email.",
    "reset password email",
  );
  const activeSessionsRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    "Active sessions",
    currentPlaybackSession?.deviceName,
    currentPlaybackSession?.currentTrack?.title,
    currentPlaybackSession?.currentTrack?.artist,
    ...otherPlaybackSessions.flatMap((session) => [session.deviceName, session.currentTrack?.title, session.currentTrack?.artist]),
    "session playback device sign out other sessions",
  );
  const signOutRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.signOut"),
    t("settings.signOutDescription"),
    "log out logout",
  );
  const deleteAccountRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    "Delete account",
    "Permanently remove your Knobb account, profile, and account-scoped library data.",
    "close account remove account",
  );
  const guestRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.guest"),
    t("settings.signInManage"),
    t("settings.signIn"),
    "account",
  );
  const accountSectionVisible = user
    ? accountSectionTitleMatch || accountProfileRowMatch || passwordResetRowMatch || activeSessionsRowMatch || signOutRowMatch || deleteAccountRowMatch
    : accountSectionTitleMatch || guestRowMatch;

  const languageSectionTitleMatch = matchesSearchQuery(normalizedSettingsSearchQuery, languageSectionTitle);
  const languageRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.chooseLanguage"),
    t("settings.languageDescription"),
    t("settings.languageEnglish"),
    t("settings.languageBangla"),
  );
  const languageSectionVisible = languageSectionTitleMatch || languageRowMatch;

  const audioQualitySectionTitleMatch = matchesSearchQuery(normalizedSettingsSearchQuery, audioQualitySectionTitle);
  const streamingQualityRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.streamingQuality"),
    quality,
    ...qualityOptions.map((option) => option.label),
    ...qualityOptions.map((option) => option.tag),
  );
  const adaptiveStreamingRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.adaptiveStreaming"),
    t("settings.adaptiveStreamingDescription"),
    "auto adaptive quality bandwidth network",
  );
  const downloadFormatRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.downloadFormat"),
    downloadFormat,
    ...downloadFormatOptions.map((option) => option.label),
  );
  const equalizerRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.equalizer"),
    "audio tuning preset bands reset",
  );
  const pitchRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.preservePitch"),
    t("settings.preservePitchDescription"),
  );
  const monoAudioRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.monoAudio"),
    t("settings.monoAudioDescription"),
    "single channel stereo accessibility",
  );
  const loudnessRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.volumeNormalization"),
    t("settings.volumeNormalizationDescription"),
  );
  const audioQualitySectionVisible = audioQualitySectionTitleMatch
    || streamingQualityRowMatch
    || adaptiveStreamingRowMatch
    || downloadFormatRowMatch
    || equalizerRowMatch
    || pitchRowMatch
    || monoAudioRowMatch
    || loudnessRowMatch;

  const librarySectionTitleMatch = matchesSearchQuery(normalizedSettingsSearchQuery, librarySectionTitle);
  const showLocalFilesRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.showLocalFiles"),
    t("settings.showLocalFilesDescription"),
    "local files library",
  );
  const localFilesSummaryRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.localFilesCount", { count: localFiles.length }),
    t("settings.localFilesStorage", { size: formatBytes(totalBytes) }),
    t("settings.openLocalFiles"),
    "local files storage",
  );
  const librarySectionVisible = librarySectionTitleMatch || showLocalFilesRowMatch || localFilesSummaryRowMatch;

  const displaySectionTitleMatch = matchesSearchQuery(normalizedSettingsSearchQuery, displaySectionTitle);
  const pageDensityRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.pageDensity"),
    t("settings.pageDensityDescription"),
    t("settings.pageDensityComfortable"),
    t("settings.pageDensityCompact"),
  );
  const fontRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.font"),
    t("settings.fontDescription"),
    t("settings.fontDefault"),
    t("settings.fontGrotesk"),
    t("settings.fontInter"),
    t("settings.fontPoppins"),
    t("settings.fontNunito"),
    font,
  );
  const dynamicCardsRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.dynamicCards"),
    t("settings.dynamicCardsDescription"),
    t("settings.dynamicCardsEnabledOption"),
    t("settings.dynamicCardsDisabledOption"),
  );
  const showScrollbarRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.showScrollbar"),
    t("settings.showScrollbarDescription"),
    t("settings.optionYes"),
    t("settings.optionNo"),
  );
  const libraryCardStyleRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.libraryCardStyle"),
    t("settings.libraryCardStyleDescription"),
    t("settings.libraryCardStyleCover"),
    t("settings.libraryCardStyleList"),
  );
  const rightPanelStyleRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.rightPanelStyle"),
    t("settings.rightPanelStyleDescription"),
    t("settings.rightPanelStyleClassic"),
    t("settings.rightPanelStyleArtwork"),
  );
  const rightPanelAutoOpenRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.rightPanelAutoOpen"),
    t("settings.rightPanelAutoOpenDescription"),
    t("settings.rightPanelAutoOpenAlways"),
    t("settings.rightPanelAutoOpenWhilePlaying"),
    t("settings.rightPanelAutoOpenNever"),
  );
  const bottomPlayerStyleRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.bottomPlayerStyle"),
    t("settings.bottomPlayerStyleDescription"),
    t("settings.bottomPlayerStyleCurrent"),
    t("settings.bottomPlayerStyleBlack"),
  );
  const fullScreenLyricsRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.fullScreenLyrics"),
    t("settings.fullScreenLyricsDescription"),
    t("settings.optionShow"),
    t("settings.optionHide"),
    "fullscreen lyrics",
  );
  const fullScreenBackgroundBlurRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.fullScreenBackgroundBlur"),
    t("settings.fullScreenBackgroundBlurDescription"),
    "fullscreen background blur backdrop",
  );
  const fullScreenBackgroundDarknessRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.fullScreenBackgroundDarkness"),
    t("settings.fullScreenBackgroundDarknessDescription"),
    "fullscreen background darkness overlay opacity",
  );
  const cardSizeRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.cardSize"),
    t("settings.cardSizeDescription"),
    t("settings.sizeSmaller"),
    t("settings.sizeSmall"),
    t("settings.sizeDefault"),
    t("settings.sizeBig"),
    t("settings.sizeBigger"),
  );
  const displaySectionVisible = displaySectionTitleMatch
    || pageDensityRowMatch
    || fontRowMatch
    || dynamicCardsRowMatch
    || showScrollbarRowMatch
    || libraryCardStyleRowMatch
    || rightPanelStyleRowMatch
    || rightPanelAutoOpenRowMatch
    || bottomPlayerStyleRowMatch
    || fullScreenLyricsRowMatch
    || fullScreenBackgroundBlurRowMatch
    || fullScreenBackgroundDarknessRowMatch
    || cardSizeRowMatch;

  const socialSectionTitleMatch = matchesSearchQuery(normalizedSettingsSearchQuery, socialSectionTitle);
  const discordConnectRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    discordStatusTitle,
    discordConnectionDescription,
    isDesktopApp ? "discord desktop native rich presence" : t("settings.openSetup"),
    "discord rich presence",
  );
  const discordPresenceRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.discordPresence"),
    t("settings.discordPresenceDescription"),
    "discord status activity rich presence",
  );
  const discordWebhookRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.discordWebhook"),
    discordWebhookDescription,
    t("settings.discordWebhookUrl"),
    "discord web webhook browser sharing now playing",
  );
  const discordWebhookUrlRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.discordWebhookUrl"),
    discordWebhookInput,
    t("settings.testConnection"),
    "discord webhook url connection",
  );
  const listenBrainzRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.listenBrainz"),
    listenBrainzDescription,
    scrobblePercentLabel,
    listenBrainzUserName,
    "listenbrainz scrobbling",
  );
  const listenBrainzTokenRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.listenBrainzToken"),
    listenBrainzTokenInput,
    t("settings.testConnection"),
    "token connection",
  );
  const scrobbleThresholdRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.scrobbleThreshold"),
    t("settings.scrobbleThresholdDescription", { percent: scrobblePercentLabel }),
    scrobblePercentLabel,
    "listen threshold scrobble percent",
  );
  const socialSectionVisible = socialSectionTitleMatch
    || discordConnectRowMatch
    || discordPresenceRowMatch
    || discordWebhookRowMatch
    || discordWebhookUrlRowMatch
    || listenBrainzRowMatch
    || listenBrainzTokenRowMatch
    || scrobbleThresholdRowMatch;

  const adminSectionTitleMatch = matchesSearchQuery(normalizedSettingsSearchQuery, adminSectionTitle);
  const adminRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    "Open privacy audit",
    "Review user accounts through the secured admin audit surface.",
    "admin audit privacy",
  );
  const adminSectionVisible = isAdmin && (adminSectionTitleMatch || adminRowMatch);

  const storageSectionTitleMatch = matchesSearchQuery(normalizedSettingsSearchQuery, storageSectionTitle);
  const offlineAppRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.offlineApp"),
    isDesktopApp ? t("settings.desktopAppDescription") : serviceWorkerReady ? t("settings.offlineAppReady") : t("settings.offlineAppPending"),
    "offline cache service worker",
  );
  const storageUsageRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.storageUsage"),
    t("settings.storageUsageDescription", {
      used: formatBytes(resolvedStorageUsageBytes),
      quota: resolvedStorageQuotaBytes ? ` of ${formatBytes(resolvedStorageQuotaBytes)}` : "",
    }),
    browserStorageSnapshot.persisted ? t("settings.storagePersistent") : t("settings.storageTemporary"),
    "storage quota persistent indexeddb cache",
  );
  const storageLocalFilesRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.localFilesCount", { count: localFiles.length }),
    t("settings.localFilesStorage", { size: formatBytes(totalBytes) }),
  );
  const cacheRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.cacheSize", { size: (resolvedCacheBytes / (1024 * 1024)).toFixed(1) }),
    t("settings.cacheDescription"),
    t("settings.clearCache"),
    "cache storage",
  );
  const storageLocationRowMatch = matchesSearchQuery(
    normalizedSettingsSearchQuery,
    t("settings.offlineStorageLocation"),
    window.location.origin,
    isOnline ? "Online" : "Offline",
    "storage location",
  );
  const storageSectionVisible = storageSectionTitleMatch
    || offlineAppRowMatch
    || storageUsageRowMatch
    || storageLocalFilesRowMatch
    || cacheRowMatch
    || storageLocationRowMatch;

  const hasVisibleSearchResults = accountSectionVisible
    || languageSectionVisible
    || audioQualitySectionVisible
    || librarySectionVisible
    || displaySectionVisible
    || socialSectionVisible
    || adminSectionVisible
    || storageSectionVisible;

  const settingsSearchActions = (
    <div className="flex w-full gap-3 sm:w-auto">
      {showSettingsSearchInput ? (
        <Input
          ref={settingsSearchInputRef}
          value={settingsSearchQuery}
          onChange={(event) => setSettingsSearchQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            if (settingsSearchQuery) {
              setSettingsSearchQuery("");
              return;
            }
            setIsSettingsSearchOpen(false);
            settingsSearchInputRef.current?.blur();
          }}
          placeholder={t("settings.searchPlaceholder")}
          aria-label={t("settings.searchAria")}
          className="h-11 w-full rounded-[var(--settings-control-radius)] border-white/10 bg-white/[0.04] text-sm text-foreground placeholder:text-muted-foreground/80 focus-visible:ring-0 focus-visible:ring-offset-0 sm:w-72"
        />
      ) : null}
      <button
        type="button"
        onClick={handleSettingsSearchButtonClick}
        className="settings-search-button website-form-control menu-sweep-hover flex h-11 w-11 shrink-0 items-center justify-center rounded-[var(--settings-control-radius)] border border-white/10 bg-white/[0.04] text-muted-foreground focus:ring-0 focus:ring-offset-0"
        aria-label={t("settings.searchAria")}
      >
        <Search className="w-4 h-4" />
      </button>
    </div>
  );

  return (
    <PageTransition>
      <div className="min-h-full bg-black">
        <UtilityPageLayout
          eyebrow="Preferences"
          title={t("settings.title")}
          actions={settingsSearchActions}
          className="settings-page-shell"
        >

          {accountSectionVisible ? (
            <Section title={accountSectionTitle}>
              {user ? (
                <>
                  {accountSectionTitleMatch || accountProfileRowMatch ? (
                    <Row
                      title={user.user_metadata?.display_name || user.email || "Signed in"}
                      description={
                        <div className="space-y-1">
                          <p>{user.email}</p>
                          <p>
                            {currentPlaybackSession
                              ? `Current session: ${currentPlaybackSession.deviceName}`
                              : "Current session is active on this device."}
                          </p>
                        </div>
                      }
                      action={
                        <Button
                          variant="outline"
                          className={SETTINGS_ACTION_BUTTON_CLASS}
                          onClick={() => navigate("/profile")}
                        >
                          {t("settings.view")} <ExternalLink className="w-4 h-4 ml-2" />
                        </Button>
                      }
                    />
                  ) : null}
                  {accountSectionTitleMatch || passwordResetRowMatch ? (
                    <Row
                      title="Password reset"
                      description="Send a reset link to your account email and finish the change securely in email."
                      action={
                        <Button
                          variant="outline"
                          className={SETTINGS_ACTION_BUTTON_CLASS}
                          onClick={() => {
                            void handleSendPasswordReset();
                          }}
                          disabled={accountAction !== null || !user.email}
                        >
                          {accountAction === "password-reset" ? "Sending..." : "Send reset email"}
                        </Button>
                      }
                    />
                  ) : null}
                  {accountSectionTitleMatch || activeSessionsRowMatch ? (
                    <Row
                      title="Active sessions"
                      description={
                        <div className="space-y-3">
                          <p>
                            {isLoadingPlaybackSessions
                              ? "Checking your active sessions..."
                              : `${visiblePlaybackSessionCount} active session${visiblePlaybackSessionCount === 1 ? "" : "s"} detected.`}
                          </p>
                          <div className="space-y-2">
                            {currentPlaybackSession ? (
                              <div className="rounded-[var(--surface-radius-sm)] border border-white/10 bg-white/[0.03] px-4 py-3">
                                <p className="text-sm font-semibold text-foreground">
                                  {currentPlaybackSession.deviceName} · This device
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {currentPlaybackSession.currentTrack
                                    ? `${currentPlaybackSession.currentTrack.title} · ${currentPlaybackSession.currentTrack.artist}${currentPlaybackSession.isPlaying ? " · Playing" : " · Paused"}`
                                    : "No active track right now."}
                                </p>
                              </div>
                            ) : null}
                            {otherPlaybackSessions.map((session) => (
                            <div
                              key={session.id}
                              className="rounded-[var(--surface-radius-sm)] border border-white/10 bg-white/[0.03] px-4 py-3"
                            >
                              <p className="text-sm font-semibold text-foreground">{session.deviceName}</p>
                              <p className="mt-1 text-xs text-muted-foreground">
                                {session.currentTrack
                                  ? `${session.currentTrack.title} · ${session.currentTrack.artist}${session.isPlaying ? " · Playing" : " · Paused"}`
                                  : "Signed in with no active playback."}
                              </p>
                            </div>
                          ))}
                          {!isLoadingPlaybackSessions && !currentPlaybackSession && otherPlaybackSessions.length === 0 ? (
                            <p className="text-xs text-muted-foreground">
                              No other signed-in Knobb sessions are active right now.
                            </p>
                          ) : null}
                        </div>
                      </div>
                    }
                    action={
                      <div className="mt-3 flex w-full justify-end lg:mt-0 lg:w-auto">
                        <Button
                          variant="destructive"
                          className={SETTINGS_DESTRUCTIVE_BUTTON_CLASS}
                          onClick={() => {
                            void handleSignOutOtherSessions();
                          }}
                          disabled={accountAction !== null || otherPlaybackSessions.length === 0}
                        >
                          {accountAction === "sign-out-others" ? "Signing out..." : "Sign out other sessions"}
                        </Button>
                      </div>
                    }
                    className="lg:items-start"
                  />
                ) : null}
                {accountSectionTitleMatch || signOutRowMatch ? (
                  <Row
                    title={t("settings.signOut")}
                    description={t("settings.signOutDescription")}
                    action={
                      <Button
                        variant="destructive"
                        className={SETTINGS_DESTRUCTIVE_BUTTON_CLASS}
                        onClick={() => {
                          void handleSignOutCurrentSession();
                        }}
                        disabled={accountAction !== null}
                      >
                        {accountAction === "sign-out" ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Signing out...
                          </>
                        ) : (
                          t("settings.signOut")
                        )}
                      </Button>
                    }
                  />
                ) : null}
                {accountSectionTitleMatch || deleteAccountRowMatch ? (
                  <Row
                    title="Delete account"
                    description={deleteAccountSelfServeSupported
                      ? "Permanently remove your Knobb account, profile, and account-scoped library data."
                      : "This account uses social sign-in. Secure self-serve deletion is not available here yet."}
                    action={
                      <Button
                        variant="destructive"
                        className={SETTINGS_DESTRUCTIVE_BUTTON_CLASS}
                        onClick={() => setDeleteAccountDialogOpen(true)}
                        disabled={accountAction !== null}
                      >
                        Delete account
                      </Button>
                    }
                  />
                ) : null}
              </>
            ) : (
              <>
                {accountSectionTitleMatch || guestRowMatch ? (
                  <Row
                    title={t("settings.guest")}
                    description={t("settings.signInManage")}
                    action={
                      <Button
                        variant="outline"
                        className={SETTINGS_ACTION_BUTTON_CLASS}
                        onClick={() => navigate("/auth")}
                      >
                        {t("settings.signIn")}
                      </Button>
                    }
                  />
                ) : null}
              </>
            )}
          </Section>
        ) : null}

        {languageSectionVisible ? (
          <Section title={languageSectionTitle}>
            {languageSectionTitleMatch || languageRowMatch ? (
              <Row
                title={t("settings.chooseLanguage")}
                description={t("settings.languageDescription")}
                action={
                  <SelectControl
                    value={language}
                    onChange={(value) => setLanguage(value as "en" | "bn")}
                    options={[
                      { value: "en", label: `${t("settings.languageEnglish")} (English)` },
                      { value: "bn", label: `${t("settings.languageBangla")} (বাংলা)` },
                    ]}
                  />
                }
              />
            ) : null}
          </Section>
        ) : null}

        {audioQualitySectionVisible ? (
          <Section title={audioQualitySectionTitle}>
            {audioQualitySectionTitleMatch || streamingQualityRowMatch ? (
              <Row
                title={t("settings.streamingQuality")}
                action={
                  <SelectControl
                    value={quality}
                    onChange={(value) => setQuality(value as AudioQuality)}
                    options={qualityOptions}
                  />
                }
              />
            ) : null}
            {audioQualitySectionTitleMatch || adaptiveStreamingRowMatch ? (
              <Row
                title={t("settings.adaptiveStreaming")}
                description={t("settings.adaptiveStreamingDescription")}
                action={<ToggleControl checked={autoQualityEnabled} onCheckedChange={setAutoQualityEnabled} />}
              />
            ) : null}
            {audioQualitySectionTitleMatch || downloadFormatRowMatch ? (
              <Row
                title={t("settings.downloadFormat")}
                action={
                  <SelectControl
                    value={downloadFormat}
                    onChange={(value) => setDownloadFormat(value as DownloadFormat)}
                    options={downloadFormatOptions}
                  />
                }
              />
            ) : null}
            {audioQualitySectionTitleMatch || equalizerRowMatch ? (
              <SettingsEqualizer
                enabled={equalizerEnabled}
                gains={eqGains}
                preset={eqPreset}
                preampDb={preampDb}
                onToggleEnabled={() => toggleEqualizer()}
                onSetBandGain={setEqBandGain}
                onApplyPreset={applyEqPreset}
                onReset={resetEqualizer}
                onSetPreampDb={setPreampDb}
              />
            ) : null}
            {audioQualitySectionTitleMatch || pitchRowMatch ? (
              <Row
                title={t("settings.preservePitch")}
                description={t("settings.preservePitchDescription")}
                action={<ToggleControl checked={preservePitch} onCheckedChange={setPreservePitch} />}
              />
            ) : null}
            {audioQualitySectionTitleMatch || monoAudioRowMatch ? (
              <Row
                title={t("settings.monoAudio")}
                description={t("settings.monoAudioDescription")}
                action={<ToggleControl checked={monoAudioEnabled} onCheckedChange={setMonoAudioEnabled} />}
              />
            ) : null}
            {audioQualitySectionTitleMatch || loudnessRowMatch ? (
              <Row
                title={t("settings.volumeNormalization")}
                description={t("settings.volumeNormalizationDescription")}
                action={<ToggleControl checked={normalization} onCheckedChange={() => toggleNormalization()} />}
              />
            ) : null}
          </Section>
        ) : null}

        {librarySectionVisible ? (
          <Section title={librarySectionTitle}>
            {librarySectionTitleMatch || showLocalFilesRowMatch ? (
              <Row
                title={t("settings.showLocalFiles")}
                description={t("settings.showLocalFilesDescription")}
                action={<ToggleControl checked={showLocalFiles} onCheckedChange={setShowLocalFiles} />}
              />
            ) : null}
            {librarySectionTitleMatch || localFilesSummaryRowMatch ? (
              <Row
                title={t("settings.localFilesCount", { count: localFiles.length })}
                description={t("settings.localFilesStorage", { size: formatBytes(totalBytes) })}
                action={
                  <Button
                    variant="outline"
                    className={SETTINGS_ACTION_BUTTON_CLASS}
                    onClick={() => navigate("/local-files")}
                  >
                    {t("settings.openLocalFiles")}
                  </Button>
                }
              />
            ) : null}
          </Section>
        ) : null}

        {displaySectionVisible ? (
          <Section title={displaySectionTitle}>
            {displaySectionTitleMatch || pageDensityRowMatch ? (
              <Row
                title={t("settings.pageDensity")}
                description={t("settings.pageDensityDescription")}
                action={
                  <SelectControl
                    value={pageDensity}
                    onChange={(value) => setPageDensity(value as typeof pageDensity)}
                    options={[
                      { value: "comfortable", label: t("settings.pageDensityComfortable") },
                      { value: "compact", label: t("settings.pageDensityCompact") },
                    ]}
                  />
                }
              />
            ) : null}
            {displaySectionTitleMatch || fontRowMatch ? (
              <Row
                title={t("settings.font")}
                description={t("settings.fontDescription")}
                action={
                  <SelectControl
                    value={font}
                    onChange={(value) => setFont(value as typeof font)}
                    options={[
                      { value: "System Default", label: t("settings.fontDefault") },
                      { value: "Space Grotesk", label: t("settings.fontGrotesk") },
                      { value: "Inter", label: t("settings.fontInter") },
                      { value: "Poppins", label: t("settings.fontPoppins") },
                      { value: "Nunito", label: t("settings.fontNunito") },
                    ]}
                  />
                }
              />
            ) : null}
            {displaySectionTitleMatch || dynamicCardsRowMatch ? (
              <Row
                title={t("settings.dynamicCards")}
                description={t("settings.dynamicCardsDescription")}
                action={
                  <SelectControl
                    value={dynamicCardsEnabled ? "dynamic" : "normal"}
                    onChange={(value) => setDynamicCardsEnabled(value === "dynamic")}
                    options={[
                      { value: "dynamic", label: t("settings.dynamicCardsEnabledOption") },
                      { value: "normal", label: t("settings.dynamicCardsDisabledOption") },
                    ]}
                  />
                }
              />
            ) : null}
            {displaySectionTitleMatch || showScrollbarRowMatch ? (
              <Row
                title={t("settings.showScrollbar")}
                description={t("settings.showScrollbarDescription")}
                action={
                  <SelectControl
                    value={showScrollbar ? "yes" : "no"}
                    onChange={(value) => setShowScrollbar(value === "yes")}
                    options={[
                      { value: "yes", label: t("settings.optionYes") },
                      { value: "no", label: t("settings.optionNo") },
                    ]}
                  />
                }
              />
            ) : null}
            {displaySectionTitleMatch || libraryCardStyleRowMatch ? (
              <Row
                title={t("settings.libraryCardStyle")}
                description={t("settings.libraryCardStyleDescription")}
                action={
                  <SelectControl
                    value={libraryItemStyle}
                    onChange={(value) => setLibraryItemStyle(value as typeof libraryItemStyle)}
                    options={[
                      { value: "cover", label: t("settings.libraryCardStyleCover") },
                      { value: "list", label: t("settings.libraryCardStyleList") },
                    ]}
                  />
                }
              />
            ) : null}
            {displaySectionTitleMatch || rightPanelStyleRowMatch ? (
              <Row
                title={t("settings.rightPanelStyle")}
                description={t("settings.rightPanelStyleDescription")}
                action={
                  <SelectControl
                    value={rightPanelStyle}
                    onChange={(value) => setRightPanelStyle(value as typeof rightPanelStyle)}
                    options={[
                      { value: "classic", label: t("settings.rightPanelStyleClassic") },
                      { value: "artwork", label: t("settings.rightPanelStyleArtwork") },
                    ]}
                  />
                }
              />
            ) : null}
            {displaySectionTitleMatch || rightPanelAutoOpenRowMatch ? (
              <Row
                title={t("settings.rightPanelAutoOpen")}
                description={t("settings.rightPanelAutoOpenDescription")}
                action={
                  <SelectControl
                    value={rightPanelAutoOpen}
                    onChange={(value) => setRightPanelAutoOpen(value as typeof rightPanelAutoOpen)}
                    options={[
                      { value: "always", label: t("settings.rightPanelAutoOpenAlways") },
                      { value: "while-playing", label: t("settings.rightPanelAutoOpenWhilePlaying") },
                      { value: "never", label: t("settings.rightPanelAutoOpenNever") },
                    ]}
                  />
                }
              />
            ) : null}
            {displaySectionTitleMatch || bottomPlayerStyleRowMatch ? (
              <Row
                title={t("settings.bottomPlayerStyle")}
                description={t("settings.bottomPlayerStyleDescription")}
                action={
                  <SelectControl
                    value={bottomPlayerStyle}
                    onChange={(value) => setBottomPlayerStyle(value as typeof bottomPlayerStyle)}
                    options={[
                      { value: "current", label: t("settings.bottomPlayerStyleCurrent") },
                      { value: "black", label: t("settings.bottomPlayerStyleBlack") },
                    ]}
                  />
                }
              />
            ) : null}
            {displaySectionTitleMatch || fullScreenLyricsRowMatch ? (
              <Row
                title={t("settings.fullScreenLyrics")}
                description={t("settings.fullScreenLyricsDescription")}
                action={
                  <ToggleControl
                    checked={showFullScreenLyrics}
                    onCheckedChange={setShowFullScreenLyrics}
                  />
                }
              />
            ) : null}
            {displaySectionTitleMatch || fullScreenBackgroundBlurRowMatch ? (
              <Row
                title={t("settings.fullScreenBackgroundBlur")}
                description={t("settings.fullScreenBackgroundBlurDescription")}
                action={
                  <VolumeStyleControl
                    value={fullScreenBackgroundBlur}
                    onChange={setFullScreenBackgroundBlur}
                    ariaLabel={t("settings.fullScreenBackgroundBlur")}
                  />
                }
              />
            ) : null}
            {displaySectionTitleMatch || fullScreenBackgroundDarknessRowMatch ? (
              <Row
                title={t("settings.fullScreenBackgroundDarkness")}
                description={t("settings.fullScreenBackgroundDarknessDescription")}
                action={
                  <VolumeStyleControl
                    value={fullScreenBackgroundDarkness}
                    onChange={setFullScreenBackgroundDarkness}
                    ariaLabel={t("settings.fullScreenBackgroundDarkness")}
                  />
                }
              />
            ) : null}
            {displaySectionTitleMatch || cardSizeRowMatch ? (
              <Row
                title={t("settings.cardSize")}
                description={t("settings.cardSizeDescription")}
                action={
                  <SelectControl
                    value={cardSize}
                    onChange={(value) => setCardSize(value as typeof cardSize)}
                    options={[
                      { value: "smaller", label: t("settings.sizeSmaller") },
                      { value: "small", label: t("settings.sizeSmall") },
                      { value: "default", label: t("settings.sizeDefault") },
                      { value: "big", label: t("settings.sizeBig") },
                      { value: "bigger", label: t("settings.sizeBigger") },
                    ]}
                  />
                }
              />
            ) : null}
          </Section>
        ) : null}

        {socialSectionVisible ? (
          <Section title={socialSectionTitle}>
            {socialSectionTitleMatch || discordConnectRowMatch ? (
              <Row
                title={discordStatusTitle}
                description={discordConnectionDescription}
                action={!isDesktopApp ? (
                  <Button
                    type="button"
                    variant="outline"
                    className={SETTINGS_ACTION_BUTTON_CLASS}
                    onClick={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      setDiscordConnectOpen(true);
                    }}
                  >
                    {t("settings.openSetup")}
                  </Button>
                ) : undefined}
              />
            ) : null}
            {socialSectionTitleMatch || discordPresenceRowMatch ? (
              <Row
                title={t("settings.discordPresence")}
                description={t("settings.discordPresenceDescription")}
                action={
                  <ToggleControl
                    checked={discordPresenceEnabled}
                    onCheckedChange={(next) => {
                      if (!next) {
                        setDiscordPresenceEnabled(false);
                        return;
                      }

                      if (!discordBridgeReady) {
                        toast.info(isDesktopApp ? t("settings.discordNativeUnavailable") : t("settings.discordBridgeMissing"));
                        return;
                      }

                      if (!isDesktopApp && !discordBridgeConfigured) {
                        toast.info(t("settings.discordBridgeSetupRequired"));
                        return;
                      }

                      if (!discordDesktopConnected) {
                        toast.info(t("settings.discordAppWaiting"));
                        return;
                      }

                      setDiscordPresenceEnabled(true);
                    }}
                  />
                }
              />
            ) : null}
            {socialSectionTitleMatch || discordWebhookRowMatch ? (
              <Row
                title={t("settings.discordWebhook")}
                description={discordWebhookDescription}
                action={
                  <ToggleControl
                    checked={discordWebhookEnabled}
                    disabled={isCheckingDiscordWebhook}
                    onCheckedChange={handleDiscordWebhookToggle}
                  />
                }
              />
            ) : null}
            {socialSectionTitleMatch || discordWebhookUrlRowMatch ? (
              <Row
                title={t("settings.discordWebhookUrl")}
                description={discordWebhookName ? t("settings.connectedAs", { name: discordWebhookName }) : undefined}
                action={
                  <div className="flex w-full flex-col gap-3 sm:min-w-[360px] sm:flex-row">
                    <Input
                      type="password"
                      value={discordWebhookInput}
                      onChange={(event) => setDiscordWebhookInput(event.target.value)}
                      onBlur={handleDiscordWebhookBlur}
                      placeholder={t("settings.discordWebhookUrlPlaceholder")}
                      autoComplete="off"
                      spellCheck={false}
                      className="h-11 rounded-[var(--settings-control-radius)] border-white/10 bg-white/[0.04] text-sm text-foreground placeholder:text-muted-foreground/80 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className={SETTINGS_ACTION_BUTTON_CLASS}
                      disabled={isCheckingDiscordWebhook || discordWebhookInput.trim().length === 0}
                      onClick={() => {
                        void validateDiscordWebhookConnection(false);
                      }}
                    >
                      {isCheckingDiscordWebhook ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("settings.testingConnection")}
                        </>
                      ) : (
                        t("settings.testConnection")
                      )}
                    </Button>
                  </div>
                }
                className="lg:items-start"
              />
            ) : null}
            {socialSectionTitleMatch || listenBrainzRowMatch ? (
              <Row
                title={t("settings.listenBrainz")}
                description={listenBrainzDescription}
                action={
                  <ToggleControl
                    checked={listenBrainzEnabled}
                    disabled={isCheckingListenBrainz}
                    onCheckedChange={handleListenBrainzToggle}
                  />
                }
              />
            ) : null}
            {socialSectionTitleMatch || listenBrainzTokenRowMatch ? (
              <Row
                title={t("settings.listenBrainzToken")}
                description={listenBrainzUserName ? t("settings.connectedAs", { name: listenBrainzUserName }) : undefined}
                action={
                  <div className="flex w-full flex-col gap-3 sm:min-w-[360px] sm:flex-row">
                    <Input
                      type="password"
                      value={listenBrainzTokenInput}
                      onChange={(event) => setListenBrainzTokenInput(event.target.value)}
                      onBlur={handleListenBrainzTokenBlur}
                      placeholder={t("settings.listenBrainzTokenPlaceholder")}
                      autoComplete="off"
                      spellCheck={false}
                      className="h-11 rounded-[var(--settings-control-radius)] border-white/10 bg-white/[0.04] text-sm text-foreground placeholder:text-muted-foreground/80 focus-visible:ring-0 focus-visible:ring-offset-0"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className={SETTINGS_ACTION_BUTTON_CLASS}
                      disabled={isCheckingListenBrainz || listenBrainzTokenInput.trim().length === 0}
                      onClick={() => {
                        void validateListenBrainz(false);
                      }}
                    >
                      {isCheckingListenBrainz ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          {t("settings.testingConnection")}
                        </>
                      ) : (
                        t("settings.testConnection")
                      )}
                    </Button>
                  </div>
                }
                className="lg:items-start"
              />
            ) : null}
            {socialSectionTitleMatch || scrobbleThresholdRowMatch ? (
              <Row
                title={t("settings.scrobbleThreshold")}
                description={t("settings.scrobbleThresholdDescription", { percent: scrobblePercentLabel })}
                action={
                  <SelectControl
                    value={scrobblePercentLabel.replace("%", "")}
                    onChange={(value) => setScrobblePercent(value)}
                    options={[
                      { value: "25", label: "25%" },
                      { value: "50", label: "50%" },
                      { value: "75", label: "75%" },
                      { value: "90", label: "90%" },
                    ]}
                  />
                }
              />
            ) : null}
          </Section>
        ) : null}

        {adminSectionVisible ? (
          <Section title={adminSectionTitle}>
            {adminSectionTitleMatch || adminRowMatch ? (
              <Row
                title="Open privacy audit"
                description="Review user accounts through the secured admin audit surface."
                action={
                  <Button
                    variant="outline"
                    className={SETTINGS_ACTION_BUTTON_CLASS}
                    onClick={() => navigate("/admin")}
                  >
                    Open audit <Shield className="ml-2 h-4 w-4" />
                  </Button>
                }
              />
            ) : null}
          </Section>
        ) : null}

        {storageSectionVisible ? (
          <Section title={storageSectionTitle}>
            {storageSectionTitleMatch || offlineAppRowMatch ? (
              <Row
                title={t("settings.offlineApp")}
                description={isDesktopApp
                  ? t("settings.desktopAppDescription")
                  : serviceWorkerReady ? t("settings.offlineAppReady") : t("settings.offlineAppPending")}
                action={serviceWorkerReady || isDesktopApp ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />}
              />
            ) : null}
            {storageSectionTitleMatch || storageUsageRowMatch ? (
              <Row
                title={t("settings.storageUsage")}
                description={t("settings.storageUsageDescription", {
                  used: formatBytes(resolvedStorageUsageBytes),
                  quota: resolvedStorageQuotaBytes ? ` of ${formatBytes(resolvedStorageQuotaBytes)}` : "",
                })}
                action={browserStorageSnapshot.persistenceSupported ? (
                  <div className="flex flex-col gap-2 sm:items-end">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-center text-xs font-semibold text-white/80">
                      {browserStorageSnapshot.persisted ? t("settings.storagePersistent") : t("settings.storageTemporary")}
                    </span>
                    {!browserStorageSnapshot.persisted ? (
                      <Button
                        type="button"
                        variant="outline"
                        className={SETTINGS_ACTION_BUTTON_CLASS}
                        onClick={() => {
                          void requestPersistentStorage();
                        }}
                      >
                        {t("settings.keepOfflineData")}
                      </Button>
                    ) : null}
                  </div>
                ) : undefined}
              />
            ) : null}
            {storageSectionTitleMatch || storageLocalFilesRowMatch ? (
              <Row
                title={t("settings.localFilesCount", { count: localFiles.length })}
                description={t("settings.localFilesStorage", { size: formatBytes(totalBytes) })}
                action={
                  <Button
                    variant="outline"
                    className={SETTINGS_ACTION_BUTTON_CLASS}
                    onClick={() => navigate("/local-files")}
                  >
                    {t("settings.openLocalFiles")}
                  </Button>
                }
              />
            ) : null}
            {storageSectionTitleMatch || cacheRowMatch ? (
              <Row
                title={t("settings.cacheSize", { size: (resolvedCacheBytes / (1024 * 1024)).toFixed(1) })}
                description={t("settings.cacheDescription")}
                action={
                  <Button
                    variant="destructive"
                    className={SETTINGS_DESTRUCTIVE_BUTTON_CLASS}
                    onClick={clearCache}
                  >
                    {t("settings.clearCache")}
                  </Button>
                }
              />
            ) : null}
            {storageSectionTitleMatch || storageLocationRowMatch ? (
              <Row
                title={t("settings.offlineStorageLocation")}
                description={`${window.location.origin} · IndexedDB + Cache Storage`}
                action={
                  <div className="flex items-center justify-end">
                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-semibold text-white/80">
                      {isOnline ? t("settings.storageOnline") : t("settings.storageOffline")}
                    </span>
                  </div>
                }
              />
            ) : null}
          </Section>
        ) : null}

        {hasSettingsSearchQuery && !hasVisibleSearchResults ? (
          <UtilityPagePanel className={cn("px-5 py-6 text-sm text-muted-foreground", PANEL_SURFACE_CLASS)}>
            {t("settings.searchNoResults")}
          </UtilityPagePanel>
        ) : null}

        {!isDesktopApp ? (
          <DiscordConnectDialog
            open={discordConnectOpen}
            onOpenChange={setDiscordConnectOpen}
            presenceEnabled={discordPresenceEnabled}
            status={discordBridgeStatus}
            onEnablePresence={() => {
              setDiscordPresenceEnabled(true);
            }}
          />
        ) : null}

        <Dialog
          open={deleteAccountDialogOpen}
          onOpenChange={(open) => {
            setDeleteAccountDialogOpen(open);
            if (!open) {
              setDeleteAccountPassword("");
            }
          }}
        >
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Delete account</DialogTitle>
              <DialogDescription>
                This permanently removes your Knobb account, profile, and account-scoped library data. This action cannot be undone.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              {deleteAccountNeedsPassword ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Enter your current password to confirm account deletion.
                  </p>
                  <Input
                    type="password"
                    value={deleteAccountPassword}
                    onChange={(event) => setDeleteAccountPassword(event.target.value)}
                    placeholder="Current password"
                    autoComplete="current-password"
                  />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This account uses social sign-in. Secure self-serve deletion is not available yet because Settings does
                  not have a provider reauthentication step for this sign-in method.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                className={SETTINGS_ACTION_BUTTON_CLASS}
                onClick={() => setDeleteAccountDialogOpen(false)}
                disabled={accountAction === "delete-account"}
              >
                {deleteAccountSelfServeSupported ? "Cancel" : "Close"}
              </Button>
              {deleteAccountSelfServeSupported ? (
                <Button
                  variant="destructive"
                  className={SETTINGS_DESTRUCTIVE_BUTTON_CLASS}
                  onClick={() => {
                    void handleDeleteAccount();
                  }}
                  disabled={accountAction === "delete-account"}
                >
                  {accountAction === "delete-account" ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete account"
                  )}
                </Button>
              ) : null}
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </UtilityPageLayout>
      </div>
    </PageTransition>
  );
}
