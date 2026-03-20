import type { ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

import { Layout, useSidebarCollapsed } from "@/components/Layout";

const layoutScrollMocks = vi.hoisted(() => ({
  useSmoothScroll: vi.fn(),
  useDesktopWheelSmoothing: vi.fn(),
}));

const desktopLayoutMocks = vi.hoisted(() => {
  type DesktopLayoutState = {
    currentTrack: {
      id: string;
      title: string;
      artist: string;
      album: string;
      duration: number;
      year: number;
      coverUrl: string;
      canvasColor: string;
    };
    hasPlaybackStarted: boolean;
    isFullScreen: boolean;
    showRightPanel: boolean;
    rightPanelTab: "lyrics" | "queue";
  };

  const baseState = {
    currentTrack: {
      id: "track-1",
      title: "Midnight City",
      artist: "M83",
      album: "Hurry Up, We're Dreaming",
      duration: 250,
      year: 2011,
      coverUrl: "/cover-midnight-city.jpg",
      canvasColor: "210 80% 56%",
    },
    hasPlaybackStarted: true,
    isFullScreen: false,
    showRightPanel: true,
    rightPanelTab: "lyrics" as const,
  };

  let state: DesktopLayoutState = { ...baseState };
  const listeners = new Set<() => void>();

  const emit = () => {
    listeners.forEach((listener) => listener());
  };

  const getSnapshot = () => state;

  return {
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot,
    setRightPanelOpen: vi.fn((open: boolean) => {
      if (state.showRightPanel === open) return;
      state = {
        ...state,
        hasPlaybackStarted: Boolean(state.currentTrack) || state.hasPlaybackStarted,
        showRightPanel: open,
      };
      emit();
    }),
    openRightPanel: vi.fn((tab: "lyrics" | "queue") => {
      state = state.showRightPanel && state.rightPanelTab === tab
        ? {
            ...state,
            hasPlaybackStarted: Boolean(state.currentTrack) || state.hasPlaybackStarted,
            showRightPanel: false,
          }
        : {
            ...state,
            hasPlaybackStarted: Boolean(state.currentTrack) || state.hasPlaybackStarted,
            showRightPanel: true,
            rightPanelTab: tab,
          };
      emit();
    }),
    setRightPanelTab: vi.fn((tab: "lyrics" | "queue") => {
      if (state.rightPanelTab === tab) return;
      state = { ...state, rightPanelTab: tab };
      emit();
    }),
    setFullScreen: vi.fn((isFullScreen: boolean) => {
      if (state.isFullScreen === isFullScreen) return;
      state = { ...state, isFullScreen };
      emit();
    }),
    reset() {
      state = { ...baseState };
      listeners.clear();
      this.setRightPanelOpen.mockClear();
      this.openRightPanel.mockClear();
      this.setRightPanelTab.mockClear();
      this.setFullScreen.mockClear();
    },
  };
});

vi.mock("@/contexts/PlayerContext", async () => {
  const React = await import("react");

  return {
    usePlayer: () => {
      const snapshot = React.useSyncExternalStore(
        desktopLayoutMocks.subscribe,
        desktopLayoutMocks.getSnapshot,
        desktopLayoutMocks.getSnapshot,
      );

      return {
        ...snapshot,
        currentTime: 0,
        isPlaying: true,
        queue: [snapshot.currentTrack],
        addToQueue: vi.fn(),
        next: vi.fn(),
        openRightPanel: desktopLayoutMocks.openRightPanel,
        play: vi.fn(),
        playAlbum: vi.fn(),
        previous: vi.fn(),
        removeFromQueue: vi.fn(),
        reorderQueue: vi.fn(),
        restoreRemoteSession: vi.fn(),
        seek: vi.fn(),
        setCrossfadeDuration: vi.fn(),
        setEqBandGain: vi.fn(),
        setMonoAudioEnabled: vi.fn(),
        setPlaybackSpeed: vi.fn(),
        setPreampDb: vi.fn(),
        setPreservePitch: vi.fn(),
        setQuality: vi.fn(),
        setFullScreen: desktopLayoutMocks.setFullScreen,
        setRightPanelOpen: desktopLayoutMocks.setRightPanelOpen,
        setRightPanelTab: desktopLayoutMocks.setRightPanelTab,
        setSleepTimer: vi.fn(),
        setVolume: vi.fn(),
        startTrackMix: vi.fn(),
        toggleEqualizer: vi.fn(),
        toggleNormalization: vi.fn(),
        togglePlay: vi.fn(),
        toggleRepeat: vi.fn(),
        toggleRightPanel: vi.fn(),
        toggleShuffle: vi.fn(),
      };
    },
  };
});

vi.mock("@/contexts/SettingsContext", () => ({
  useSettings: () => ({
    showSidebar: true,
    libraryOpenState: "expanded" as const,
    animationMode: "full" as const,
  }),
}));

vi.mock("@/hooks/useEmbedMode", () => ({
  useEmbedMode: () => false,
}));

vi.mock("@/hooks/useMotionPreferences", () => ({
  useMotionPreferences: () => ({
    motionEnabled: true,
    allowShellAmbientMotion: false,
    allowShellDepthMotion: false,
    hasHoverCapablePointer: true,
    lowEndDevice: false,
    strongDesktopEffects: true,
  }),
}));

vi.mock("@/hooks/useSmoothScroll", () => ({
  useSmoothScroll: layoutScrollMocks.useSmoothScroll,
}));

vi.mock("@/hooks/useDesktopWheelSmoothing", () => ({
  useDesktopWheelSmoothing: layoutScrollMocks.useDesktopWheelSmoothing,
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
  AppDiagnosticsInbox: () => null,
}));

vi.mock("@/components/AppSidebar", () => ({
  AppSidebar: () => <div data-testid="app-sidebar">Sidebar</div>,
}));

vi.mock("@/components/library/LibraryCollection", () => ({
  LibraryCollection: () => <div data-testid="library-collection">Library Collection</div>,
}));

vi.mock("@/components/RightPanel", () => ({
  RightPanel: () => <aside data-testid="right-panel">Right Panel</aside>,
}));

vi.mock("@/components/BottomPlayer", () => ({
  BottomPlayer: () => (
    <button type="button" onClick={() => desktopLayoutMocks.openRightPanel("queue")}>
      Open queue
    </button>
  ),
}));

vi.mock("@/components/FullScreenPlayer", async () => {
  const React = await import("react");

  return {
    FullScreenPlayer: ({ onExitComplete }: { onExitComplete?: () => void }) => {
      const snapshot = React.useSyncExternalStore(
        desktopLayoutMocks.subscribe,
        desktopLayoutMocks.getSnapshot,
        desktopLayoutMocks.getSnapshot,
      );

      return (
        <div data-testid="fullscreen-player">
          <span>{snapshot.isFullScreen ? "open" : "closing"}</span>
          {!snapshot.isFullScreen ? (
            <button type="button" onClick={onExitComplete}>
              Finish fullscreen exit
            </button>
          ) : null}
        </div>
      );
    },
  };
});

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

vi.mock("@/components/ui/resizable", async () => {
  const React = await import("react");

  type PanelProps = {
    children: ReactNode;
    className?: string;
    collapsible?: boolean;
    collapsedSize?: number;
    defaultSize?: number;
    id?: string;
    onCollapse?: () => void;
    onExpand?: () => void;
    onResize?: (size: number, prevSize: number | undefined) => void;
    style?: React.CSSProperties;
  };

  const ResizablePanel = React.forwardRef(function ResizablePanel(
    { children, className, collapsible = false, collapsedSize = 0, defaultSize = 0, id, onCollapse, onExpand, onResize, style }: PanelProps,
    ref: React.ForwardedRef<{
      collapse: () => void;
      expand: () => void;
      getId: () => string;
      getSize: () => number;
      isCollapsed: () => boolean;
      isExpanded: () => boolean;
      resize: (size: number) => void;
    }>,
  ) {
    const [collapsed, setCollapsed] = React.useState(collapsible && defaultSize <= collapsedSize);
    const sizeRef = React.useRef(collapsible && defaultSize <= collapsedSize ? collapsedSize : defaultSize);
    const expandedSizeRef = React.useRef(
      defaultSize > collapsedSize ? defaultSize : Math.max(defaultSize, collapsedSize + 6),
    );

    React.useEffect(() => {
      if (!collapsible) {
        setCollapsed(false);
      }
    }, [collapsible]);

    const setPanelSize = React.useCallback((nextSize: number) => {
      const previousSize = sizeRef.current;
      if (previousSize === nextSize) return;
      sizeRef.current = nextSize;
      if (nextSize > collapsedSize) {
        expandedSizeRef.current = nextSize;
      }
      onResize?.(nextSize, previousSize);
    }, [collapsedSize, onResize]);

    const setPanelCollapsed = React.useCallback((nextCollapsed: boolean) => {
      if (!collapsible) {
        setCollapsed(false);
        setPanelSize(nextCollapsed ? collapsedSize : expandedSizeRef.current);
        return;
      }

      if (collapsed === nextCollapsed) return;

      setCollapsed(nextCollapsed);
      if (nextCollapsed) {
        onCollapse?.();
        setPanelSize(collapsedSize);
      } else {
        onExpand?.();
        setPanelSize(defaultSize);
      }
    }, [collapsed, collapsedSize, collapsible, defaultSize, onCollapse, onExpand, setPanelSize]);

    React.useImperativeHandle(ref, () => ({
      collapse: () => setPanelCollapsed(true),
      expand: () => setPanelCollapsed(false),
      getId: () => id ?? "panel",
      getSize: () => sizeRef.current,
      isCollapsed: () => collapsed,
      isExpanded: () => !collapsed,
      resize: (size: number) => {
        setPanelSize(size);
        if (collapsible) {
          setPanelCollapsed(size <= collapsedSize);
        } else {
          setCollapsed(false);
        }
      },
    }), [collapsed, collapsedSize, collapsible, id, setPanelCollapsed, setPanelSize]);

    return (
      <div className={className} data-collapsed={collapsed ? "true" : "false"} data-testid={id} style={style}>
        {id === "app-shell-sidebar" ? (
          <div>
            <button type="button" data-testid={`${id}-collapse-trigger`} onClick={() => setPanelCollapsed(true)}>
              Collapse left panel
            </button>
            <button type="button" data-testid={`${id}-expand-trigger`} onClick={() => setPanelCollapsed(false)}>
              Expand left panel
            </button>
            <button type="button" data-testid={`${id}-resize-collapsed-trigger`} onClick={() => {
              setPanelSize(collapsedSize);
            }}>
              Resize left panel to collapsed
            </button>
            <button type="button" data-testid={`${id}-resize-expanded-trigger`} onClick={() => {
              setPanelSize(Math.max(defaultSize, collapsedSize + 6));
            }}>
              Resize left panel to expanded
            </button>
          </div>
        ) : null}
        {id === "app-shell-right-panel" ? (
          <div>
            <button type="button" data-testid={`${id}-collapse-trigger`} onClick={() => setPanelCollapsed(true)}>
              Collapse right panel
            </button>
            <button type="button" data-testid={`${id}-expand-trigger`} onClick={() => setPanelCollapsed(false)}>
              Expand right panel
            </button>
          </div>
        ) : null}
        {children}
      </div>
    );
  });

  return {
    ResizableHandle: ({ className }: { className?: string }) => <div className={className} />,
    ResizablePanel,
    ResizablePanelGroup: ({ children, className }: { children: ReactNode; className?: string }) => (
      <div className={className}>{children}</div>
    ),
  };
});

function SidebarStateProbe() {
  const { collapsed } = useSidebarCollapsed();

  return <div data-testid="sidebar-state">{collapsed ? "collapsed" : "expanded"}</div>;
}

function renderLayout() {
  return render(
    <MemoryRouter
      future={{ v7_relativeSplatPath: true, v7_startTransition: true }}
      initialEntries={["/"]}
    >
      <Layout>
        <SidebarStateProbe />
      </Layout>
    </MemoryRouter>,
  );
}

describe("Layout desktop shell", () => {
  beforeEach(() => {
    desktopLayoutMocks.reset();
    layoutScrollMocks.useSmoothScroll.mockClear();
    layoutScrollMocks.useDesktopWheelSmoothing.mockClear();
    const storage = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => storage.get(key) ?? null,
        setItem: (key: string, value: string) => {
          storage.set(key, value);
        },
        removeItem: (key: string) => {
          storage.delete(key);
        },
      },
    });
    window.innerWidth = 1600;
    window.innerHeight = 1000;
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        availWidth: 1600,
        width: 1600,
        availHeight: 1000,
        height: 1000,
      },
    });
  });

  it("keeps the left sidebar state unchanged when the right panel collapses and reopens", async () => {
    renderLayout();

    expect(screen.getByTestId("bottom-player-dock")).toHaveClass("fixed", "inset-x-0", "bottom-0");
    expect(document.querySelector("main")).toHaveClass("page-main-content");
    expect(screen.getByTestId("app-shell-main")).toBeInTheDocument();

    await screen.findByTestId("right-panel");
    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");

    act(() => {
      desktopLayoutMocks.setRightPanelOpen(false);
    });

    await waitFor(() => {
      expect(screen.queryByTestId("right-panel")).not.toBeInTheDocument();
    });

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");

    fireEvent.click(screen.getByText("Open queue"));

    await waitFor(() => {
      expect(screen.getByTestId("right-panel")).toBeInTheDocument();
    });

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
  });

  it("keeps the right panel open when the resizer reports an incidental collapse", async () => {
    renderLayout();

    await screen.findByTestId("right-panel");

    fireEvent.click(screen.getByTestId("app-shell-right-panel-collapse-trigger"));

    await waitFor(() => {
      expect(desktopLayoutMocks.getSnapshot().showRightPanel).toBe(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId("right-panel")).toBeInTheDocument();
    });
    expect(desktopLayoutMocks.setRightPanelOpen).not.toHaveBeenCalledWith(false);
    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
  });

  it("collapses the left sidebar into the compact rail and expands it back", async () => {
    renderLayout();

    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");

    fireEvent.click(screen.getByTestId("app-shell-sidebar-collapse-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
    });

    fireEvent.click(screen.getByTestId("app-shell-sidebar-expand-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
    });
  });

  it("keeps the fullscreen player mounted until its close animation finishes", async () => {
    renderLayout();

    act(() => {
      desktopLayoutMocks.setFullScreen(true);
    });

    await waitFor(() => {
      expect(screen.getByTestId("fullscreen-player")).toHaveTextContent("open");
    });

    act(() => {
      desktopLayoutMocks.setFullScreen(false);
    });

    expect(screen.getByTestId("fullscreen-player")).toHaveTextContent("closing");

    fireEvent.click(screen.getByRole("button", { name: "Finish fullscreen exit" }));

    await waitFor(() => {
      expect(screen.queryByTestId("fullscreen-player")).not.toBeInTheDocument();
    });
  });

  it("switches to the compact rail when the left panel is resized down to the collapsed width", async () => {
    renderLayout();

    fireEvent.click(screen.getByTestId("app-shell-sidebar-resize-collapsed-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
    });
  });

  it("lets the user drag the compact left sidebar back out of compact mode", async () => {
    window.innerWidth = 1400;
    renderLayout();

    fireEvent.click(screen.getByTestId("app-shell-sidebar-resize-collapsed-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
    });

    expect(screen.getByTestId("app-shell-sidebar")).toHaveAttribute("data-collapsed", "false");

    fireEvent.click(screen.getByTestId("app-shell-sidebar-resize-expanded-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
    });
  });

  it("keeps the left sidebar expandable on a 720p display", async () => {
    window.innerWidth = 1280;
    window.innerHeight = 720;
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        availWidth: 1280,
        width: 1280,
        availHeight: 720,
        height: 720,
      },
    });

    const { container } = renderLayout();

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
    });

    const shell = container.querySelector("[data-shell-density]");
    expect(shell).toHaveAttribute("data-shell-density", "comfortable");
    expect(shell).toHaveAttribute("data-shell-height", "tall");
    expect(Number(shell?.getAttribute("style")?.match(/--app-ui-scale:\s*([0-9.]+)/)?.[1] ?? 0)).toBeGreaterThanOrEqual(0.76);

    fireEvent.click(screen.getByTestId("app-shell-sidebar-resize-collapsed-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
    });

    fireEvent.click(screen.getByTestId("app-shell-sidebar-resize-expanded-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
    });
  });

  it("preserves the user's sidebar choice when a desktop window drops to 720p", async () => {
    renderLayout();

    fireEvent.click(screen.getByTestId("app-shell-sidebar-collapse-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
    });

    act(() => {
      window.innerWidth = 1280;
      window.innerHeight = 720;
      Object.defineProperty(window, "screen", {
        configurable: true,
        value: {
          availWidth: 1280,
          width: 1280,
          availHeight: 720,
          height: 720,
        },
      });
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
    });

    fireEvent.click(screen.getByTestId("app-shell-sidebar-expand-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
    });
  });

  it("keeps the left sidebar expanded after leaving compact desktop mode", async () => {
    window.innerWidth = 1400;
    renderLayout();

    fireEvent.click(screen.getByTestId("app-shell-sidebar-resize-collapsed-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("collapsed");
    });

    fireEvent.click(screen.getByTestId("app-shell-sidebar-resize-expanded-trigger"));

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
    });

    act(() => {
      window.innerWidth = 1600;
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
    });
  });

  it("does not force the shell into compact height mode on a 720p display with browser chrome", async () => {
    window.innerWidth = 1280;
    window.innerHeight = 640;
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        availWidth: 1280,
        width: 1280,
        availHeight: 680,
        height: 720,
      },
    });

    const { container } = renderLayout();

    await screen.findByTestId("right-panel");

    const shell = container.querySelector("[data-shell-density]");
    expect(shell).toHaveAttribute("data-shell-density", "compact");
    expect(shell).toHaveAttribute("data-shell-height", "medium");
    expect(Number(shell?.getAttribute("style")?.match(/--app-ui-scale:\s*([0-9.]+)/)?.[1] ?? 0)).toBeGreaterThanOrEqual(0.68);
  });

  it("treats taller-display browser chrome as a medium-height desktop shell", async () => {
    window.innerWidth = 1280;
    window.innerHeight = 654;
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        availWidth: 1512,
        width: 1512,
        availHeight: 874,
        height: 982,
      },
    });

    const { container } = renderLayout();

    await screen.findByTestId("right-panel");

    const shell = container.querySelector("[data-shell-density]");
    expect(shell).toHaveAttribute("data-shell-density", "compact");
    expect(shell).toHaveAttribute("data-shell-height", "medium");
  });

  it("undocks the right panel in narrow windows and restores it after expanding again", async () => {
    renderLayout();

    await screen.findByTestId("right-panel");

    act(() => {
      window.innerWidth = 560;
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(screen.queryByTestId("right-panel")).not.toBeInTheDocument();
    });
    expect(screen.queryByTestId("desktop-shell-workspace")).not.toBeInTheDocument();
    expect(desktopLayoutMocks.getSnapshot().showRightPanel).toBe(true);

    act(() => {
      window.innerWidth = 1600;
      window.dispatchEvent(new Event("resize"));
    });

    await waitFor(() => {
      expect(screen.getByTestId("right-panel")).toBeInTheDocument();
    });
    expect(desktopLayoutMocks.getSnapshot().showRightPanel).toBe(true);
  });

  it("keeps the desktop shell active on narrow viewports", async () => {
    window.innerWidth = 720;
    window.innerHeight = 1280;
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        availWidth: 720,
        width: 720,
        availHeight: 1280,
        height: 1280,
      },
    });

    const { container } = renderLayout();

    await waitFor(() => {
      expect(screen.getByTestId("app-sidebar")).toBeInTheDocument();
    });

    expect(screen.queryByTestId("desktop-shell-workspace")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation", { name: "Primary" })).not.toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: "Now playing panel" })).not.toBeInTheDocument();

    const shell = container.querySelector("[data-shell-width]");
    expect(shell).toHaveAttribute("data-shell-width", "full");
    expect(screen.getByTestId("sidebar-state")).toHaveTextContent("expanded");
  });

  it("keeps smooth scrolling enabled on narrow viewports", async () => {
    window.innerWidth = 720;
    window.innerHeight = 1280;
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        availWidth: 720,
        width: 720,
        availHeight: 1280,
        height: 1280,
      },
    });

    renderLayout();

    expect(layoutScrollMocks.useSmoothScroll).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      lerp: 0.18,
      startDelay: 0,
      wheelMultiplier: 0.84,
      wrapperRef: expect.any(Object),
      contentRef: expect.any(Object),
    }));
    expect(layoutScrollMocks.useDesktopWheelSmoothing).toHaveBeenCalledWith(expect.objectContaining({
      enabled: false,
      viewportRef: expect.any(Object),
    }));
  });

  it("enables smooth scrolling for the desktop shell", async () => {
    window.innerWidth = 1600;
    window.innerHeight = 980;
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        availWidth: 2560,
        width: 2560,
        availHeight: 1440,
        height: 1440,
      },
    });

    renderLayout();

    expect(layoutScrollMocks.useSmoothScroll).toHaveBeenCalledWith(expect.objectContaining({
      enabled: true,
      lerp: 0.18,
      startDelay: 0,
      wheelMultiplier: 0.84,
      wrapperRef: expect.any(Object),
      contentRef: expect.any(Object),
    }));
    expect(layoutScrollMocks.useDesktopWheelSmoothing).toHaveBeenCalledWith(expect.objectContaining({
      enabled: false,
      viewportRef: expect.any(Object),
    }));
  });

  it("keeps a 1080p-class viewport in the full desktop shell on a larger display", async () => {
    window.innerWidth = 1920;
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        availWidth: 3840,
        width: 3840,
      },
    });

    const { container } = renderLayout();

    await screen.findByTestId("right-panel");

    const shell = container.querySelector("[data-shell-width]");
    expect(shell).toHaveAttribute("data-shell-width", "full");
    expect(shell).toHaveAttribute("data-shell-density", "comfortable");
  });

  it("still treats a truly narrower snapped window on a large display as a half-width shell", async () => {
    window.innerWidth = 1440;
    Object.defineProperty(window, "screen", {
      configurable: true,
      value: {
        availWidth: 3840,
        width: 3840,
      },
    });

    const { container } = renderLayout();

    await screen.findByTestId("right-panel");

    const shell = container.querySelector("[data-shell-width]");
    expect(shell).toHaveAttribute("data-shell-width", "half");
    expect(shell).toHaveAttribute("data-shell-density", "dense");
  });
});
