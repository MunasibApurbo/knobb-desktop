import {
    type CSSProperties,
    type MouseEvent,
    type PointerEvent as ReactPointerEvent,
    useEffect,
    useRef,
    useState,
} from "react";

/* ── Transform helper ── */

export function getCarouselTransform(pageIndex: number, dragOffset = 0) {
    return `translate3d(calc(${-pageIndex * 100}% + ${dragOffset}px), 0, 0)`;
}

/* ── Types ── */

export interface CarouselApi {
    /* state */
    sectionPageIndexes: Record<string, number>;
    draggingSections: Record<string, boolean>;

    /* helpers */
    getPageCount: (itemsLength: number) => number;
    getCurrentPage: (section: string, itemsLength: number) => number;
    getSectionPages: <T>(items: T[]) => T[][];
    moveSectionPage: (section: string, itemsLength: number, direction: -1 | 1) => void;
    shouldShowPager: (section: string, itemsLength: number) => boolean;
    canViewAll: (itemsLength: number) => boolean;

    /* refs & ref setters */
    setFrameRef: (section: string) => (node: HTMLDivElement | null) => void;
    setTrackRef: (section: string) => (node: HTMLDivElement | null) => void;

    /* row style */
    rowStyle: CSSProperties;
    cardCount: number;

    /* pointer / drag handlers */
    handlePointerDown: (event: ReactPointerEvent<HTMLDivElement>, section: string, itemsLength: number) => void;
    handlePointerMove: (event: ReactPointerEvent<HTMLDivElement>, section: string, itemsLength: number) => void;
    finishDrag: (event: ReactPointerEvent<HTMLDivElement>, section: string, itemsLength: number) => void;
    cancelDrag: (section: string, currentTarget?: HTMLDivElement, pointerId?: number) => void;
    handleClickCapture: (event: MouseEvent<HTMLDivElement>, section: string) => void;

    /* track item counts (for external sync) */
    registerItemCount: (section: string, count: number) => void;
}

/* ── Hook ── */

