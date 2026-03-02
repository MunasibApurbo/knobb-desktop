import { useEffect } from "react";
import { usePlayer } from "@/contexts/PlayerContext";

export function useKeyboardShortcuts() {
  const { togglePlay, next, previous, volume, setVolume, currentTrack } = usePlayer();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) return;

      switch (e.key) {
        case " ":
          e.preventDefault();
          if (currentTrack) togglePlay();
          break;
        case "ArrowRight":
          if (e.shiftKey) {
            e.preventDefault();
            next();
          }
          break;
        case "ArrowLeft":
          if (e.shiftKey) {
            e.preventDefault();
            previous();
          }
          break;
        case "ArrowUp":
          if (e.shiftKey) {
            e.preventDefault();
            setVolume(Math.min(1, volume + 0.05));
          }
          break;
        case "ArrowDown":
          if (e.shiftKey) {
            e.preventDefault();
            setVolume(Math.max(0, volume - 0.05));
          }
          break;
        case "m":
        case "M":
          if (!e.ctrlKey && !e.metaKey) {
            setVolume(volume > 0 ? 0 : 0.75);
          }
          break;
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [togglePlay, next, previous, volume, setVolume, currentTrack]);
}
