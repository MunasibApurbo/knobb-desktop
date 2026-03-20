import { usePlayer } from "@/contexts/PlayerContext";
import { SidebarContext } from "@/contexts/SidebarContext";
import type { ImperativePanelHandle } from "react-resizable-panels";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDesktopWheelSmoothing } from "@/hooks/useDesktopWheelSmoothing";
import { useSmoothScroll } from "@/hooks/useSmoothScroll";
import { usePlayHistoryRecorder } from "@/hooks/usePlayHistoryRecorder";
import { useEmbedMode } from "@/hooks/useEmbedMode";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { TrackSelectionShortcutsProvider } from "@/contexts/TrackSelectionShortcutsContext";
import { AuthContext } from "@/contexts/AuthContext";
import { useSettings } from "@/contexts/SettingsContext";
import { lazy, Suspense, startTransition, useState, useCallback, useEffect, useRef, useContext, type CSSProperties } from "react";
import { APP_HOME_PATH } from "@/lib/routes";
import { LayoutDesktopShell } from "@/components/LayoutDesktopShell";
import { scheduleBackgroundTask, useDeferredMount } from "@/lib/performanceProfile";

const LAST_ROUTE_KEY = "last-route";
const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
const APP_REFERENCE_WIDTH_PX = 1920;
const APP_REFERENCE_HEIGHT_PX = 1080;
const FULL_WIDTH_VIEWPORT_FLOOR_PX = APP_REFERENCE_WIDTH_PX * 0.9;
const FULL_WINDOW_HEIGHT_ALLOWANCE_PX = 24;
const SHORT_DISPLAY_HEIGHT_FLOOR_PX = 720;
const VERY_SHORT_DISPLAY_HEIGHT_FLOOR_PX = 620;
const MIN_APP_UI_SCALE = 0.44;
const MAX_APP_UI_SCALE = 2;
const COLLAPSED_SIDEBAR_WIDTH_PX = 84;
const MIN_RIGHT_PANEL_MAIN_WIDTH_PX = 460;
const COMPRESSED_SIDEBAR_WIDTH_PX = APP_REFERENCE_WIDTH_PX * 0.14;
const TIGHT_SIDEBAR_WIDTH_PX = APP_REFERENCE_WIDTH_PX * 0.16;
const COMFORTABLE_SIDEBAR_WIDTH_PX = APP_REFERENCE_WIDTH_PX * 0.18;
const HALF_WINDOW_RATIO_THRESHOLD = 0.62;
const QUARTER_WINDOW_RATIO_THRESHOLD = 0.36;
const DeferredAppDiagnosticsInbox = lazy(async () => {
  const module = await import("@/components/AppDiagnosticsInbox");
  return { default: module.AppDiagnosticsInbox };
});
const DeferredBottomPlayer = lazy(async () => {
  const module = await import("@/components/BottomPlayer");
  return { default: module.BottomPlayer };
});
const DeferredFullScreenPlayer = lazy(async () => {
  const module = await import("@/components/FullScreenPlayer");
  return { default: module.FullScreenPlayer };
});

let fullScreenPlayerModulePromise: Promise<typeof import("@/components/FullScreenPlayer")> | null = null;

function preloadFullScreenPlayerModule() {
  if (!fullScreenPlayerModulePromise) {
    fullScreenPlayerModulePromise = import("@/components/FullScreenPlayer").catch((error) => {
      fullScreenPlayerModulePromise = null;
      throw error;
    });
  }

  return fullScreenPlayerModulePromise;
}

function FullScreenPlayerFallback() {
  return <div className="fixed inset-0 z-[100] bg-black/92 backdrop-blur-[10px]" aria-hidden="true" />;
}

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

export { useSidebarCollapsed } from "@/contexts/SidebarContext";

function LayoutShortcutBindings() {
  useKeyboardShortcuts();
  usePlayHistoryRecorder();
  return null;
}

