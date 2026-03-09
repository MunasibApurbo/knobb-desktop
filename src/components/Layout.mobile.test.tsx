import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { Layout } from "@/components/Layout";

const layoutMocks = vi.hoisted(() => ({
  player: {
    currentTrack: null as
      | {
          id: string;
          title: string;
          artist: string;
          album: string;
          duration: number;
          year: number;
          coverUrl: string;
          canvasColor: string;
        }
      | null,
    hasPlaybackStarted: true,
    setRightPanelOpen: vi.fn(),
    setRightPanelTab: vi.fn(),
    showRightPanel: false,
  },
}));

vi.mock("@/contexts/PlayerContext", () => ({
  usePlayer: () => layoutMocks.player,
}));

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({ blurEffects: false, showSidebar: true }),
}));

vi.mock("@/hooks/useEmbedMode", () => ({
  useEmbedMode: () => false,
}));

vi.mock("@/hooks/use-mobile", () => ({
  useIsMobile: () => true,
}));

vi.mock("@/hooks/useMainScrollY", () => ({
  useMainScrollY: () => 0,
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    allowShellAmbientMotion: false,
    allowShellDepthMotion: false,
    lowEndDevice: false,
  }),
}));

vi.mock("@/hooks/useKeyboardShortcuts", () => ({
  useKeyboardShortcuts: () => {},
}));

vi.mock("@/hooks/usePlayHistoryRecorder", () => ({
  usePlayHistoryRecorder: () => {},
}));

vi.mock("@/contexts/TrackSelectionShortcutsContext", () => ({
  TrackSelectionShortcutsProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/AppDiagnosticsInbox", () => ({
  AppDiagnosticsInbox: () => <div data-testid="diagnostics-inbox" />,
}));

vi.mock("@/components/MobileNav", () => ({
  MobileNav: () => <nav data-testid="mobile-nav" />,
}));

vi.mock("@/components/mobile/MobileMiniPlayer", () => ({
  MobileMiniPlayer: ({ onOpenPlayer }: { onOpenPlayer: () => void }) => (
    <button type="button" onClick={onOpenPlayer}>
      Open player
    </button>
  ),
}));

vi.mock("@/components/mobile/MobilePlayerSheet", () => ({
  MobilePlayerSheet: ({
    open,
    onOpenChange,
  }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
  }) => (
    <div>
      <span>{open ? "Player sheet open" : "Player sheet closed"}</span>
      {open ? (
        <button type="button" onClick={() => onOpenChange(false)}>
          Close player
        </button>
      ) : null}
    </div>
  ),
}));

vi.mock("@/components/ui/scroll-area", async () => {
  const React = await import("react");

  return {
    ScrollArea: React.forwardRef(function ScrollArea(
      {
        children,
        className,
        viewportProps,
      }: {
        children: ReactNode;
        className?: string;
        viewportProps?: Record<string, string>;
      },
      ref: React.ForwardedRef<HTMLDivElement>,
    ) {
      return (
        <div ref={ref} className={className}>
          <div {...viewportProps}>{children}</div>
        </div>
      );
    }),
  };
});

function renderLayout() {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/"]}
    >
      <Layout>
        <div>Route content</div>
      </Layout>
    </MemoryRouter>,
  );
}

describe("Layout mobile shell", () => {
  beforeEach(() => {
    layoutMocks.player.currentTrack = {
      id: "track-1",
      title: "Midnight City",
      artist: "M83",
      album: "Hurry Up, We're Dreaming",
      duration: 250,
      year: 2011,
      coverUrl: "/cover-midnight-city.jpg",
      canvasColor: "210 80% 56%",
    };
    layoutMocks.player.hasPlaybackStarted = true;
  });

  it("renders the mobile shell with mini player and opens and closes the player sheet", async () => {
    const { container } = renderLayout();

    await screen.findByText("Open player");
    expect(screen.getByTestId("mobile-nav")).toBeInTheDocument();
    expect(screen.getByText("Player sheet closed")).toBeInTheDocument();
    expect(container.querySelector("main")).toHaveClass("mobile-main-content");

    fireEvent.click(screen.getByText("Open player"));

    await waitFor(() => {
      expect(screen.getByText("Player sheet open")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Close player"));

    await waitFor(() => {
      expect(screen.getByText("Player sheet closed")).toBeInTheDocument();
    });
  });

  it("hides the mini player and sheet when no track is active", async () => {
    layoutMocks.player.currentTrack = null;
    layoutMocks.player.hasPlaybackStarted = false;

    renderLayout();

    await waitFor(() => {
      expect(screen.queryByText("Open player")).not.toBeInTheDocument();
    });

    expect(screen.queryByText("Player sheet closed")).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-nav")).toBeInTheDocument();
  });

});
