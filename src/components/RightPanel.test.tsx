import type { ButtonHTMLAttributes, ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";

import { RightPanel } from "@/components/RightPanel";

const sharedVideoElement = document.createElement("video");
const rightPanelTestState = vi.hoisted(() => ({
  playbackMode: "native" as "native" | "youtube-embed",
  rightPanelTab: "queue" as "queue" | "lyrics",
  toggleRightPanel: vi.fn(),
  openRightPanel: vi.fn(),
  toggleFullScreen: vi.fn(),
  currentTrack: {
    id: "video-1",
    title: "Video Track",
    artist: "Artist",
    artists: [{ id: 1, name: "Artist" }],
    artistId: 1,
    coverUrl: "/cover.jpg",
    duration: 245,
    source: "tidal" as const,
    isVideo: true,
  },
  preloadLyricsForTrack: vi.fn(),
  attachMediaElementToHost: vi.fn((host: HTMLElement) => {
    host.appendChild(sharedVideoElement);
  }),
  isMediaElementAttachedToHost: vi.fn((host: HTMLElement) => sharedVideoElement.parentElement === host),
  returnMediaElementToGlobalHost: vi.fn(),
  embedAttachHost: vi.fn(),
  embedIsAttachedToHost: vi.fn(() => false),
  embedReturnToGlobalHost: vi.fn(),
}));

let readyStateValue = 4;
let videoWidthValue = 1920;
let videoHeightValue = 1080;
Object.defineProperty(sharedVideoElement, "readyState", {
  configurable: true,
  get: () => readyStateValue,
});
Object.defineProperty(sharedVideoElement, "videoWidth", {
  configurable: true,
  get: () => videoWidthValue,
});
Object.defineProperty(sharedVideoElement, "videoHeight", {
  configurable: true,
  get: () => videoHeightValue,
});

vi.mock("framer-motion", async () => {
  const React = await import("react");

  const createMockMotionComponent = (tag: keyof JSX.IntrinsicElements) =>
    React.forwardRef<HTMLElement, React.HTMLAttributes<HTMLElement>>(function MockMotionComponent(
      { children, ...props },
      ref,
    ) {
      const { animate, exit, initial, layout, layoutId, transition, variants, ...domProps } = props as Record<string, unknown>;
      void animate;
      void exit;
      void initial;
      void layout;
      void layoutId;
      void transition;
      void variants;
      return React.createElement(tag, { ...domProps, ref }, children);
    });

  return {
    motion: {
      div: createMockMotionComponent("div"),
      button: createMockMotionComponent("button"),
      h3: createMockMotionComponent("h3"),
      p: createMockMotionComponent("p"),
    },
  };
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ArtistLink", () => ({
  ArtistLink: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/AddToPlaylistMenu", () => ({
  AddToPlaylistMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/TrackContextMenu", () => ({
  TrackContextMenu: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/TrackOptionsMenu", () => ({
  TrackOptionsMenu: () => <button type="button">Options</button>,
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    rightPanelStyle: "artwork",
    lyricsSyncMode: "follow",
  }),
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    allowHeavyBlur: true,
    allowShellAmbientMotion: false,
  }),
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => ({
    currentTrack: rightPanelTestState.currentTrack,
    playbackMode: rightPanelTestState.playbackMode,
    toggleRightPanel: rightPanelTestState.toggleRightPanel,
    openRightPanel: rightPanelTestState.openRightPanel,
    rightPanelTab: rightPanelTestState.rightPanelTab,
    isPlaying: true,
    queue: [rightPanelTestState.currentTrack],
    play: vi.fn(),
    reorderQueue: vi.fn(),
    removeFromQueue: vi.fn(),
    seek: vi.fn(),
    toggleFullScreen: rightPanelTestState.toggleFullScreen,
  }),
  usePlayerTimeline: () => ({
    currentTime: 30,
    duration: 245,
  }),
}));

vi.mock("@/lib/lyricsPanelData", () => ({
  preloadLyricsForTrack: rightPanelTestState.preloadLyricsForTrack,
}));

