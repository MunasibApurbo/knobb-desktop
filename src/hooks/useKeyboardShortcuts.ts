import { useEffect, useLayoutEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";

import { useLikedSongs } from "@/contexts/LikedSongsContext";
import { usePlayer, usePlayerTimeline } from "@/contexts/PlayerContext";
import { useSidebarCollapsed } from "@/contexts/SidebarContext";
import { useTrackSelectionShortcutsContext } from "@/contexts/TrackSelectionShortcutsContext";
import { getAudioEngine } from "@/lib/audioEngine";
import { dispatchLibraryShortcutCommand } from "@/lib/keyboardShortcuts";
import { APP_HOME_PATH } from "@/lib/routes";
import { getYoutubeEmbedManager } from "@/lib/youtubeEmbedManager";

const EDITABLE_TARGET_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[role='textbox']",
].join(", ");

const SHORTCUT_SENSITIVE_INTERACTIVE_SELECTOR = [
  "select",
  "[role='combobox']",
  "[role='option']",
  "[role='slider']",
  "[role='tab']",
].join(", ");

const OVERLAY_TARGET_SELECTOR = [
  "[role='alertdialog']",
  "[role='dialog']",
  "[role='listbox']",
  "[role='menu']",
].join(", ");

const OPEN_OVERLAY_SELECTOR = [
  "[role='alertdialog'][data-state='open']",
  "[role='dialog'][data-state='open']",
  "[role='listbox'][data-state='open']",
  "[role='menu'][data-state='open']",
].join(", ");

const YOUTUBE_PLAYBACK_SPEEDS = [0.8, 1, 1.25, 1.5, 2] as const;
const VIDEO_FRAME_STEP_SECONDS = 1 / 30;

type PictureInPictureDocument = Document & {
  exitPictureInPicture?: () => Promise<void>;
  pictureInPictureElement?: Element | null;
  pictureInPictureEnabled?: boolean;
};

type PictureInPictureVideo = HTMLVideoElement & {
  disablePictureInPicture?: boolean;
  requestPictureInPicture?: () => Promise<unknown>;
};

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return target.closest(EDITABLE_TARGET_SELECTOR) !== null;
}

function isBlockedInteractiveShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return target.closest(SHORTCUT_SENSITIVE_INTERACTIVE_SELECTOR) !== null;
}

function isOverlayShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return target.closest(OVERLAY_TARGET_SELECTOR) !== null;
}

function shouldIgnoreSelectionShortcutTarget(target: EventTarget | null) {
  return isEditableShortcutTarget(target) || isOverlayShortcutTarget(target);
}

function shouldIgnoreGlobalShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  if (isEditableShortcutTarget(target)) {
    return true;
  }

  return isBlockedInteractiveShortcutTarget(target) || isOverlayShortcutTarget(target);
}

function hasOpenOverlaySurface() {
  return document.querySelector(OPEN_OVERLAY_SELECTOR) !== null;
}

function getClosestPlaybackSpeedIndex(playbackSpeed: number) {
  return YOUTUBE_PLAYBACK_SPEEDS.reduce((bestIndex, speed, index) => {
    const bestDistance = Math.abs(YOUTUBE_PLAYBACK_SPEEDS[bestIndex] - playbackSpeed);
    const nextDistance = Math.abs(speed - playbackSpeed);
    return nextDistance < bestDistance ? index : bestIndex;
  }, 0);
}

function getSteppedPlaybackSpeed(playbackSpeed: number, direction: -1 | 1) {
  const currentIndex = getClosestPlaybackSpeedIndex(playbackSpeed);
  const nextIndex = Math.max(0, Math.min(YOUTUBE_PLAYBACK_SPEEDS.length - 1, currentIndex + direction));
  return YOUTUBE_PLAYBACK_SPEEDS[nextIndex];
}

async function toggleFullscreenForCurrentMedia(preferMediaElement: boolean) {
  if (typeof document === "undefined") return;

  if (document.fullscreenElement) {
    await document.exitFullscreen?.().catch(() => undefined);
    return;
  }

  const mediaElement = getAudioEngine().getMediaElement();
  const fullscreenTarget = preferMediaElement && mediaElement instanceof HTMLVideoElement
    ? mediaElement
    : document.documentElement;

  const fallbackTarget = document.documentElement;

  await fullscreenTarget.requestFullscreen?.().catch(async () => {
    if (fullscreenTarget === fallbackTarget) return;
    await fallbackTarget.requestFullscreen?.().catch(() => undefined);
  });
}

