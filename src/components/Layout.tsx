import { usePlayer } from "@/contexts/PlayerContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { usePlayHistoryRecorder } from "@/hooks/usePlayHistoryRecorder";
import { useEmbedMode } from "@/hooks/useEmbedMode";
import { useIsMobile } from "@/hooks/use-mobile";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { TrackSelectionShortcutsProvider } from "@/contexts/TrackSelectionShortcutsContext";
import { AuthContext } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { lazy, Suspense, useState, useCallback, useEffect, useRef, createContext, useContext } from "react";
import { APP_HOME_PATH } from "@/lib/routes";
import { BackToTopButton } from "@/components/BackToTopButton";

const LazyLayoutDesktopShell = lazy(async () => {
  const module = await import("@/components/LayoutDesktopShell");
  return { default: module.LayoutDesktopShell };
});

const LazyMobileNav = lazy(async () => {
  const module = await import("@/components/MobileNav");
  return { default: module.MobileNav };
});

const LazyMobileTopBar = lazy(async () => {
  const module = await import("@/components/mobile/MobileTopBar");
  return { default: module.MobileTopBar };
});

const LazyMobileMiniPlayer = lazy(async () => {
  const module = await import("@/components/mobile/MobileMiniPlayer");
  return { default: module.MobileMiniPlayer };
});

const LazyMobilePlayerSheet = lazy(async () => {
  const module = await import("@/components/mobile/MobilePlayerSheet");
  return { default: module.MobilePlayerSheet };
});

const LazyBottomPlayer = lazy(async () => {
  const module = await import("@/components/BottomPlayer");
  return { default: module.BottomPlayer };
});

const LazyAppDiagnosticsInbox = lazy(async () => {
  const module = await import("@/components/AppDiagnosticsInbox");
  return { default: module.AppDiagnosticsInbox };
});

const LAST_ROUTE_KEY = "last-route";
const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
const COLLAPSED_SIDEBAR_WIDTH_PX = 84;

function readStoredBoolean(key: string, fallback = false) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value === null ? fallback : value === "true";
  } catch {
    return fallback;
  }
}

function readStoredRoute() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(LAST_ROUTE_KEY);
  } catch {
    return null;
  }
}

function writeStoredValue(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage failures.
  }
}

interface SidebarContextType {
  collapsed: boolean;
  setCollapsed: (v: boolean) => void;
  expandPanel: () => void;
}
const SidebarContext = createContext<SidebarContextType>({ collapsed: false, setCollapsed: () => { }, expandPanel: () => { } });
export function useSidebarCollapsed() { return useContext(SidebarContext); }

function LayoutShortcutBindings() {
  useKeyboardShortcuts();
  usePlayHistoryRecorder();
  return null;
}

function SidebarFallback() {
  return <div className="h-full w-full border-r border-white/5 chrome-bar bg-black/15" />;
}

function DesktopShellFallback({
  content,
  scrollRef,
  showDesktopSidebar,
  showShellTopGlow,
}: {
  content: React.ReactNode;
  scrollRef: React.RefObject<HTMLDivElement>;
  showDesktopSidebar: boolean;
  showShellTopGlow: boolean;
}) {
  return (
    <div className="relative flex h-full min-h-0">
      {showDesktopSidebar ? (
        <div className="h-full w-[18rem] shrink-0 overflow-hidden">
          <SidebarFallback />
        </div>
      ) : null}
      <div className="relative flex flex-1 min-h-0 flex-col">
        {showShellTopGlow ? (
          <div
            aria-hidden="true"
            className="shell-top-glow pointer-events-none absolute inset-x-0 top-0 z-20 h-24 opacity-[0.18]"
          />
        ) : null}
        <ScrollArea className="flex-1" ref={scrollRef} viewportProps={{ "data-main-scroll-viewport": "true" }}>
          <main className="shell-main-content desktop-shell-main-content pb-8 overflow-x-hidden">
            {content}
          </main>
        </ScrollArea>
      </div>
    </div>
  );
}

