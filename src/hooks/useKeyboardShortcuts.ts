import { useEffect, useRef } from "react";
import { usePlayer, usePlayerTimeline } from "@/contexts/PlayerContext";
import { useTrackSelectionShortcutsContext } from "@/contexts/TrackSelectionShortcutsContext";

const EDITABLE_TARGET_SELECTOR = [
  "input",
  "textarea",
  "select",
  "[contenteditable='']",
  "[contenteditable='true']",
  "[role='textbox']",
].join(", ");

const INTERACTIVE_TARGET_SELECTOR = [
  "button",
  "a[href]",
  "summary",
  "[role='checkbox']",
  "[role='combobox']",
  "[role='link']",
  "[role='menuitem']",
  "[role='option']",
  "[role='radio']",
  "[role='slider']",
  "[role='switch']",
  "[role='tab']",
].join(", ");

const ALLOW_GLOBAL_SHORTCUTS_SELECTOR = "[data-allow-global-shortcuts='true']";

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

function isEditableShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return target.closest(EDITABLE_TARGET_SELECTOR) !== null;
}

function isAllowedGlobalShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return target.closest(ALLOW_GLOBAL_SHORTCUTS_SELECTOR) !== null;
}

function isBlockedInteractiveShortcutTarget(target: EventTarget | null) {
  if (!(target instanceof Element)) return false;

  return target.closest(INTERACTIVE_TARGET_SELECTOR) !== null;
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

  if (isAllowedGlobalShortcutTarget(target)) {
    return false;
  }

  return isBlockedInteractiveShortcutTarget(target) || isOverlayShortcutTarget(target);
}

function hasOpenOverlaySurface() {
  return document.querySelector(OPEN_OVERLAY_SELECTOR) !== null;
}

export function useKeyboardShortcuts() {
  const { togglePlay, next, previous, volume, setVolume, currentTrack, seek } = usePlayer();
  const { currentTime, duration } = usePlayerTimeline();
  const { activeScope } = useTrackSelectionShortcutsContext();
  const activeScopeRef = useRef(activeScope);
  const currentTimeRef = useRef(currentTime);
  const currentTrackRef = useRef(currentTrack);
  const durationRef = useRef(duration);
  const nextRef = useRef(next);
  const previousRef = useRef(previous);
  const prevVolumeRef = useRef(volume);
  const seekRef = useRef(seek);
  const setVolumeRef = useRef(setVolume);
  const togglePlayRef = useRef(togglePlay);
  const volumeRef = useRef(volume);

  useEffect(() => {
    activeScopeRef.current = activeScope;
    currentTimeRef.current = currentTime;
    currentTrackRef.current = currentTrack;
    durationRef.current = duration;
    nextRef.current = next;
    previousRef.current = previous;
    seekRef.current = seek;
    setVolumeRef.current = setVolume;
    togglePlayRef.current = togglePlay;
    volumeRef.current = volume;
  }, [activeScope, currentTime, currentTrack, duration, next, previous, seek, setVolume, togglePlay, volume]);

  useEffect(() => {
    if (volume > 0) prevVolumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || hasOpenOverlaySurface()) return;

      const activeSelectionScope = activeScopeRef.current;
      const activeDuration = durationRef.current;
      const activeCurrentTime = currentTimeRef.current;
      const activeTrack = currentTrackRef.current;
      const activeVolume = volumeRef.current;

      if (!shouldIgnoreSelectionShortcutTarget(e.target) && activeSelectionScope) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
          e.preventDefault();
          activeSelectionScope.selectAll();
          return;
        }

        if (e.key === "Escape" && activeSelectionScope.selectedCount) {
          e.preventDefault();
          activeSelectionScope.clearSelection();
          return;
        }

        if ((e.key === "Delete" || e.key === "Backspace") && activeSelectionScope.selectedCount) {
          e.preventDefault();
          void activeSelectionScope.deleteSelection();
          return;
        }
      }

      if (shouldIgnoreGlobalShortcutTarget(e.target)) return;

      switch (e.key) {
        // ── Play / Pause ──
        case " ":
        case "k":
        case "K":
          e.preventDefault();
          if (activeTrack) togglePlayRef.current();
          break;

        // ── Seek backward 10s ──
        case "j":
        case "J":
          e.preventDefault();
          seekRef.current(Math.max(0, activeCurrentTime - 10));
          break;

        // ── Seek forward 10s ──
        case "l":
        case "L":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            seekRef.current(Math.min(activeDuration, activeCurrentTime + 10));
          }
          break;

        // ── Seek backward 5s / Ctrl+← previous track ──
        case "ArrowLeft":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            previousRef.current();
          } else {
            seekRef.current(Math.max(0, activeCurrentTime - 5));
          }
          break;

        // ── Seek forward 5s / Ctrl+→ next track ──
        case "ArrowRight":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            nextRef.current();
          } else {
            seekRef.current(Math.min(activeDuration, activeCurrentTime + 5));
          }
          break;

        // ── Volume up 5% ──
        case "ArrowUp":
          e.preventDefault();
          setVolumeRef.current(Math.min(1, activeVolume + 0.05));
          break;

        // ── Volume down 5% ──
        case "ArrowDown":
          e.preventDefault();
          setVolumeRef.current(Math.max(0, activeVolume - 0.05));
          break;

        // ── Mute / Unmute ──
        case "m":
        case "M":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setVolumeRef.current(activeVolume > 0 ? 0 : (prevVolumeRef.current || 1));
          }
          break;

        // ── Jump to percentage (0-9) ──
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
          if (!e.ctrlKey && !e.metaKey && !e.altKey && activeDuration > 0) {
            e.preventDefault();
            const pct = Number.parseInt(e.key, 10) / 10;
            seekRef.current(activeDuration * pct);
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);
}