async function togglePictureInPictureForCurrentMedia() {
  if (typeof document === "undefined") return;

  const pipDocument = document as PictureInPictureDocument;
  if (pipDocument.pictureInPictureElement) {
    await pipDocument.exitPictureInPicture?.().catch(() => undefined);
    return;
  }

  if (pipDocument.pictureInPictureEnabled === false) return;

  const mediaElement = getAudioEngine().getMediaElement();
  if (!(mediaElement instanceof HTMLVideoElement)) return;

  const pipMediaElement = mediaElement as PictureInPictureVideo;
  if (pipMediaElement.disablePictureInPicture || typeof pipMediaElement.requestPictureInPicture !== "function") {
    return;
  }

  await pipMediaElement.requestPictureInPicture().catch(() => undefined);
}

function isMacKeyboardPlatform() {
  if (typeof navigator === "undefined") return false;

  const platform = navigator.userAgentData?.platform || navigator.platform || navigator.userAgent || "";
  return /mac|iphone|ipad|ipod/i.test(platform);
}

function hasPrimaryModifier(event: KeyboardEvent) {
  return event.metaKey || event.ctrlKey;
}

function hasNoModifiers(event: KeyboardEvent) {
  return !event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey;
}

function isSpotifySearchNavigationShortcut(event: KeyboardEvent, normalizedKey: string, isMac: boolean) {
  if (normalizedKey !== "l" || !hasPrimaryModifier(event) || event.altKey) return false;
  return isMac ? event.shiftKey : !event.shiftKey;
}

function isSpotifyShuffleShortcut(event: KeyboardEvent, normalizedKey: string, isMac: boolean) {
  if (normalizedKey !== "s") return false;

  return isMac
    ? !event.ctrlKey && !event.metaKey && event.altKey && !event.shiftKey
    : hasPrimaryModifier(event) && !event.altKey && !event.shiftKey;
}

function isSpotifyRepeatShortcut(event: KeyboardEvent, normalizedKey: string, isMac: boolean) {
  if (normalizedKey !== "r") return false;

  return isMac
    ? !event.ctrlKey && !event.metaKey && event.altKey && !event.shiftKey
    : hasPrimaryModifier(event) && !event.altKey && !event.shiftKey;
}