function getScreenWidth() {
  if (typeof window === "undefined") return 1600;

  const candidate = window.screen?.availWidth || window.screen?.width || window.innerWidth;
  return Number.isFinite(candidate) && candidate > 0 ? candidate : window.innerWidth;
}

function getScreenHeight() {
  if (typeof window === "undefined") return 900;

  const candidate = window.screen?.availHeight || window.screen?.height || window.innerHeight;
  return Number.isFinite(candidate) && candidate > 0 ? candidate : window.innerHeight;
}

function getShellWidthMode(viewportWidth: number, screenWidth: number) {
  const safeViewportWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : 1600;
  if (safeViewportWidth >= FULL_WIDTH_VIEWPORT_FLOOR_PX) return "full";

  const safeScreenWidth = Number.isFinite(screenWidth) && screenWidth > 0
    ? Math.max(screenWidth, safeViewportWidth)
    : safeViewportWidth;
  const windowRatio = safeViewportWidth / safeScreenWidth;

  if (windowRatio <= QUARTER_WINDOW_RATIO_THRESHOLD) return "quarter";
  if (windowRatio <= HALF_WINDOW_RATIO_THRESHOLD) return "half";
  return "full";
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function getDesktopAppUiScale(
  viewportWidth: number,
  viewportHeight: number,
  shellWidthMode: ReturnType<typeof getShellWidthMode>,
) {
  const safeViewportWidth = Number.isFinite(viewportWidth) && viewportWidth > 0 ? viewportWidth : APP_REFERENCE_WIDTH_PX;
  const safeViewportHeight = Number.isFinite(viewportHeight) && viewportHeight > 0 ? viewportHeight : APP_REFERENCE_HEIGHT_PX;

  const rawScale = Math.min(
    safeViewportWidth / APP_REFERENCE_WIDTH_PX,
    safeViewportHeight / APP_REFERENCE_HEIGHT_PX,
  );

  if (shellWidthMode === "quarter") {
    const comfortFloor = clampNumber(
      Math.min(safeViewportWidth / 1320, safeViewportHeight / 820),
      0.56,
      0.68,
    );
    return clampNumber(Math.max(rawScale, comfortFloor), MIN_APP_UI_SCALE, MAX_APP_UI_SCALE);
  }

  if (shellWidthMode === "half") {
    const comfortFloor = clampNumber(
      Math.min(safeViewportWidth / 1480, safeViewportHeight / 860),
      0.66,
      0.78,
    );
    return clampNumber(Math.max(rawScale, comfortFloor), MIN_APP_UI_SCALE, MAX_APP_UI_SCALE);
  }

  // Full-window laptop-class desktops should not feel materially "cheaper"
  // than the reference display just because they have fewer pixels to spare.
  const comfortFloor = clampNumber(
    Math.min(safeViewportWidth / 1680, safeViewportHeight / 940),
    0.62,
    0.88,
  );

  return clampNumber(Math.max(rawScale, comfortFloor), MIN_APP_UI_SCALE, MAX_APP_UI_SCALE);
}

export function Layout({ children }: React.PropsWithChildren) {
  const { currentTrack, hasPlaybackStarted, isFullScreen, setRightPanelOpen, showRightPanel } = usePlayer();
  const user = useContext(AuthContext)?.user ?? null;
  const { showSidebar, libraryOpenState = "expanded" } = useSettings();
  const location = useLocation();
  const navigate = useNavigate();
  const isEmbedMode = useEmbedMode();
  const {
    motionEnabled,
    allowShellAmbientMotion,
    allowShellDepthMotion,
    lowEndDevice,
    hasHoverCapablePointer,
  } = useMotionPreferences();
  const deferredUtilityChromeReady = useDeferredMount(1400);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => readStoredBoolean(SIDEBAR_COLLAPSED_KEY, libraryOpenState === "collapsed"));
  const [compactSidebarExpanded, setCompactSidebarExpanded] = useState(false);
  const [panelGroupVersion, setPanelGroupVersion] = useState(0);
  const [isSidebarDragging, setIsSidebarDragging] = useState(false);
  const [isRightPanelDragging, setIsRightPanelDragging] = useState(false);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(
    () => !(hasPlaybackStarted && showRightPanel && Boolean(currentTrack)),
  );
  const sidebarPanelRef = useRef<ImperativePanelHandle>(null);
  const rightPanelRef = useRef<ImperativePanelHandle>(null);
  const sidebarSyncActionRef = useRef<"idle" | "sync-expand" | "sync-collapse">("idle");
  const rightPanelSyncActionRef = useRef<"idle" | "sync-expand" | "sync-collapse">("idle");
  const sidebarExpandedSizeRef = useRef(0);
  const rightPanelExpandedSizeRef = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const scrollContentRef = useRef<HTMLElement>(null);
  const hasRestoredRouteRef = useRef(false);
  const shellDragActiveRef = useRef(false);
  const [viewportWidth, setViewportWidth] = useState(() =>
    typeof window === "undefined" ? 1600 : window.innerWidth,
  );
  const [viewportHeight, setViewportHeight] = useState(() =>
    typeof window === "undefined" ? 900 : window.innerHeight,
  );
  const [screenWidth, setScreenWidth] = useState(getScreenWidth);
  const [screenHeight, setScreenHeight] = useState(getScreenHeight);
  const [shouldRenderFullScreenPlayer, setShouldRenderFullScreenPlayer] = useState(isFullScreen);
  const panelSizeFromPx = useCallback(
    (px: number) => (px / Math.max(viewportWidth, 1)) * 100,
    [viewportWidth],
  );

  const shellWidthMode = getShellWidthMode(viewportWidth, screenWidth);
  const appUiScale = getDesktopAppUiScale(viewportWidth, viewportHeight, shellWidthMode);
  const normalizedViewportWidth = viewportWidth / appUiScale;
  const normalizedViewportHeight = viewportHeight / appUiScale;
  const isNarrowHoverDesktopWindow = hasHoverCapablePointer && viewportWidth < 900;
  const isHalfWidthShell = shellWidthMode === "half" || shellWidthMode === "quarter";
  const isQuarterWidthShell = shellWidthMode === "quarter";
  const desktopClassWidth = shellWidthMode === "full"
    ? Math.max(
      viewportWidth,
      Math.min(
        Number.isFinite(screenWidth) && screenWidth > 0 ? screenWidth : viewportWidth,
        viewportWidth + 72,
      ),
    )
    : normalizedViewportWidth;
  const desktopClassHeight = shellWidthMode === "full"
    ? Math.max(
      viewportHeight,
      Math.min(
        Number.isFinite(screenHeight) && screenHeight > 0 ? screenHeight : viewportHeight,
        viewportHeight + FULL_WINDOW_HEIGHT_ALLOWANCE_PX,
      ),
    )
    : normalizedViewportHeight;
  const isShortDesktop = isNarrowHoverDesktopWindow
    ? viewportHeight < 700
    : shellWidthMode === "full"
      ? desktopClassHeight < 700
    : normalizedViewportHeight < 940 || screenHeight < SHORT_DISPLAY_HEIGHT_FLOOR_PX;
  const isVeryShortDesktop = isNarrowHoverDesktopWindow
    ? viewportHeight < 620
    : shellWidthMode === "full"
      ? desktopClassHeight < 620
    : normalizedViewportHeight < 860 || screenHeight < VERY_SHORT_DISPLAY_HEIGHT_FLOOR_PX;
  const isCompactDesktop = isNarrowHoverDesktopWindow
    ? viewportWidth < 760 || viewportHeight < 720
    : shellWidthMode === "full"
      ? desktopClassWidth < 1220 || desktopClassHeight < 700
    : normalizedViewportWidth < 1500 || isShortDesktop || isHalfWidthShell;
  const isDenseDesktop = isNarrowHoverDesktopWindow
    ? viewportWidth < 700 || viewportHeight < 660
    : shellWidthMode === "full"
      ? desktopClassWidth < 1120 || desktopClassHeight < 660
    : normalizedViewportWidth < 1440 || normalizedViewportHeight < 900 || isHalfWidthShell;
  const isTightDesktop = isNarrowHoverDesktopWindow
    ? viewportWidth < 640 || viewportHeight < 620
    : shellWidthMode === "full"
      ? desktopClassWidth < 1180 || desktopClassHeight < 680
    : normalizedViewportWidth < 1420 || normalizedViewportHeight < 920 || isHalfWidthShell;
  const isCompressedDesktop = isNarrowHoverDesktopWindow
    ? viewportWidth < 580 || viewportHeight < 560 || lowEndDevice
    : shellWidthMode === "full"
      ? desktopClassWidth < 1040 || desktopClassHeight < 620 || lowEndDevice
    : normalizedViewportWidth < 1360 || isVeryShortDesktop || lowEndDevice || isQuarterWidthShell;
  const shouldUseCompactSidebarState = isNarrowHoverDesktopWindow
    ? viewportWidth < 640 || lowEndDevice
    : shellWidthMode === "full"
      ? desktopClassWidth < 1120 || lowEndDevice
    : normalizedViewportWidth < 1240 || lowEndDevice || isHalfWidthShell;
  const forceCollapsedSidebar = isNarrowHoverDesktopWindow
    ? viewportWidth < 560 || lowEndDevice
    : shellWidthMode === "full"
      ? desktopClassWidth < 1020 || lowEndDevice
    : normalizedViewportWidth < 1180 || lowEndDevice || isQuarterWidthShell;
  const showDesktopSidebar = showSidebar;
  const activePlayerTrack = hasPlaybackStarted ? currentTrack : null;
  const rightPanelRequested = hasPlaybackStarted && showRightPanel && Boolean(currentTrack);
  const effectiveSidebarCollapsed = forceCollapsedSidebar
    ? true
    : shouldUseCompactSidebarState
      ? !compactSidebarExpanded
      : sidebarCollapsed;
  const collapsedSidebarWidth = COLLAPSED_SIDEBAR_WIDTH_PX * appUiScale;
  const collapsedSidebarSize = Math.max(4, panelSizeFromPx(collapsedSidebarWidth));
  const sidebarExpandedTargetWidth = (isCompressedDesktop
    ? COMPRESSED_SIDEBAR_WIDTH_PX
    : isTightDesktop
      ? TIGHT_SIDEBAR_WIDTH_PX
      : COMFORTABLE_SIDEBAR_WIDTH_PX) * appUiScale;
  const sidebarDefaultSize = panelSizeFromPx(sidebarExpandedTargetWidth);
  const rightPanelTargetWidth = (isCompressedDesktop
    ? 248
    : isDenseDesktop
      ? 272
      : isCompactDesktop
        ? 296
        : 340) * appUiScale;
  const sidebarDockWidth = showDesktopSidebar
    ? (effectiveSidebarCollapsed ? collapsedSidebarWidth : Math.round((sidebarDefaultSize / 100) * viewportWidth))
    : 0;
  const canDockRightPanel =
    !lowEndDevice &&
    viewportWidth >= sidebarDockWidth + rightPanelTargetWidth + MIN_RIGHT_PANEL_MAIN_WIDTH_PX;
  const shouldShowRightPanel = rightPanelRequested && canDockRightPanel;
  const rightPanelDefaultSize = shouldShowRightPanel ? panelSizeFromPx(rightPanelTargetWidth) : 0;
  const rightPanelMinSize = panelSizeFromPx(rightPanelTargetWidth);
  const rightPanelMaxSize = panelSizeFromPx(rightPanelTargetWidth + ((isCompactDesktop ? 56 : 84) * appUiScale));
  const rightPanelMinWidth = rightPanelTargetWidth;
  const showShellChrome = allowShellDepthMotion || allowShellAmbientMotion;
  const showShellTopGlow = showShellChrome && location.pathname !== "/settings" && !isCompressedDesktop;
  const showRightPanelHandle = canDockRightPanel && (shouldShowRightPanel || !rightPanelCollapsed);
  const shouldRenderRightPanel = canDockRightPanel && (shouldShowRightPanel || !rightPanelCollapsed);
  const smoothScrollEnabled =
    !isEmbedMode &&
    motionEnabled &&
    !lowEndDevice;
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
  const handleFullScreenExitComplete = useCallback(() => {
    if (!isFullScreen) {
      setShouldRenderFullScreenPlayer(false);
    }
  }, [isFullScreen]);

  useSmoothScroll({
    enabled: smoothScrollEnabled,
    wrapperRef: scrollRef,
    contentRef: scrollContentRef,
    lerp: 0.18,
    startDelay: 0,
    wheelMultiplier: 0.84,
  });

  useDesktopWheelSmoothing({
    enabled: false,
    viewportRef: scrollRef,
  });

  const setSidebarCollapsedPreference = useCallback((next: boolean) => {
    setSidebarCollapsed(next);
    writeStoredValue(SIDEBAR_COLLAPSED_KEY, String(next));
  }, []);

  const setSidebarCollapsedMode = useCallback(
    (next: boolean) => {
      setSidebarCollapsedPreference(next);
      if (shouldUseCompactSidebarState) {
        setCompactSidebarExpanded(!next);
        return;
      }
    },
    [setSidebarCollapsedPreference, shouldUseCompactSidebarState],
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
        startTransition(() => {
          setViewportWidth(window.innerWidth);
          setViewportHeight(window.innerHeight);
          setScreenWidth(getScreenWidth());
          setScreenHeight(getScreenHeight());
        });
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
    setSidebarCollapsedPreference(shouldCollapse);

    if (shouldUseCompactSidebarState) {
      setCompactSidebarExpanded(!shouldCollapse);
      return;
    }

  }, [libraryOpenState, setSidebarCollapsedPreference, shouldUseCompactSidebarState]);

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
    if (isEmbedMode || !activePlayerTrack) {
      setShouldRenderFullScreenPlayer(false);
      return;
    }

    if (isFullScreen) {
      setShouldRenderFullScreenPlayer(true);
    }
  }, [activePlayerTrack, isEmbedMode, isFullScreen]);

  useEffect(() => {
    writeStoredValue(SIDEBAR_COLLAPSED_KEY, String(sidebarCollapsed));
  }, [sidebarCollapsed]);

  useEffect(() => {
    if (!shouldUseCompactSidebarState) {
      setCompactSidebarExpanded(false);
    }
  }, [shouldUseCompactSidebarState]);

  useEffect(() => {
    if (!effectiveSidebarCollapsed) {
      sidebarExpandedSizeRef.current = Math.max(collapsedSidebarSize, sidebarExpandedSizeRef.current || sidebarDefaultSize);
    }
  }, [collapsedSidebarSize, effectiveSidebarCollapsed, sidebarDefaultSize]);

  useEffect(() => {
    if (!showDesktopSidebar) {
      sidebarSyncActionRef.current = "idle";
      return;
    }

    syncSidebarPanel(effectiveSidebarCollapsed);
  }, [effectiveSidebarCollapsed, showDesktopSidebar, syncSidebarPanel]);

  useEffect(() => {
    if (shouldShowRightPanel) {
      rightPanelSyncActionRef.current = "sync-expand";
      setRightPanelCollapsed(false);
      rightPanelRef.current?.expand();
    } else {
      rightPanelSyncActionRef.current = "sync-collapse";
      setRightPanelCollapsed(true);
      rightPanelRef.current?.collapse();
    }
  }, [shouldShowRightPanel]);

  useEffect(() => {
    if (!shouldShowRightPanel || rightPanelCollapsed || isRightPanelDragging) return;
    rightPanelRef.current?.resize(rightPanelDefaultSize);
  }, [isRightPanelDragging, rightPanelCollapsed, rightPanelDefaultSize, shouldShowRightPanel]);

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
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || typeof document === "undefined") return;

    const viewport = scrollRef.current;
    if (!viewport) return;

    const root = document.documentElement;
    let clearScrollingTimeout = 0;

    const markMainScrolling = () => {
      if (root.getAttribute("data-main-scrolling") !== "true") {
        root.setAttribute("data-main-scrolling", "true");
      }
      if (clearScrollingTimeout) {
        window.clearTimeout(clearScrollingTimeout);
      }
      clearScrollingTimeout = window.setTimeout(() => {
        root.removeAttribute("data-main-scrolling");
        clearScrollingTimeout = 0;
      }, 140);
    };

    viewport.addEventListener("wheel", markMainScrolling, { passive: true });

    return () => {
      if (clearScrollingTimeout) {
        window.clearTimeout(clearScrollingTimeout);
      }
      root.removeAttribute("data-main-scrolling");
      viewport.removeEventListener("wheel", markMainScrolling);
    };
  }, []);

  useEffect(() => {
    if (isEmbedMode || !activePlayerTrack || lowEndDevice) return;

    return scheduleBackgroundTask(() => {
      void preloadFullScreenPlayerModule().catch(() => undefined);
    }, 1800);
  }, [activePlayerTrack, isEmbedMode, lowEndDevice]);

  const shellScaleStyle = {
    "--app-ui-scale": appUiScale.toFixed(4),
    "--app-reference-width": `${APP_REFERENCE_WIDTH_PX}px`,
    "--app-reference-height": `${APP_REFERENCE_HEIGHT_PX}px`,
  } as CSSProperties;

  return (
    <SidebarContext.Provider
      value={{ collapsed: effectiveSidebarCollapsed, setCollapsed: setSidebarCollapsedMode, expandPanel }}
    >
      <TrackSelectionShortcutsProvider>
        <LayoutShortcutBindings />
        <div
          className="relative flex h-screen min-h-screen w-full max-w-full flex-col overflow-hidden supports-[height:100dvh]:h-[100dvh] supports-[height:100dvh]:min-h-[100dvh]"
          data-shell-density={isCompressedDesktop ? "compressed" : isDenseDesktop ? "dense" : isCompactDesktop ? "compact" : "comfortable"}
          data-shell-height={isVeryShortDesktop ? "short" : isShortDesktop ? "medium" : "tall"}
          data-shell-width={shellWidthMode}
          style={shellScaleStyle}
        >
          {isEmbedMode ? (
            <main className="min-h-screen bg-[#050505]">{content}</main>
          ) : (
            <>
              {deferredUtilityChromeReady ? (
                <Suspense fallback={null}>
                  <DeferredAppDiagnosticsInbox />
                </Suspense>
              ) : null}
              <div className="fixed inset-0 z-0 bg-black" />

              <div className="relative z-10 flex-1 min-h-0">
                <LayoutDesktopShell
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
                  scrollContentRef={scrollContentRef}
                  content={content}
                  hasBottomPlayer={Boolean(activePlayerTrack)}
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
              </div>

              {activePlayerTrack ? (
                <div
                  className="fixed inset-x-0 bottom-0 z-30"
                  data-testid="bottom-player-dock"
                >
                  <Suspense fallback={null}>
                    <DeferredBottomPlayer shellWidthMode={shellWidthMode} />
                  </Suspense>
                </div>
              ) : null}

              {!isEmbedMode && shouldRenderFullScreenPlayer ? (
                <Suspense fallback={<FullScreenPlayerFallback />}>
                  <DeferredFullScreenPlayer onExitComplete={handleFullScreenExitComplete} />
                </Suspense>
              ) : null}
            </>
          )}
        </div>
      </TrackSelectionShortcutsProvider>
    </SidebarContext.Provider>
  );
}