export function useCarousel(cardCount: number): CarouselApi {
    const [sectionPageIndexes, setSectionPageIndexes] = useState<Record<string, number>>({});
    const [draggingSections, setDraggingSections] = useState<Record<string, boolean>>({});

    const frameRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const trackRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const sectionItemCountsRef = useRef<Record<string, number>>({});
    const dragSessionsRef = useRef<
        Record<string, { pointerId: number; startX: number; lastOffset: number; moved: boolean }>
    >({});
    const dragAnimationFramesRef = useRef<Record<string, number | undefined>>({});
    const pendingTransformsRef = useRef<
        Record<string, { pageIndex: number; dragOffset: number } | undefined>
    >({});
    const clickSuppressionRef = useRef<Record<string, number>>({});

    /* ── Page math ── */

    const getPageCount = (itemsLength: number) =>
        Math.max(1, Math.ceil(itemsLength / Math.max(1, cardCount)));

    const getCurrentPage = (section: string, itemsLength: number) =>
        Math.min(sectionPageIndexes[section] ?? 0, getPageCount(itemsLength) - 1);

    function getSectionPages<T>(items: T[]) {
        const pageSize = Math.max(1, cardCount);
        const pages: T[][] = [];
        for (let index = 0; index < items.length; index += pageSize) {
            pages.push(items.slice(index, index + pageSize));
        }
        return pages;
    }

    const moveSectionPage = (section: string, itemsLength: number, direction: -1 | 1) => {
        setSectionPageIndexes((previous) => {
            const pageCount = getPageCount(itemsLength);
            const currentPage = Math.min(previous[section] ?? 0, pageCount - 1);
            const nextPage = Math.max(0, Math.min(pageCount - 1, currentPage + direction));
            if (nextPage === currentPage) return previous;
            return { ...previous, [section]: nextPage };
        });
    };

    const shouldShowPager = (_section: string, itemsLength: number) =>
        getPageCount(itemsLength) > 1;

    const canViewAll = (itemsLength: number) => itemsLength > cardCount;

    const rowStyle = {
        "--home-row-columns": Math.max(1, cardCount),
    } as CSSProperties;

    /* ── Ref setters ── */

    const setFrameRef =
        (section: string) =>
            (node: HTMLDivElement | null) => {
                frameRefs.current[section] = node;
            };

    const setTrackRef =
        (section: string) =>
            (node: HTMLDivElement | null) => {
                trackRefs.current[section] = node;
            };

    const registerItemCount = (section: string, count: number) => {
        sectionItemCountsRef.current[section] = count;
    };

    const getTrackedItemsLength = (section: string) =>
        sectionItemCountsRef.current[section] ?? 0;

    /* ── Transform helpers ── */

    const snapSectionTransform = (section: string, pageIndex: number, dragOffset = 0) => {
        const track = trackRefs.current[section];
        if (!track) return;
        track.style.transform = getCarouselTransform(pageIndex, dragOffset);
    };

    const flushSectionTransform = (section: string) => {
        const pendingTransform = pendingTransformsRef.current[section];
        const track = trackRefs.current[section];
        dragAnimationFramesRef.current[section] = undefined;
        if (!pendingTransform || !track) return;
        track.style.transform = getCarouselTransform(
            pendingTransform.pageIndex,
            pendingTransform.dragOffset,
        );
    };

    const scheduleSectionTransform = (
        section: string,
        pageIndex: number,
        dragOffset: number,
    ) => {
        pendingTransformsRef.current[section] = { pageIndex, dragOffset };
        if (dragAnimationFramesRef.current[section] != null) return;
        dragAnimationFramesRef.current[section] = window.requestAnimationFrame(() => {
            flushSectionTransform(section);
        });
    };

    const clearSectionAnimationFrame = (section: string) => {
        const frame = dragAnimationFramesRef.current[section];
        if (frame == null) return;
        window.cancelAnimationFrame(frame);
        dragAnimationFramesRef.current[section] = undefined;
    };

    /* ── Cleanup animated frames on unmount ── */

    useEffect(() => {
        const activeFrames = dragAnimationFramesRef.current;
        return () => {
            Object.keys(activeFrames).forEach((section) => {
                const frame = activeFrames[section];
                if (frame == null) return;
                window.cancelAnimationFrame(frame);
            });
        };
    }, []);

    /* ── Drag state helpers ── */

    const setSectionDragging = (section: string, next: boolean) => {
        setDraggingSections((previous) => {
            if (!!previous[section] === next) return previous;
            if (!next && !previous[section]) return previous;
            if (!next) {
                const rest = { ...previous };
                delete rest[section];
                return rest;
            }
            return { ...previous, [section]: true };
        });
    };

    const cancelDrag = (
        section: string,
        currentTarget?: HTMLDivElement,
        pointerId?: number,
    ) => {
        const session = dragSessionsRef.current[section];
        if (!session) return;
        delete dragSessionsRef.current[section];
        clearSectionAnimationFrame(section);
        pendingTransformsRef.current[section] = undefined;
        if (currentTarget && pointerId != null && currentTarget.hasPointerCapture(pointerId)) {
            currentTarget.releasePointerCapture(pointerId);
        }
        setSectionDragging(section, false);
        snapSectionTransform(section, getCurrentPage(section, getTrackedItemsLength(section)));
    };

    const cancelDragRef = useRef(cancelDrag);
    cancelDragRef.current = cancelDrag;

    /* ── Pointer event handlers ── */

    const handlePointerDown = (
        event: ReactPointerEvent<HTMLDivElement>,
        section: string,
        itemsLength: number,
    ) => {
        if (getPageCount(itemsLength) <= 1) return;
        if (event.button !== 0) return;
        const target = event.target as HTMLElement;
        if (
            target.closest(
                "button, a, input, textarea, select, [role='button'], [data-no-carousel-drag='true']",
            )
        )
            return;
        dragSessionsRef.current[section] = {
            pointerId: event.pointerId,
            startX: event.clientX,
            lastOffset: 0,
            moved: false,
        };
        clearSectionAnimationFrame(section);
        pendingTransformsRef.current[section] = undefined;
    };

    const handlePointerMove = (
        event: ReactPointerEvent<HTMLDivElement>,
        section: string,
        itemsLength: number,
    ) => {
        const session = dragSessionsRef.current[section];
        if (!session || session.pointerId !== event.pointerId) return;
        if (event.buttons === 0) {
            cancelDrag(section, event.currentTarget, event.pointerId);
            return;
        }
        const pageCount = getPageCount(itemsLength);
        const currentPage = getCurrentPage(section, itemsLength);
        const rawDelta = event.clientX - session.startX;
        const isOverscrollingStart = currentPage === 0 && rawDelta > 0;
        const isOverscrollingEnd = currentPage === pageCount - 1 && rawDelta < 0;
        const nextOffset =
            isOverscrollingStart || isOverscrollingEnd
                ? rawDelta * 0.28
                : rawDelta * 0.94;
        session.lastOffset = nextOffset;
        if (Math.abs(rawDelta) > 6) {
            if (!session.moved) {
                session.moved = true;
                if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                    event.currentTarget.setPointerCapture(event.pointerId);
                }
                setSectionDragging(section, true);
            }
        }
        if (!session.moved) return;
        scheduleSectionTransform(section, currentPage, nextOffset);
    };

    const finishDrag = (
        event: ReactPointerEvent<HTMLDivElement>,
        section: string,
        itemsLength: number,
    ) => {
        const session = dragSessionsRef.current[section];
        if (!session || session.pointerId !== event.pointerId) return;
        delete dragSessionsRef.current[section];
        clearSectionAnimationFrame(section);
        pendingTransformsRef.current[section] = undefined;
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        if (!session.moved) return;
        setSectionDragging(section, false);
        const pageCount = getPageCount(itemsLength);
        const currentPage = getCurrentPage(section, itemsLength);
        const frameWidth =
            frameRefs.current[section]?.clientWidth ?? event.currentTarget.clientWidth;
        const threshold = Math.max(56, frameWidth * 0.14);
        const direction =
            Math.abs(session.lastOffset) >= threshold
                ? session.lastOffset < 0
                    ? 1
                    : -1
                : 0;
        const targetPage = Math.max(
            0,
            Math.min(pageCount - 1, currentPage + direction),
        );
        snapSectionTransform(section, targetPage);
        if (targetPage !== currentPage) {
            moveSectionPage(section, itemsLength, direction as -1 | 1);
        }
        if (session.moved) {
            clickSuppressionRef.current[section] = Date.now() + 220;
        }
    };

    const handleClickCapture = (
        event: MouseEvent<HTMLDivElement>,
        section: string,
    ) => {
        const suppressUntil = clickSuppressionRef.current[section];
        if (!suppressUntil || suppressUntil < Date.now()) return;
        event.preventDefault();
        event.stopPropagation();
        delete clickSuppressionRef.current[section];
    };

    /* ── Window-level cancel on blur / visibility change ── */

    useEffect(() => {
        if (typeof window === "undefined") return;
        const cancelAll = () => {
            Object.keys(dragSessionsRef.current).forEach((section) => {
                cancelDragRef.current(section);
            });
        };
        window.addEventListener("blur", cancelAll);
        document.addEventListener("visibilitychange", cancelAll);
        return () => {
            window.removeEventListener("blur", cancelAll);
            document.removeEventListener("visibilitychange", cancelAll);
        };
    }, []);

    return {
        sectionPageIndexes,
        draggingSections,
        getPageCount,
        getCurrentPage,
        getSectionPages,
        moveSectionPage,
        shouldShowPager,
        canViewAll,
        setFrameRef,
        setTrackRef,
        rowStyle,
        cardCount,
        handlePointerDown,
        handlePointerMove,
        finishDrag,
        cancelDrag,
        handleClickCapture,
        registerItemCount,
    };
}