export function useKeyboardShortcuts() {
  const {
    addToQueue,
    currentTrack,
    isPlaying,
    next,
    openRightPanel,
    playbackMode,
    playbackSpeed,
    previous,
    rightPanelTab,
    seek,
    setVolume,
    setPlaybackSpeed,
    setRightPanelOpen,
    showRightPanel,
    togglePlay,
    toggleRepeat,
    toggleRightPanel,
    toggleShuffle,
    volume,
  } = usePlayer();
  const { currentTime, duration } = usePlayerTimeline();
  const { toggleLike } = useLikedSongs();
  const { collapsed, setCollapsed } = useSidebarCollapsed();
  const { activeScope } = useTrackSelectionShortcutsContext();
  const navigate = useNavigate();
  const activeScopeRef = useRef(activeScope);
  const addToQueueRef = useRef(addToQueue);
  const collapsedRef = useRef(collapsed);
  const currentTrackRef = useRef(currentTrack);
  const currentTimeRef = useRef(currentTime);
  const durationRef = useRef(duration);
  const isPlayingRef = useRef(isPlaying);
  const nextRef = useRef(next);
  const navigateRef = useRef(navigate);
  const openRightPanelRef = useRef(openRightPanel);
  const playbackModeRef = useRef(playbackMode);
  const playbackSpeedRef = useRef(playbackSpeed);
  const previousRef = useRef(previous);
  const prevVolumeRef = useRef(volume);
  const rightPanelTabRef = useRef(rightPanelTab);
  const setCollapsedRef = useRef(setCollapsed);
  const seekRef = useRef(seek);
  const setPlaybackSpeedRef = useRef(setPlaybackSpeed);
  const setRightPanelOpenRef = useRef(setRightPanelOpen);
  const setVolumeRef = useRef(setVolume);
  const showRightPanelRef = useRef(showRightPanel);
  const toggleLikeRef = useRef(toggleLike);
  const togglePlayRef = useRef(togglePlay);
  const toggleRepeatRef = useRef(toggleRepeat);
  const toggleRightPanelRef = useRef(toggleRightPanel);
  const toggleShuffleRef = useRef(toggleShuffle);
  const volumeRef = useRef(volume);
  const preservePlaybackOnFullscreenExitRef = useRef(false);

  useLayoutEffect(() => {
    activeScopeRef.current = activeScope;
    addToQueueRef.current = addToQueue;
    collapsedRef.current = collapsed;
    currentTrackRef.current = currentTrack;
    currentTimeRef.current = currentTime;
    durationRef.current = duration;
    isPlayingRef.current = isPlaying;
    nextRef.current = next;
    navigateRef.current = navigate;
    openRightPanelRef.current = openRightPanel;
    playbackModeRef.current = playbackMode;
    playbackSpeedRef.current = playbackSpeed;
    previousRef.current = previous;
    rightPanelTabRef.current = rightPanelTab;
    setCollapsedRef.current = setCollapsed;
    seekRef.current = seek;
    setPlaybackSpeedRef.current = setPlaybackSpeed;
    setRightPanelOpenRef.current = setRightPanelOpen;
    setVolumeRef.current = setVolume;
    showRightPanelRef.current = showRightPanel;
    toggleLikeRef.current = toggleLike;
    togglePlayRef.current = togglePlay;
    toggleRepeatRef.current = toggleRepeat;
    toggleRightPanelRef.current = toggleRightPanel;
    toggleShuffleRef.current = toggleShuffle;
    volumeRef.current = volume;
  }, [
    activeScope,
    addToQueue,
    collapsed,
    currentTrack,
    currentTime,
    duration,
    isPlaying,
    navigate,
    next,
    openRightPanel,
    playbackMode,
    playbackSpeed,
    previous,
    rightPanelTab,
    setCollapsed,
    seek,
    setPlaybackSpeed,
    setRightPanelOpen,
    setVolume,
    showRightPanel,
    toggleLike,
    togglePlay,
    toggleRepeat,
    toggleRightPanel,
    toggleShuffle,
    volume,
  ]);

  useEffect(() => {
    if (volume > 0) prevVolumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    preservePlaybackOnFullscreenExitRef.current = Boolean(
      document.fullscreenElement
      && currentTrack?.isVideo === true
      && isPlaying,
    );
  }, [currentTrack, isPlaying]);

  useEffect(() => {
    let restorePlaybackTimerId: number | null = null;

    const clearRestorePlaybackTimer = () => {
      if (restorePlaybackTimerId !== null) {
        window.clearTimeout(restorePlaybackTimerId);
        restorePlaybackTimerId = null;
      }
    };

    const handleFullscreenChange = () => {
      if (document.fullscreenElement) {
        preservePlaybackOnFullscreenExitRef.current = Boolean(
          currentTrackRef.current?.isVideo === true && isPlayingRef.current,
        );
        return;
      }

      if (!preservePlaybackOnFullscreenExitRef.current) {
        return;
      }

      preservePlaybackOnFullscreenExitRef.current = false;
      clearRestorePlaybackTimer();
      restorePlaybackTimerId = window.setTimeout(() => {
        if (document.fullscreenElement || currentTrackRef.current?.isVideo !== true) {
          return;
        }

        const mediaPaused = playbackModeRef.current === "youtube-embed"
          ? getYoutubeEmbedManager().isPaused()
          : getAudioEngine().getMediaElement().paused;

        if (mediaPaused) {
          togglePlayRef.current();
        }
      }, 0);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      clearRestorePlaybackTimer();
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (hasOpenOverlaySurface()) return;

      const activeSelectionScope = activeScopeRef.current;
      const activeTrack = currentTrackRef.current;
      const activeCurrentTime = currentTimeRef.current;
      const activeDuration = durationRef.current;
      const activeIsPlaying = isPlayingRef.current;
      const activeVolume = volumeRef.current;
      const activePlaybackSpeed = playbackSpeedRef.current;
      const activeRightPanelTab = rightPanelTabRef.current;
      const activeShowRightPanel = showRightPanelRef.current;
      const normalizedKey = event.key.toLowerCase();
      const isMac = isMacKeyboardPlatform();

      if (!shouldIgnoreSelectionShortcutTarget(event.target) && activeSelectionScope) {
        if (hasPrimaryModifier(event) && normalizedKey === "a" && !event.altKey && !event.shiftKey) {
          event.preventDefault();
          activeSelectionScope.selectAll();
          return;
        }

        if (event.key === "Escape" && activeSelectionScope.selectedCount) {
          event.preventDefault();
          activeSelectionScope.clearSelection();
          return;
        }

        if ((event.key === "Delete" || event.key === "Backspace") && activeSelectionScope.selectedCount) {
          event.preventDefault();
          void activeSelectionScope.deleteSelection();
          return;
        }
      }

      if (!shouldIgnoreSelectionShortcutTarget(event.target) && activeSelectionScope?.collectionActions && hasNoModifiers(event)) {
        const { collectionActions } = activeSelectionScope;

        if (normalizedKey === "p") {
          event.preventDefault();
          collectionActions.play?.();
          return;
        }

        if (normalizedKey === "s") {
          event.preventDefault();
          collectionActions.shuffle?.();
          return;
        }

        if (normalizedKey === "d") {
          event.preventDefault();
          collectionActions.download?.();
          return;
        }

        if (normalizedKey === "o" || normalizedKey === "h") {
          event.preventDefault();
          collectionActions.toggleSaved?.();
          return;
        }

        if (normalizedKey === "y") {
          event.preventDefault();
          collectionActions.share?.();
          return;
        }
      }

      if (shouldIgnoreGlobalShortcutTarget(event.target)) return;

      if (hasPrimaryModifier(event) && normalizedKey === "k" && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        navigateRef.current("/search");
        return;
      }

      if (isSpotifySearchNavigationShortcut(event, normalizedKey, isMac)) {
        event.preventDefault();
        navigateRef.current("/search");
        return;
      }

      if (hasPrimaryModifier(event) && event.key === "," && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        navigateRef.current("/settings");
        return;
      }

      if (hasPrimaryModifier(event) && normalizedKey === "f" && !event.altKey && !event.shiftKey) {
        event.preventDefault();
        setCollapsedRef.current(false);
        dispatchLibraryShortcutCommand({ type: "focus-search" });
        return;
      }

      if (isSpotifyShuffleShortcut(event, normalizedKey, isMac)) {
        event.preventDefault();
        toggleShuffleRef.current();
        return;
      }

      if (isSpotifyRepeatShortcut(event, normalizedKey, isMac)) {
        event.preventDefault();
        toggleRepeatRef.current();
        return;
      }

      if (!event.ctrlKey && !event.metaKey && event.altKey && event.shiftKey) {
        switch (normalizedKey) {
          case "0":
            event.preventDefault();
            navigateRef.current(APP_HOME_PATH);
            setCollapsedRef.current(false);
            dispatchLibraryShortcutCommand({ type: "set-filter", filter: "all" });
            return;
          case "1":
            event.preventDefault();
            navigateRef.current(APP_HOME_PATH);
            setCollapsedRef.current(false);
            dispatchLibraryShortcutCommand({ type: "set-filter", filter: "playlists" });
            return;
          case "3":
            event.preventDefault();
            navigateRef.current(APP_HOME_PATH);
            setCollapsedRef.current(false);
            dispatchLibraryShortcutCommand({ type: "set-filter", filter: "artists" });
            return;
          case "4":
            event.preventDefault();
            navigateRef.current(APP_HOME_PATH);
            setCollapsedRef.current(false);
            dispatchLibraryShortcutCommand({ type: "set-filter", filter: "albums" });
            return;
          case "b":
            if (activeTrack) {
              event.preventDefault();
              void toggleLikeRef.current(activeTrack);
            }
            return;
          case "h":
            event.preventDefault();
            navigateRef.current(APP_HOME_PATH);
            return;
          case "j":
            event.preventDefault();
            openRightPanelRef.current("lyrics");
            return;
          case "l":
            event.preventDefault();
            setCollapsedRef.current(!collapsedRef.current);
            return;
          case "m":
            event.preventDefault();
            navigateRef.current("/home-section/recommended");
            return;
          case "n":
            event.preventDefault();
            navigateRef.current("/home-section/newreleases");
            return;
          case "q":
            event.preventDefault();
            openRightPanelRef.current("queue");
            return;
          case "r":
            event.preventDefault();
            toggleRightPanelRef.current();
            return;
          case "s":
            event.preventDefault();
            navigateRef.current("/liked");
            return;
        }
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && normalizedKey === "n") {
        event.preventDefault();
        nextRef.current();
        return;
      }

      if (!event.ctrlKey && !event.metaKey && !event.altKey && event.shiftKey && normalizedKey === "p") {
        event.preventDefault();
        previousRef.current();
        return;
      }

      if (event.key === "<") {
        event.preventDefault();
        setPlaybackSpeedRef.current(getSteppedPlaybackSpeed(activePlaybackSpeed, -1));
        return;
      }

      if (event.key === ">") {
        event.preventDefault();
        setPlaybackSpeedRef.current(getSteppedPlaybackSpeed(activePlaybackSpeed, 1));
        return;
      }

      if (!hasNoModifiers(event)) return;

      switch (event.key) {
        case " ":
        case "k":
        case "K":
          if (activeTrack) {
            event.preventDefault();
            togglePlayRef.current();
          }
          break;
        case "j":
        case "J":
          if (activeTrack) {
            event.preventDefault();
            seekRef.current(Math.max(0, activeCurrentTime - 10));
          }
          break;
        case "l":
        case "L":
          if (activeTrack) {
            event.preventDefault();
            seekRef.current(Math.min(activeDuration, activeCurrentTime + 10));
          }
          break;
        case "ArrowLeft":
          if (activeTrack?.isVideo === true) {
            event.preventDefault();
            seekRef.current(Math.max(0, activeCurrentTime - 5));
          } else if (activeTrack) {
            event.preventDefault();
            void toggleLikeRef.current(activeTrack);
          }
          break;
        case "ArrowRight":
          if (activeTrack?.isVideo === true) {
            event.preventDefault();
            seekRef.current(Math.min(activeDuration, activeCurrentTime + 5));
          } else if (activeTrack) {
            event.preventDefault();
            addToQueueRef.current(activeTrack);
          }
          break;
        case "ArrowUp":
          if (activeTrack?.isVideo === true) {
            event.preventDefault();
            setVolumeRef.current(Math.min(1, activeVolume + 0.05));
          } else {
            event.preventDefault();
            previousRef.current();
          }
          break;
        case "ArrowDown":
          if (activeTrack?.isVideo === true) {
            event.preventDefault();
            setVolumeRef.current(Math.max(0, activeVolume - 0.05));
          } else {
            event.preventDefault();
            nextRef.current();
          }
          break;
        case "m":
        case "M":
          event.preventDefault();
          setVolumeRef.current(activeVolume > 0 ? 0 : (prevVolumeRef.current || 1));
          break;
        case "Home":
          if (activeTrack && activeDuration > 0) {
            event.preventDefault();
            seekRef.current(0);
          }
          break;
        case "End":
          if (activeTrack && activeDuration > 0) {
            event.preventDefault();
            seekRef.current(activeDuration);
          }
          break;
        case ",":
          if (activeTrack?.isVideo === true && !activeIsPlaying) {
            event.preventDefault();
            seekRef.current(Math.max(0, activeCurrentTime - VIDEO_FRAME_STEP_SECONDS));
          }
          break;
        case ".":
          if (activeTrack?.isVideo === true && !activeIsPlaying) {
            event.preventDefault();
            seekRef.current(Math.min(activeDuration, activeCurrentTime + VIDEO_FRAME_STEP_SECONDS));
          }
          break;
        case "c":
        case "C":
          if (activeShowRightPanel && activeRightPanelTab === "lyrics") {
            event.preventDefault();
            setRightPanelOpenRef.current(false);
          } else {
            event.preventDefault();
            openRightPanelRef.current("lyrics");
          }
          break;
        case "t":
        case "T":
          event.preventDefault();
          toggleRightPanelRef.current();
          break;
        case "f":
        case "F":
          event.preventDefault();
          void toggleFullscreenForCurrentMedia(activeTrack?.isVideo === true);
          break;
        case "i":
        case "I":
          if (activeTrack?.isVideo === true) {
            event.preventDefault();
            void togglePictureInPictureForCurrentMedia();
          }
          break;
        case "0":
        case "1":
        case "2":
        case "3":
        case "4":
        case "5":
        case "6":
        case "7":
        case "8":
        case "9":
          if (activeTrack && activeDuration > 0) {
            event.preventDefault();
            const pct = Number.parseInt(event.key, 10) / 10;
            seekRef.current(activeDuration * pct);
          }
          break;
      }

    };

    window.addEventListener("keydown", handler, { capture: true });
    return () => window.removeEventListener("keydown", handler, { capture: true });
  }, []);
}
