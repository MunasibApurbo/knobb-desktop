import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { MAIN_SCROLL_VIEWPORT_SELECTOR } from "@/hooks/useMainScrollY";
import { cn } from "@/lib/utils";

type VirtualizedTrackListProps<T> = {
  className?: string;
  getItemKey?: (item: T, index: number) => string | number;
  itemClassName?: string;
  items: T[];
  overscan?: number;
  rowHeight?: number;
  renderRow: (item: T, index: number) => React.ReactNode;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function VirtualizedTrackList<T>({
  className,
  getItemKey,
  itemClassName,
  items,
  overscan = 6,
  rowHeight = 73,
  renderRow,
}: VirtualizedTrackListProps<T>) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [range, setRange] = useState({ start: 0, end: Math.min(items.length, 18) });

  const recomputeRange = useCallback(() => {
    const container = containerRef.current;
    const viewport = document.querySelector<HTMLElement>(MAIN_SCROLL_VIEWPORT_SELECTOR);

    if (!container || !viewport || items.length === 0) {
      setRange({ start: 0, end: items.length });
      return;
    }

    const viewportRect = viewport.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top - viewportRect.top + viewport.scrollTop;
    const viewportTop = viewport.scrollTop;
    const viewportBottom = viewportTop + viewport.clientHeight;

    const start = clamp(
      Math.floor((viewportTop - containerTop) / rowHeight) - overscan,
      0,
      Math.max(items.length - 1, 0),
    );
    const end = clamp(
      Math.ceil((viewportBottom - containerTop) / rowHeight) + overscan,
      Math.min(start + 1, items.length),
      items.length,
    );

    setRange((previous) => (
      previous.start === start && previous.end === end
        ? previous
        : { start, end }
    ));
  }, [items.length, overscan, rowHeight]);

  useEffect(() => {
    let animationFrame = 0;
    let detachViewport: (() => void) | null = null;
    const resizeObserver = typeof ResizeObserver !== "undefined"
      ? new ResizeObserver(() => recomputeRange())
      : null;

    const attach = () => {
      const viewport = document.querySelector<HTMLElement>(MAIN_SCROLL_VIEWPORT_SELECTOR);
      const container = containerRef.current;

      if (!viewport || !container) {
        animationFrame = window.requestAnimationFrame(attach);
        return;
      }

      const handleScroll = () => recomputeRange();

      viewport.addEventListener("scroll", handleScroll, { passive: true });
      window.addEventListener("resize", handleScroll);
      resizeObserver?.observe(container);
      recomputeRange();

      detachViewport = () => {
        viewport.removeEventListener("scroll", handleScroll);
        window.removeEventListener("resize", handleScroll);
        resizeObserver?.disconnect();
      };
    };

    attach();

    return () => {
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      detachViewport?.();
    };
  }, [recomputeRange]);

  useEffect(() => {
    recomputeRange();
  }, [items.length, recomputeRange]);

  const { beforeHeight, afterHeight, visibleItems } = useMemo(() => {
    const start = clamp(range.start, 0, items.length);
    const end = clamp(range.end, start, items.length);

    return {
      beforeHeight: start * rowHeight,
      afterHeight: Math.max(items.length - end, 0) * rowHeight,
      visibleItems: items.slice(start, end).map((item, offset) => ({
        item,
        index: start + offset,
      })),
    };
  }, [items, range.end, range.start, rowHeight]);

  return (
    <div ref={containerRef} className={className}>
      {beforeHeight > 0 ? <div aria-hidden="true" style={{ height: beforeHeight }} /> : null}
      {visibleItems.map(({ item, index }) => (
        <div key={getItemKey ? getItemKey(item, index) : index} className={cn(itemClassName)}>
          {renderRow(item, index)}
        </div>
      ))}
      {afterHeight > 0 ? <div aria-hidden="true" style={{ height: afterHeight }} /> : null}
    </div>
  );
}