export function Layout({ children }: React.PropsWithChildren) {
  const { currentTrack, hasPlaybackStarted, setRightPanelOpen, setRightPanelTab, showRightPanel } = usePlayer();
  const user = useContext(AuthContext)?.user ?? null;
  const { showSidebar, libraryOpenState } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const isEmbedMode = useEmbedMode();
  const isMobile = useIsMobile();
  const {
    allowShellAmbientMotion,
    allowShellDepthMotion,
    lowEndDevice,
  } = useMotionPreferences();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStoredBoolean(SIDEBAR_COLLAPSED_KEY, libraryOpenState === "collapsed"));
  const [compactSidebarExpanded, setCompactSidebarExpanded] = useState(false);
  const [panelGroupVersion, setPanelGroupVersion] = useState(0);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [isRightPanelDragging, setIsRightPanelDragging] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(
    () => !(hasPlaybackStarted && showRightPanel && Boolean(currentTrack)),
  );
  const [mobilePlayerOpen, setMobilePlayerOpen] = useState(false);
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const sidebarSyncActionRef = useRef<"idle" | "sync-expand" | "sync-collapse">("idle");
  const rightPanelSyncActionRef = useRef<"idle" | "sync-expand" | "sync-collapse">("idle");
  const sidebarExpandedSizeRef = useRef(0);
  const rightPanelExpandedSizeRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasRestoredRouteRef = useRef(false);
  const shellDragActiveRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1600 : window.innerWidth,
  );
  useSmoothScroll(!isMobile);
  const panelSizeFromPx = useCallback(
    (px: number) => (px / Math.max(viewportWidth, 1)) * 100,
    [viewportWidth],
  );

  const isCompactDesktop = !isMobile && viewportWidth < 1500;
  const isDenseDesktop = !isMobile && viewportWidth < 1320;
  const isTightDesktop = !isMobile && viewportWidth < 1420;
  const isCompressedDesktop = !isMobile && viewportWidth < 1240;
  const showDesktopSidebar = !isMobile && showSidebar;
  const activePlayerTrack = hasPlaybackStarted ? currentTrack : null;
  const shouldShowRightPanel = hasPlaybackStarted && showRightPanel && Boolean(currentTrack);
  const effectiveSidebarCollapsed = isCompressedDesktop
    ? true
    : isCompactDesktop
      ? !compactSidebarExpanded
      : sidebarCollapsed;
  const collapsedSidebarSize = Math.max(4, panelSizeFromPx(COLLAPSED_SIDEBAR_WIDTH_PX));
  const sidebarDefaultSize = isTightDesktop ? 16 : 18;
  const rightPanelTargetWidth = isCompressedDesktop
    ? 280
    : isDenseDesktop
      ? 300
      : isCompactDesktop
        ? 320
        : 360;
  const rightPanelDefaultSize = shouldShowRightPanel ? panelSizeFromPx(rightPanelTargetWidth) : 0;
  const rightPanelMinSize = panelSizeFromPx(rightPanelTargetWidth);
  const rightPanelMaxSize = panelSizeFromPx(rightPanelTargetWidth + (isCompactDesktop ? 56 : 84));
  const rightPanelMinWidth = rightPanelTargetWidth;
  const showShellChrome = isMobile || allowShellDepthMotion || allowShellAmbientMotion;
  const showShellTopGlow = showShellChrome && location.pathname !== "/settings";
  const showRightPanelHandle = shouldShowRightPanel || !rightPanelCollapsed;
  const shouldRenderRightPanel = shouldShowRightPanel || !rightPanelCollapsed;
  const effectiveSidebarDefaultSize = effectiveSidebarCollapsed
    ? collapsedSidebarSize
    : Math.max(collapsedSidebarSize, sidebarExpandedSizeRef.current || sidebarDefaultSize);
  const effectiveRightPanelDefaultSize = shouldShowRightPanel
    ? Math.min(
      Math.max(rightPanelExpandedSizeRef.current || rightPanelDefaultSize, rightPanelMinSize),
      rightPanelMaxSize,
    )
    : 0;
  const effectiveCenterDefaultSize = 100 - (showDesktopSidebar ? effectiveSidebarDefaultSize : 0) - effectiveRightPanelDefaultSize;

  const setSidebarCollapsedMode = useCallback(
    (next: boolean) => {
      if (isCompactDesktop) {
        setCompactSidebarExpanded(!next);
        return;
      }
      setSidebarCollapsed(next);
    },
    [isCompactDesktop],
  );

  const syncSidebarPanel = useCallback((collapsed: boolean) => {
    const action = collapsed ? "sync-collapse" : "sync-expand";
    const targetSize = collapsed ? collapsedSidebarSize : sidebarDefaultSize;

    sidebarSyncActionRef.current = action;

    if (sidebarPanelRef.current?.isCollapsed()) {
      sidebarPanelRef.current?.expand(targetSize);
    }

    sidebarPanelRef.current?.resize(targetSize);

    if (sidebarSyncActionRef.current === action) {
      sidebarSyncActionRef.current = "idle";
    }
  }, [collapsedSidebarSize, sidebarDefaultSize]);

  const expandPanel = useCallback(() => {
    setSidebarCollapsedMode(false);
    syncSidebarPanel(false);
  }, [setSidebarCollapsedMode, syncSidebarPanel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    let frameId = 0;
    const handleResize = () => {
      if (frameId) return;
      frameId = window.requestAnimationFrame(() => {
        frameId = 0;
        setViewportWidth(window.innerWidth);
      });
    };

    window.addEventListener("resize", handleResize);
    handleResize();
    return () => {
      window.removeEventListener("resize", handleResize);
      if (frameId) window.cancelAnimationFrame(frameId);
    };
  }, []);

  useEffect(() => {
    const shouldCollapse = libraryOpenState === "collapsed";
    if (isCompactDesktop) {
      setCompactSidebarExpanded(!shouldCollapse);
      return;
    }

    setSidebarCollapsed(shouldCollapse);
    writeStoredValue(SIDEBAR_COLLAPSED_KEY, String(shouldCollapse));
  }, [isCompactDesktop, libraryOpenState]);

  useEffect(() => {
    if (hasRestoredRouteRef.current) return;
    hasRestoredRouteRef.current = true;

    if (!user || location.pathname !== APP_HOME_PATH || location.search || location.hash) {
      return;
    }

    const storedRoute = readStoredRoute();
    if (!storedRoute || storedRoute === APP_HOME_PATH || storedRoute.startsWith("/auth")) {
      return;
    }

    navigate(storedRoute, { replace: true });
  }, [location.hash, location.pathname, location.search, navigate, user]);

  useEffect(() => {
    if (location.pathname.startsWith("/auth")) return;
    const currentRoute = `${location.pathname}${location.search}${location.hash}`;
    writeStoredValue(LAST_ROUTE_KEY, currentRoute);
  }, [location.hash, location.pathname, location.search]);

  const content = children ?? <Outlet />;

  useEffect(() => {
    writeStoredValue(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!isCompactDesktop) {
      setCompactSidebarExpanded(false);
    }
  }, [isCompactDesktop]);

  useEffect(() => {
    if (!effectiveSidebarCollapsed) {
      sidebarExpandedSizeRef.current = Math.max(collapsedSidebarSize, sidebarExpandedSizeRef.current || sidebarDefaultSize);
    }
  }, [collapsedSidebarSize, effectiveSidebarCollapsed, sidebarDefaultSize]);

  useEffect(() => {
    if (isMobile || !showDesktopSidebar) {
      sidebarSyncActionRef.current = "idle";
      return;
    }

    syncSidebarPanel(effectiveSidebarCollapsed);
  }, [effectiveSidebarCollapsed, isMobile, showDesktopSidebar, syncSidebarPanel]);

  useEffect(() => {
    if (isMobile) {
      rightPanelSyncActionRef.current = "idle";
      setRightPanelCollapsed(true);
      return;
    }

    if (shouldShowRightPanel) {
      rightPanelSyncActionRef.current = "sync-expand";
      setRightPanelCollapsed(false);
      rightPanelRef.current?.expand();
    } else {
      rightPanelSyncActionRef.current = "sync-collapse";
      setRightPanelCollapsed(true);
      rightPanelRef.current?.collapse();
    }
  }, [shouldShowRightPanel, isMobile]);

  useEffect(() => {
    if (isMobile || !shouldShowRightPanel || rightPanelCollapsed || isRightPanelDragging) return;
    rightPanelRef.current?.resize(rightPanelDefaultSize);
  }, [isMobile, isRightPanelDragging, rightPanelCollapsed, rightPanelDefaultSize, shouldShowRightPanel]);

  useEffect(() => {
    if (activePlayerTrack) return;
    setMobilePlayerOpen(false);
  }, [activePlayerTrack]);

  const openMobilePlayer = useCallback(() => {
    if (!activePlayerTrack) return;
    setMobilePlayerOpen(true);
  }, [activePlayerTrack]);

  const openMobilePlayerTab = useCallback(
    (tab: "lyrics" | "queue") => {
      if (!activePlayerTrack) return;
      setRightPanelTab(tab);
      setMobilePlayerOpen(true);
    },
    [activePlayerTrack, setRightPanelTab],
  );

  const handleRightPanelCollapse = useCallback(() => {
    const action = rightPanelSyncActionRef.current;
    rightPanelSyncActionRef.current = "idle";

    if (action !== "sync-collapse" && shouldShowRightPanel) {
      const restoreSize = Math.min(
        Math.max(rightPanelExpandedSizeRef.current || rightPanelDefaultSize, rightPanelMinSize),
        rightPanelMaxSize,
      );

      rightPanelSyncActionRef.current = "sync-expand";
      setRightPanelCollapsed(false);

      const restorePanel = () => {
        rightPanelRef.current?.expand();
        rightPanelRef.current?.resize(restoreSize);
      };

      if (typeof queueMicrotask === "function") {
        queueMicrotask(restorePanel);
      } else {
        window.setTimeout(restorePanel, 0);
      }
      return;
    }

    setRightPanelCollapsed(true);

    if (action !== "sync-collapse") {
      setRightPanelOpen(false);
    }
  }, [rightPanelDefaultSize, rightPanelMaxSize, rightPanelMinSize, setRightPanelOpen, shouldShowRightPanel]);

  const handleRightPanelExpand = useCallback(() => {
    const action = rightPanelSyncActionRef.current;
    rightPanelSyncActionRef.current = "idle";
    setRightPanelCollapsed(false);

    if (action !== "sync-expand" && activePlayerTrack) {
      setRightPanelOpen(true);
    }
  }, [activePlayerTrack, setRightPanelOpen]);

  const handleRightPanelResize = useCallback((size: number) => {
    if (size > 0) {
      rightPanelExpandedSizeRef.current = size;
    }
  }, []);

  const handleSidebarCollapse = useCallback(() => {
    const action = sidebarSyncActionRef.current;
    sidebarSyncActionRef.current = "idle";

    if (action !== "sync-collapse") {
      setSidebarCollapsedMode(true);
    }
  }, [setSidebarCollapsedMode]);

  const handleSidebarExpand = useCallback(() => {
    const action = sidebarSyncActionRef.current;
    sidebarSyncActionRef.current = "idle";

    if (action !== "sync-expand") {
      setSidebarCollapsedMode(false);
    }
  }, [setSidebarCollapsedMode]);

  const handleSidebarResize = useCallback((size: number) => {
    if (sidebarSyncActionRef.current !== "idle") return;

    const collapseThreshold = collapsedSidebarSize + 0.5;
    if (size <= collapseThreshold && !effectiveSidebarCollapsed) {
      setSidebarCollapsedMode(true);
      return;
    }

    if (size > collapseThreshold && effectiveSidebarCollapsed) {
      setSidebarCollapsedMode(false);
    }

    if (size > collapseThreshold) {
      sidebarExpandedSizeRef.current = size;
    }
  }, [collapsedSidebarSize, effectiveSidebarCollapsed, setSidebarCollapsedMode]);

  const handleSidebarDragging = useCallback((isDragging: boolean) => {
    shellDragActiveRef.current = isDragging || isRightPanelDragging;
    setIsSidebarDragging(isDragging);
  }, [isRightPanelDragging]);

  const handleRightHandleDragging = useCallback((isDragging: boolean) => {
    shellDragActiveRef.current = isDragging || isSidebarDragging;
    setIsRightPanelDragging(isDragging);
  }, [isSidebarDragging]);

  useEffect(() => {
    shellDragActiveRef.current = isSidebarDragging || isRightPanelDragging;
  }, [isSidebarDragging, isRightPanelDragging]);

  useEffect(() => {
    if (isMobile) return;

    const recoverStuckPanelDrag = () => {
      if (!shellDragActiveRef.current) return;

      shellDragActiveRef.current = false;
      setIsSidebarDragging(false);
      setIsRightPanelDragging(false);
      setPanelGroupVersion((previous) => previous + 1);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.buttons === 0) {
        recoverStuckPanelDrag();
      }
    };

    window.addEventListener("pointermove", handlePointerMove, true);
    window.addEventListener("pointerup", recoverStuckPanelDrag, true);
    window.addEventListener("pointercancel", recoverStuckPanelDrag, true);
    window.addEventListener("blur", recoverStuckPanelDrag);
    document.addEventListener("visibilitychange", recoverStuckPanelDrag);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove, true);
      window.removeEventListener("pointerup", recoverStuckPanelDrag, true);
      window.removeEventListener("pointercancel", recoverStuckPanelDrag, true);
      window.removeEventListener("blur", recoverStuckPanelDrag);
      document.removeEventListener("visibilitychange", recoverStuckPanelDrag);
    };
  }, [isMobile]);

  return (
    <SidebarContext.Provider
      value={{ collapsed: effectiveSidebarCollapsed, setCollapsed: setSidebarCollapsedMode, expandPanel }}
    >
      <TrackSelectionShortcutsProvider>
        <LayoutShortcutBindings />
        <div
          className="relative flex h-screen min-h-screen w-full max-w-full flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:min-h-[100dvh]"
          // Keep the app feeling native by suppressing the browser context menu.
          onContextMenu={(event) => {
            if (!isEmbedMode) event.preventDefault();
          }}
        >
          {isEmbedMode ? (
            <main className="min-h-screen bg-[#050505]">{content}</main>
          ) : (
            <>
              {!lowEndDevice ? (
                <Suspense fallback={null}>
                  <LazyAppDiagnosticsInbox />
                </Suspense>
              ) : null}
              <div className="fixed inset-0 z-0 bg-black" />

              <div className="flex-1 min-h-0 relative z-10">
                {!isMobile ? (
                  <Suspense
                    fallback={(
                      <DesktopShellFallback
                        content={content}
                        scrollRef={scrollRef}
                        showDesktopSidebar={showDesktopSidebar}
                        showShellTopGlow={showShellTopGlow}
                      />
                    )}
                  >
                    <LazyLayoutDesktopShell
                      panelGroupVersion={panelGroupVersion}
                      showDesktopSidebar={showDesktopSidebar}
                      sidebarPanelRef={sidebarPanelRef}
                      rightPanelRef={rightPanelRef}
                      effectiveSidebarDefaultSize={effectiveSidebarDefaultSize}
                      collapsedSidebarSize={collapsedSidebarSize}
                      isCompactDesktop={isCompactDesktop}
                      handleSidebarCollapse={handleSidebarCollapse}
                      handleSidebarExpand={handleSidebarExpand}
                      handleSidebarResize={handleSidebarResize}
                      handleSidebarDragging={handleSidebarDragging}
                      effectiveCenterDefaultSize={effectiveCenterDefaultSize}
                      showShellTopGlow={showShellTopGlow}
                      scrollRef={scrollRef}
                      content={content}
                      showRightPanelHandle={showRightPanelHandle}
                      handleRightHandleDragging={handleRightHandleDragging}
                      effectiveRightPanelDefaultSize={effectiveRightPanelDefaultSize}
                      rightPanelMinSize={rightPanelMinSize}
                      rightPanelMaxSize={rightPanelMaxSize}
                      isRightPanelDragging={isRightPanelDragging}
                      handleRightPanelCollapse={handleRightPanelCollapse}
                      handleRightPanelExpand={handleRightPanelExpand}
                      handleRightPanelResize={handleRightPanelResize}
                      shouldShowRightPanel={shouldShowRightPanel}
                      shouldRenderRightPanel={shouldRenderRightPanel}
                      rightPanelMinWidth={rightPanelMinWidth}
                    />
                  </Suspense>
                ) : (
                  <div className="relative flex h-full min-h-0 flex-col">
                    <Suspense fallback={null}>
                      <LazyMobileTopBar />
                    </Suspense>
                    {showShellTopGlow ? (
                      <div
                        aria-hidden="true"
                        className="shell-top-glow pointer-events-none absolute inset-x-0 top-0 z-20 h-24 opacity-[0.14]"
                      />
                    ) : null}
                    <ScrollArea className="flex-1 pt-[calc(var(--mobile-header-height)+0.25rem)]" ref={scrollRef} viewportProps={{ "data-main-scroll-viewport": "true" }}>
                      <main className="shell-main-content mobile-main-content mx-auto w-full max-w-[42rem] px-4 pb-[11rem]">
                        {content}
                      </main>
                    </ScrollArea>
                  </div>
                )}
              </div>

              {!isMobile && activePlayerTrack ? (
                <Suspense fallback={null}>
                  <LazyBottomPlayer />
                </Suspense>
              ) : null}

              {isMobile && activePlayerTrack ? (
                <Suspense fallback={null}>
                  <LazyMobileMiniPlayer
                    onOpenPlayer={openMobilePlayer}
                    onOpenTab={openMobilePlayerTab}
                  />
                </Suspense>
              ) : null}

              {isMobile ? (
                <Suspense fallback={null}>
                  <LazyMobileNav />
                </Suspense>
              ) : null}

              {isMobile && activePlayerTrack ? (
                <Suspense fallback={null}>
                  <LazyMobilePlayerSheet
                    open={mobilePlayerOpen}
                    onOpenChange={setMobilePlayerOpen}
                  />
                </Suspense>
              ) : null}
            </>
          )}
          <BackToTopButton />
        </div>
      </TrackSelectionShortcutsProvider>
    </SidebarContext.Provider>
  );
}
