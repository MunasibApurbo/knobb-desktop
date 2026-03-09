import * as React from "react";
import type * as ScrollAreaPrimitive from "@radix-ui/react-scroll-area";

import { useOptionalSettings } from "@/contexts/SettingsContext";
import { cn } from "@/lib/utils";

type ScrollAreaProps = React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Root> & {
  forceVisibleScrollbar?: boolean;
  viewportProps?: React.ComponentPropsWithoutRef<typeof ScrollAreaPrimitive.Viewport>;
};

const ScrollArea = React.forwardRef<
  React.ElementRef<typeof ScrollAreaPrimitive.Root>,
  ScrollAreaProps
>(({ className, children, forceVisibleScrollbar = false, viewportProps, type, scrollHideDelay, ...props }, ref) => {
  const showScrollbar = useOptionalSettings()?.showScrollbar ?? true;
  const hideScrollbarChrome = !forceVisibleScrollbar && !showScrollbar;
  const { className: viewportClassName, ...nativeViewportProps } = viewportProps ?? {};
  void type;
  void scrollHideDelay;

  return (
    <div
      ref={ref}
      className={cn(
        "scroll-area-native overflow-auto overscroll-y-contain",
        hideScrollbarChrome && "scrollbar-hide",
        className,
        viewportClassName,
      )}
      {...props}
      {...nativeViewportProps}
    >
      {children}
    </div>
  );
});

ScrollArea.displayName = "ScrollArea";

export { ScrollArea };
