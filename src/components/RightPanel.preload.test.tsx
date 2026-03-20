import { act } from "react";
import { createRoot, type Root } from "react-dom/client";

const rightPanelPreloadState = vi.hoisted(() => ({
  rightPanelTab: "queue" as "queue" | "lyrics",
  preloadLyricsForTrack: vi.fn(),
}));

vi.mock("framer-motion", async () => {
  const React = await import("react");

  return {
    motion: {
      button: React.forwardRef<HTMLButtonElement, React.ButtonHTMLAttributes<HTMLButtonElement>>(function MotionButton(
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
        return <button ref={ref} {...domProps as React.ButtonHTMLAttributes<HTMLButtonElement>}>{children}</button>;
      }),
      div: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(function MotionDiv(
        { children, ...props },
        ref,
      ) {
        return <div ref={ref} {...props}>{children}</div>;
      }),
      h3: React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(function MotionHeading(
        { children, ...props },
        ref,
      ) {
        return <h3 ref={ref} {...props}>{children}</h3>;
      }),
      p: React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(function MotionParagraph(
        { children, ...props },
        ref,
      ) {
        return <p ref={ref} {...props}>{children}</p>;
      }),
    },
  };
});

vi.mock("react-router-dom", () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" {...props}>{children}</button>
  ),
}));

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children, className }: { children: React.ReactNode; className?: string }) => (
    <div className={className}>{children}</div>
  ),
}));

vi.mock("@/components/ArtistLink", () => ({
  ArtistLink: ({ name }: { name: string }) => <span>{name}</span>,
}));

vi.mock("@/components/AddToPlaylistMenu", () => ({
  AddToPlaylistMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/TrackContextMenu", () => ({
  TrackContextMenu: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/TrackOptionsMenu", () => ({
  TrackOptionsMenu: () => <button type="button">Options</button>,
}));

vi.mock("@/components/LyricsPanel", () => ({
  LyricsPanel: () => <div>Lyrics Panel</div>,
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
    currentTrack: {
      id: "track-1",
      title: "Track One",
      artist: "Artist",
      artists: [{ id: 1, name: "Artist" }],
      artistId: 1,
      coverUrl: "/cover.jpg",
      duration: 245,
      isVideo: false,
    },
    toggleRightPanel: vi.fn(),
    rightPanelTab: rightPanelPreloadState.rightPanelTab,
    isPlaying: true,
    queue: [{
      id: "track-1",
      title: "Track One",
      artist: "Artist",
      artists: [{ id: 1, name: "Artist" }],
      artistId: 1,
      coverUrl: "/cover.jpg",
      duration: 245,
      isVideo: false,
    }],
    play: vi.fn(),
    reorderQueue: vi.fn(),
    removeFromQueue: vi.fn(),
    seek: vi.fn(),
    toggleFullScreen: vi.fn(),
  }),
  usePlayerTimeline: () => ({
    currentTime: 30,
    duration: 245,
  }),
}));

vi.mock("@/lib/audioEngine", () => ({
  getAudioEngine: () => ({
    getMediaElement: () => null,
    returnMediaElementToGlobalHost: vi.fn(),
  }),
}));

vi.mock("@/lib/trackArtwork", () => ({
  getTrackArtworkUrl: () => "/cover.jpg",
}));

vi.mock("@/lib/lyricsPanelData", () => ({
  preloadLyricsForTrack: rightPanelPreloadState.preloadLyricsForTrack,
}));

vi.mock("@/lib/utils", () => ({
  formatDuration: (value: number) => `${value}s`,
}));

import { RightPanel } from "@/components/RightPanel";

describe("RightPanel lyric preloading", () => {
  let container: HTMLDivElement;
  let root: Root;
  let previousActEnvironment: boolean | undefined;

  beforeAll(() => {
    previousActEnvironment = (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT;
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  afterAll(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
  });

  beforeEach(() => {
    rightPanelPreloadState.rightPanelTab = "queue";
    rightPanelPreloadState.preloadLyricsForTrack.mockReset();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it("does not preload lyrics while the queue tab is visible", async () => {
    await act(async () => {
      root.render(<RightPanel />);
    });

    await act(async () => {
      await Promise.resolve();
    });

    expect(rightPanelPreloadState.preloadLyricsForTrack).not.toHaveBeenCalled();
  });

});