vi.mock("@/lib/utils", () => ({
  formatDuration: (value: number) => `${value}s`,
}));

vi.mock("@/lib/audioEngine", () => ({
  getAudioEngine: () => ({
    getMediaElement: () => sharedVideoElement,
    attachMediaElementToHost: rightPanelTestState.attachMediaElementToHost,
    isMediaElementAttachedToHost: rightPanelTestState.isMediaElementAttachedToHost,
    returnMediaElementToGlobalHost: rightPanelTestState.returnMediaElementToGlobalHost,
  }),
}));

vi.mock("@/lib/youtubeEmbedManager", () => ({
  getYoutubeEmbedManager: () => ({
    attachHost: rightPanelTestState.embedAttachHost,
    isAttachedToHost: rightPanelTestState.embedIsAttachedToHost,
    returnToGlobalHost: rightPanelTestState.embedReturnToGlobalHost,
  }),
}));

describe("RightPanel", () => {
  beforeAll(() => {
    Object.defineProperty(window, "PointerEvent", {
      configurable: true,
      value: MouseEvent,
    });
  });

  beforeEach(() => {
    readyStateValue = 4;
    videoWidthValue = 1920;
    videoHeightValue = 1080;
    rightPanelTestState.playbackMode = "native";
    rightPanelTestState.rightPanelTab = "queue";
    rightPanelTestState.toggleRightPanel.mockReset();
    rightPanelTestState.openRightPanel.mockReset();
    rightPanelTestState.toggleFullScreen.mockReset();
    rightPanelTestState.currentTrack = {
      id: "video-1",
      title: "Video Track",
      artist: "Artist",
      artists: [{ id: 1, name: "Artist" }],
      artistId: 1,
      coverUrl: "/cover.jpg",
      duration: 245,
      source: "tidal",
      isVideo: true,
    };
    rightPanelTestState.preloadLyricsForTrack.mockReset();
    rightPanelTestState.attachMediaElementToHost.mockClear();
    rightPanelTestState.isMediaElementAttachedToHost.mockClear();
    rightPanelTestState.returnMediaElementToGlobalHost.mockClear();
    rightPanelTestState.embedAttachHost.mockClear();
    rightPanelTestState.embedIsAttachedToHost.mockClear();
    rightPanelTestState.embedReturnToGlobalHost.mockClear();
    sharedVideoElement.className = "";
    sharedVideoElement.poster = "";
    sharedVideoElement.remove();
    sharedVideoElement.removeAttribute("muted");
    sharedVideoElement.muted = false;
  });

  it("reuses the active engine video element instead of creating a second muted preview", async () => {
    const { container } = render(<RightPanel />);

    await waitFor(() => {
      expect(container.querySelector(".right-panel-artwork video")).toBe(sharedVideoElement);
    });

    expect(sharedVideoElement).toHaveClass("pointer-events-none", "h-full", "w-full", "bg-black", "object-contain");
    expect(sharedVideoElement.poster).toContain("/cover.jpg");
    expect(sharedVideoElement.muted).toBe(false);
    expect(sharedVideoElement.hasAttribute("muted")).toBe(false);
    expect(container.querySelector(".right-panel-artwork .pointer-events-none.relative.h-full.w-full.bg-black")).toBeInTheDocument();
  });

  it("keeps the fullscreen artwork trigger keyboard accessible", () => {
    render(<RightPanel />);

    expect(screen.getByRole("button", { name: /open full screen player/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /close now playing panel/i })).toBeInTheDocument();
    expect(document.querySelector(".right-panel-shell-artwork-wash")).toBeInTheDocument();
  });

  it("keeps the shared video mounted without showing a buffering badge", async () => {
    const { container } = render(<RightPanel />);

    await waitFor(() => {
      expect(container.querySelector(".right-panel-artwork video")).toBe(sharedVideoElement);
    });

    act(() => {
      readyStateValue = 1;
      sharedVideoElement.dispatchEvent(new Event("waiting"));
    });

    expect(container.textContent).not.toContain("Buffering video");

    act(() => {
      readyStateValue = 4;
      sharedVideoElement.dispatchEvent(new Event("canplay"));
    });

    expect(container.querySelector(".right-panel-artwork video")).toBe(sharedVideoElement);
  });

  it("keeps artwork visible over the host until a real video frame is ready", async () => {
    readyStateValue = 0;
    videoWidthValue = 0;
    videoHeightValue = 0;

    const { container } = render(<RightPanel />);

    await waitFor(() => {
      expect(container.querySelector(".right-panel-artwork video")).toBe(sharedVideoElement);
    });

    const fallbackArtwork = container.querySelector('.right-panel-artwork img[aria-hidden="true"]');
    expect(fallbackArtwork).toHaveClass("opacity-100");

    act(() => {
      readyStateValue = 4;
      videoWidthValue = 1920;
      videoHeightValue = 1080;
      sharedVideoElement.dispatchEvent(new Event("loadeddata"));
      sharedVideoElement.dispatchEvent(new Event("canplay"));
    });

    expect(fallbackArtwork).toHaveClass("opacity-0");
  });

  it("does not preload lyrics while the queue tab is showing", async () => {
    render(<RightPanel />);

    await act(async () => {
      await Promise.resolve();
    });

    expect(rightPanelTestState.preloadLyricsForTrack).not.toHaveBeenCalled();
  });

  it("preloads lyrics only after the lyrics tab is opened", async () => {
    rightPanelTestState.rightPanelTab = "lyrics";

    render(<RightPanel />);

    await waitFor(() => {
      expect(rightPanelTestState.preloadLyricsForTrack).toHaveBeenCalledTimes(1);
    });
  });

  it("attaches the YouTube embed host instead of reusing the native video element in embed mode", async () => {
    rightPanelTestState.playbackMode = "youtube-embed";
    rightPanelTestState.currentTrack = {
      ...rightPanelTestState.currentTrack,
      source: "youtube-music",
      sourceId: "video-1",
    };
    rightPanelTestState.embedIsAttachedToHost.mockReturnValue(true);

    const { unmount } = render(<RightPanel />);

    await waitFor(() => {
      expect(rightPanelTestState.embedAttachHost).toHaveBeenCalledTimes(1);
    });

    expect(rightPanelTestState.attachMediaElementToHost).not.toHaveBeenCalled();
    expect(rightPanelTestState.embedAttachHost.mock.calls[0]?.[0]).toBeInstanceOf(HTMLDivElement);

    unmount();

    expect(rightPanelTestState.embedReturnToGlobalHost).toHaveBeenCalledTimes(1);
  });

  it("shows the YouTube embed surface for published-host YT tracks even when the track is not flagged as a native video", async () => {
    rightPanelTestState.playbackMode = "youtube-embed";
    rightPanelTestState.currentTrack = {
      ...rightPanelTestState.currentTrack,
      id: "yt-audio-1",
      title: "YT Audio Track",
      source: "youtube-music",
      sourceId: "yt-audio-1",
      isVideo: false,
    };
    rightPanelTestState.embedIsAttachedToHost.mockReturnValue(true);

    const { container } = render(<RightPanel />);

    await waitFor(() => {
      expect(rightPanelTestState.embedAttachHost).toHaveBeenCalledTimes(1);
    });

    expect(container.querySelector(".right-panel-artwork")).not.toHaveClass("aspect-square");
    expect(rightPanelTestState.attachMediaElementToHost).not.toHaveBeenCalled();
  });

  it("does not return the video to the global host if another surface already claimed it", async () => {
    const { container, unmount } = render(<RightPanel />);

    await waitFor(() => {
      expect(container.querySelector(".right-panel-artwork video")).toBe(sharedVideoElement);
    });

    const nextHost = document.createElement("div");
    nextHost.appendChild(sharedVideoElement);

    unmount();

    expect(rightPanelTestState.returnMediaElementToGlobalHost).not.toHaveBeenCalled();
  });
});
