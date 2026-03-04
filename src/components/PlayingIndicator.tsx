import { motion } from "framer-motion";

export function PlayingIndicator({ isPaused }: { isPaused?: boolean }) {
    return (
        <div className="flex items-end justify-center gap-[2px] w-4 h-4 overflow-hidden">
            <motion.div
                className="w-[3px] bg-[hsl(var(--dynamic-accent-foreground))]"
                animate={{ height: isPaused ? "4px" : ["4px", "14px", "4px"] }}
                transition={isPaused ? { duration: 0.2 } : { duration: 0.8, repeat: Infinity, ease: "easeInOut", delay: 0 }}
            />
            <motion.div
                className="w-[3px] bg-[hsl(var(--dynamic-accent-foreground))]"
                animate={{ height: isPaused ? "4px" : ["8px", "16px", "8px"] }}
                transition={isPaused ? { duration: 0.2 } : { duration: 0.9, repeat: Infinity, ease: "easeInOut", delay: 0.2 }}
            />
            <motion.div
                className="w-[3px] bg-[hsl(var(--dynamic-accent-foreground))]"
                animate={{ height: isPaused ? "4px" : ["6px", "12px", "6px"] }}
                transition={isPaused ? { duration: 0.2 } : { duration: 0.7, repeat: Infinity, ease: "easeInOut", delay: 0.4 }}
            />
        </div>
    );
}
