import { lazy, Suspense, type ReactNode, type RefObject } from "react";
import type { ImperativePanelHandle } from "react-resizable-panels";

import { ScrollArea } from "@/components/ui/scroll-area";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { cn } from "@/lib/utils";

const DeferredAppSidebar = lazy(async () => {
  const module = await import("@/components/AppSidebar");
  return { default: module.AppSidebar };
});

const DeferredRightPanel = lazy(async () => {
  const module = await import("@/components/RightPanel");
  return { default: module.RightPanel };
});

interface LayoutDesktopShellProps {
  panelGroupVersion: number;
  showDesktopSidebar: boolean;
  sidebarPanelRef: RefObject<ImperativePanelHandle | null>;
  rightPanelRef: RefObject<ImperativePanelHandle | null>;
  effectiveSidebarDefaultSize: number;
  collapsedSidebarSize: number;
  isCompactDesktop: boolean;
  handleSidebarCollapse: () => void;
  handleSidebarExpand: () => void;
  handleSidebarResize: (size: number, prevSize?: number) => void;
  handleSidebarDragging: (isDragging: boolean) => void;
  effectiveCenterDefaultSize: number;
  showShellTopGlow: boolean;
  scrollRef: RefObject<HTMLDivElement>;
  scrollContentRef: RefObject<HTMLElement | null>;
  content: ReactNode;
  hasBottomPlayer: boolean;
  showRightPanelHandle: boolean;
  handleRightHandleDragging: (isDragging: boolean) => void;
  effectiveRightPanelDefaultSize: number;
  rightPanelMinSize: number;
  rightPanelMaxSize: number;
  isRightPanelDragging: boolean;
  handleRightPanelCollapse: () => void;
  handleRightPanelExpand: () => void;
  handleRightPanelResize: (size: number, prevSize?: number) => void;
  shouldShowRightPanel: boolean;
  shouldRenderRightPanel: boolean;
  rightPanelMinWidth: number;
}

export function LayoutDesktopShell({
  panelGroupVersion,
  showDesktopSidebar,
  sidebarPanelRef,
  rightPanelRef,
  effectiveSidebarDefaultSize,
  collapsedSidebarSize,
  isCompactDesktop,
  handleSidebarCollapse,
  handleSidebarExpand,
  handleSidebarResize,
  handleSidebarDragging,
  effectiveCenterDefaultSize,
  showShellTopGlow,
  scrollRef,
  scrollContentRef,
  content,
  hasBottomPlayer,
  showRightPanelHandle,
  handleRightHandleDragging,
  effectiveRightPanelDefaultSize,
  rightPanelMinSize,
  rightPanelMaxSize,
  isRightPanelDragging,
  handleRightPanelCollapse,
  handleRightPanelExpand,
  handleRightPanelResize,
  shouldShowRightPanel,
  shouldRenderRightPanel,
  rightPanelMinWidth,
}: LayoutDesktopShellProps) {
  return (
    <ResizablePanelGroup key={panelGroupVersion} id="app-shell-panels" direction="horizontal" className="h-full">
      {showDesktopSidebar ? (
        <>
          <ResizablePanel
            id="app-shell-sidebar"
            order={1}
            ref={sidebarPanelRef}
            defaultSize={effectiveSidebarDefaultSize}
            collapsible={false}
            collapsedSize={collapsedSidebarSize}
            minSize={collapsedSidebarSize}
            maxSize={isCompactDesktop ? 24 : 30}
            onCollapse={handleSidebarCollapse}
            onExpand={handleSidebarExpand}
            onResize={handleSidebarResize}
          >
            <div
              className="h-full overflow-hidden"
              style={{
                opacity: 1,
                transform: "translate3d(0, 0, 0)",
              }}
            >
              <Suspense fallback={null}>
                <DeferredAppSidebar />
              </Suspense>
            </div>
          </ResizablePanel>
          <ResizableHandle
            className="relative z-50 -mx-1.5 w-3 cursor-col-resize bg-transparent transition-colors"
            onDragging={handleSidebarDragging}
          />
        </>
      ) : null}

      <ResizablePanel id="app-shell-main" order={2} defaultSize={effectiveCenterDefaultSize} minSize={40}>
        <div className="relative flex flex-col h-full min-h-0">
          {showShellTopGlow ? (
            <div
              aria-hidden="true"
              className="shell-top-glow pointer-events-none absolute inset-x-0 top-0 z-20 h-24 opacity-[0.18]"
            />
          ) : null}
          <ScrollArea className="flex-1" ref={scrollRef} viewportProps={{ "data-main-scroll-viewport": "true" }}>
            <main
              ref={scrollContentRef}
              className={cn(
                "shell-main-content desktop-shell-main-content overflow-x-hidden",
                hasBottomPlayer ? "page-main-content" : "pb-8",
              )}
            >
              {content}
            </main>
          </ScrollArea>
        </div>
      </ResizablePanel>

      <ResizableHandle
        className={`relative z-50 -mx-1 w-2 cursor-col-resize bg-transparent transition-colors ${!showRightPanelHandle ? "hidden" : ""}`}
        hitAreaMargins={{ fine: 2, coarse: 6 }}
        onDragging={handleRightHandleDragging}
      />
      <ResizablePanel
        id="app-shell-right-panel"
        order={3}
        ref={rightPanelRef}
        defaultSize={effectiveRightPanelDefaultSize}
        minSize={rightPanelMinSize}
        maxSize={rightPanelMaxSize}
        collapsible={true}
        collapsedSize={0}
        className={isRightPanelDragging ? "" : "transition-[flex] duration-500"}
        style={isRightPanelDragging ? undefined : { transitionTimingFunction: "cubic-bezier(0.33,1,0.68,1)" }}
        onCollapse={handleRightPanelCollapse}
        onExpand={handleRightPanelExpand}
        onResize={handleRightPanelResize}
      >
        <div
          className="w-full h-full"
          style={{ minWidth: shouldShowRightPanel ? `${rightPanelMinWidth}px` : "0px" }}
        >
          {shouldRenderRightPanel ? (
            <Suspense fallback={null}>
              <DeferredRightPanel />
            </Suspense>
          ) : null}
        </div>
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}
