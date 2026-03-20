import { type ReactNode, useCallback, useRef } from "react";
import type { CarouselApi } from "@/hooks/useCarousel";
import { getCarouselTransform } from "@/hooks/useCarousel";

const CARD_ROW_FRAME =
    "website-mode-grid-frame home-section-grid hover-desaturate-grid home-section-carousel-frame";

export interface CarouselSectionProps<T> {
    items: T[];
    sectionKey: string;
    renderItem: (item: T, index: number) => ReactNode;
    carousel: CarouselApi;
    /** Number of neighboring pages to keep mounted for smoother paging. */
    overscanPages?: number;
    /** Additional class name on the frame element */
    className?: string;
    /** Children to render inside the frame wrapper (e.g. motion wrapper in Index) */
    wrapTrack?: (track: ReactNode, contentKey: string) => ReactNode;
    /** Key for AnimatePresence content swap (optional, defaults to sectionKey) */
    contentKey?: string;
}

export function CarouselSection<T>({
    items,
    sectionKey,
    renderItem,
    carousel,
    overscanPages = 1,
    className,
    wrapTrack,
    contentKey,
}: CarouselSectionProps<T>) {
    const {
        getPageCount,
        getCurrentPage,
        getSectionPages,
        moveSectionPage,
        setFrameRef,
        setTrackRef,
        draggingSections,
        rowStyle,
        cardCount,
        handlePointerDown,
        handlePointerMove,
        finishDrag,
        cancelDrag,
        handleClickCapture,
        registerItemCount,
    } = carousel;

    // Register count for external use
    registerItemCount(sectionKey, items.length);

    const frameRef = useRef<HTMLDivElement | null>(null);

    const setRef = useCallback(
        (node: HTMLDivElement | null) => {
            frameRef.current = node;
            setFrameRef(sectionKey)(node);
        },
        [sectionKey, setFrameRef],
    );

    /* ── Keyboard navigation ── */
    const handleKeyDown = useCallback(
        (event: React.KeyboardEvent<HTMLDivElement>) => {
            if (event.key === "ArrowLeft") {
                event.preventDefault();
                moveSectionPage(sectionKey, items.length, -1);
            } else if (event.key === "ArrowRight") {
                event.preventDefault();
                moveSectionPage(sectionKey, items.length, 1);
            }
        },
        [items.length, moveSectionPage, sectionKey],
    );

    /* ── Desktop: paginated carousel ── */
    const pages = getSectionPages(items);
    const pageCount = getPageCount(items.length);
    const currentPage = getCurrentPage(sectionKey, items.length);
    const isDragging = !!draggingSections[sectionKey];
    const visiblePageDistance = isDragging ? Math.max(1, overscanPages) : overscanPages;

    const trackContent = (
        <div
            ref={setTrackRef(sectionKey)}
            className={`home-section-carousel-track ${isDragging ? "is-dragging" : ""}`}
            style={{ transform: getCarouselTransform(currentPage) }}
        >
            {pages.map((pageItems, pageIndex) => {
                const isNearby = Math.abs(pageIndex - currentPage) <= visiblePageDistance;
                return (
                    <div key={`${sectionKey}-page-${pageIndex}`} className="home-section-carousel-page">
                        {isNearby
                            ? pageItems.map((item, itemIndex) =>
                                renderItem(item, pageIndex * cardCount + itemIndex),
                            )
                            : null}
                    </div>
                );
            })}
        </div>
    );

    const effectiveContentKey = contentKey ?? sectionKey;

    return (
        <div
            ref={setRef}
            className={`${CARD_ROW_FRAME} ${isDragging ? "is-dragging" : ""} ${className ?? ""}`}
            style={rowStyle}
            tabIndex={0}
            role="region"
            aria-roledescription="carousel"
            aria-label="Content carousel"
            onKeyDown={handleKeyDown}
            onDragStart={(event) => event.preventDefault()}
            onPointerDown={(event) => handlePointerDown(event, sectionKey, items.length)}
            onPointerMove={(event) => handlePointerMove(event, sectionKey, items.length)}
            onPointerUp={(event) => finishDrag(event, sectionKey, items.length)}
            onPointerCancel={(event) => cancelDrag(sectionKey, event.currentTarget, event.pointerId)}
            onLostPointerCapture={(event) =>
                cancelDrag(sectionKey, event.currentTarget, event.pointerId)
            }
            onClickCapture={(event) => handleClickCapture(event, sectionKey)}
        >
            {wrapTrack ? wrapTrack(trackContent, effectiveContentKey) : trackContent}

            {/* Page indicators (dots) */}
            {pageCount > 1 && (
                <div className="carousel-dots" aria-hidden="true">
                    {Array.from({ length: pageCount }, (_, index) => (
                        <button
                            key={`${sectionKey}-dot-${index}`}
                            type="button"
                            className={`carousel-dot ${index === currentPage ? "carousel-dot-active" : ""}`}
                            onClick={(event) => {
                                event.stopPropagation();
                                const direction = index > currentPage ? 1 : -1;
                                // Jump directly by setting page index
                                const diff = Math.abs(index - currentPage);
                                for (let step = 0; step < diff; step++) {
                                    moveSectionPage(sectionKey, items.length, direction as -1 | 1);
                                }
                            }}
                            aria-label={`Go to page ${index + 1}`}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}
