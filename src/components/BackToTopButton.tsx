import { AnimatePresence, motion } from "framer-motion";
import { ChevronUp } from "lucide-react";
import { useCallback } from "react";
import { useMainScrollY, MAIN_SCROLL_VIEWPORT_SELECTOR } from "@/hooks/useMainScrollY";
import { OVERLAY_SURFACE_CLASS } from "@/components/ui/surfaceStyles";
import { cn } from "@/lib/utils";

export function BackToTopButton() {
    const scrollY = useMainScrollY();
    const show = scrollY > 400;

    const scrollToTop = useCallback(() => {
        const viewport = document.querySelector<HTMLElement>(MAIN_SCROLL_VIEWPORT_SELECTOR);
        if (viewport) {
            viewport.scrollTo({ top: 0, behavior: "smooth" });
        }
    }, []);

    return (
        <AnimatePresence>
            {show && (
                <motion.button
                    initial={{ opacity: 0, y: 20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.8 }}
                    whileHover={{ scale: 1.1, translateY: -2 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={scrollToTop}
                    className={cn(
                        "fixed bottom-24 right-8 z-[100] flex h-12 w-12 items-center justify-center rounded-full transition-shadow hover:shadow-xl md:bottom-32 md:right-12",
                        OVERLAY_SURFACE_CLASS,
                        "border-white/20 bg-black/60 shadow-2xl backdrop-blur-3xl ring-0"
                    )}
                    aria-label="Back to top"
                >
                    <ChevronUp className="h-6 w-6 text-white/90" />
                </motion.button>
            )}
        </AnimatePresence>
    );
}
