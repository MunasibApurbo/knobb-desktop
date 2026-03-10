import { useEffect, useRef } from "react";
import { MAIN_SCROLL_VIEWPORT_SELECTOR } from "./useMainScrollY";

/**
 * Lerp-based smooth scroll for the main content viewport.
 * Intercepts wheel events and animates scroll position using
 * requestAnimationFrame for ultra-smooth results, especially
 * with high-DPI mice (16k+ DPI).
 */
export function useSmoothScroll(enabled = true) {
    const rafRef = useRef<number | null>(null);
    const targetScrollRef = useRef(0);
    const currentScrollRef = useRef(0);
    const isAnimatingRef = useRef(false);

    useEffect(() => {
        if (!enabled) return;

        const viewport = document.querySelector<HTMLElement>(
            MAIN_SCROLL_VIEWPORT_SELECTOR,
        );
        if (!viewport) return;

        // Sync initial position
        currentScrollRef.current = viewport.scrollTop;
        targetScrollRef.current = viewport.scrollTop;

        const LERP_FACTOR = 0.12; // How fast to converge (0.08 = very smooth, 0.2 = snappy)
        const EPSILON = 0.5; // Stop threshold in px

        const animate = () => {
            const diff = targetScrollRef.current - currentScrollRef.current;

            if (Math.abs(diff) < EPSILON) {
                // Snap to target and stop
                currentScrollRef.current = targetScrollRef.current;
                viewport.scrollTop = currentScrollRef.current;
                isAnimatingRef.current = false;
                rafRef.current = null;
                return;
            }

            // Lerp towards target
            currentScrollRef.current += diff * LERP_FACTOR;
            viewport.scrollTop = currentScrollRef.current;

            rafRef.current = requestAnimationFrame(animate);
        };

        const startAnimation = () => {
            if (isAnimatingRef.current) return;
            isAnimatingRef.current = true;
            rafRef.current = requestAnimationFrame(animate);
        };

        const handleWheel = (event: WheelEvent) => {
            // Don't intercept horizontal scrolls or when user is scrolling
            // inside a nested scrollable area (dialog, dropdown, etc.)
            const target = event.target as HTMLElement;
            if (target.closest("[data-no-smooth-scroll]")) return;

            // Check if target is inside a nested scroll container (not the main viewport)
            let el: HTMLElement | null = target;
            while (el && el !== viewport) {
                const style = window.getComputedStyle(el);
                const overflowY = style.overflowY;
                if (
                    (overflowY === "auto" || overflowY === "scroll") &&
                    el.scrollHeight > el.clientHeight &&
                    el !== viewport
                ) {
                    // This is a nested scrollable - don't intercept
                    return;
                }
                el = el.parentElement;
            }

            event.preventDefault();

            // Sync if scroll was changed externally (e.g. programmatic scroll)
            if (
                !isAnimatingRef.current &&
                Math.abs(viewport.scrollTop - currentScrollRef.current) > 1
            ) {
                currentScrollRef.current = viewport.scrollTop;
                targetScrollRef.current = viewport.scrollTop;
            }

            // Accumulate delta towards target
            const delta = event.deltaY;
            targetScrollRef.current += delta;

            // Clamp to scroll bounds
            const maxScroll = viewport.scrollHeight - viewport.clientHeight;
            targetScrollRef.current = Math.max(
                0,
                Math.min(maxScroll, targetScrollRef.current),
            );

            startAnimation();
        };

        // Handle scroll events from other sources (keyboard, scrollbar drag)
        const handleScroll = () => {
            if (isAnimatingRef.current) return;
            // Sync positions when scroll happens from non-wheel sources
            currentScrollRef.current = viewport.scrollTop;
            targetScrollRef.current = viewport.scrollTop;
        };

        viewport.addEventListener("wheel", handleWheel, { passive: false });
        viewport.addEventListener("scroll", handleScroll, { passive: true });

        return () => {
            viewport.removeEventListener("wheel", handleWheel);
            viewport.removeEventListener("scroll", handleScroll);
            if (rafRef.current != null) {
                cancelAnimationFrame(rafRef.current);
                rafRef.current = null;
            }
            isAnimatingRef.current = false;
        };
    }, [enabled]);
}
