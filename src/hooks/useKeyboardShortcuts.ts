import { useEffect, useRef } from "react";
import { usePlayer } from "@/contexts/PlayerContext";
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
  const { togglePlay, next, previous, volume, setVolume, currentTrack, seek, currentTime, duration } = usePlayer();
  const { activeScope } = useTrackSelectionShortcutsContext();
  const prevVolumeRef = useRef(volume);

  useEffect(() => {
    if (volume > 0) prevVolumeRef.current = volume;
  }, [volume]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.defaultPrevented || hasOpenOverlaySurface()) return;

      if (!shouldIgnoreSelectionShortcutTarget(e.target) && activeScope) {
        if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "a") {
          e.preventDefault();
          activeScope.selectAll();
          return;
        }

        if (e.key === "Escape" && activeScope.selectedCount) {
          e.preventDefault();
          activeScope.clearSelection();
          return;
        }

        if ((e.key === "Delete" || e.key === "Backspace") && activeScope.selectedCount) {
          e.preventDefault();
          void activeScope.deleteSelection();
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
          if (currentTrack) togglePlay();
          break;

        // ── Seek backward 10s ──
        case "j":
        case "J":
          e.preventDefault();
          seek(Math.max(0, currentTime - 10));
          break;

        // ── Seek forward 10s ──
        case "l":
        case "L":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            seek(Math.min(duration, currentTime + 10));
          }
          break;

        // ── Seek backward 5s / Ctrl+← previous track ──
        case "ArrowLeft":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            previous();
          } else {
            seek(Math.max(0, currentTime - 5));
          }
          break;

        // ── Seek forward 5s / Ctrl+→ next track ──
        case "ArrowRight":
          e.preventDefault();
          if (e.ctrlKey || e.metaKey) {
            next();
          } else {
            seek(Math.min(duration, currentTime + 5));
          }
          break;

        // ── Volume up 5% ──
        case "ArrowUp":
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.05));
          break;

        // ── Volume down 5% ──
        case "ArrowDown":
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.05));
          break;

        // ── Mute / Unmute ──
        case "m":
        case "M":
          if (!e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            setVolume(volume > 0 ? 0 : (prevVolumeRef.current || 1));
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
          if (!e.ctrlKey && !e.metaKey && !e.altKey && duration > 0) {
            e.preventDefault();
            const pct = Number.parseInt(e.key, 10) / 10;
            seek(duration * pct);
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, next, previous, volume, setVolume, currentTrack, seek, currentTime, duration, activeScope]);
}
