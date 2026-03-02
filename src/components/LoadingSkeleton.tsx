import { motion } from "framer-motion";

export function LoadingSkeleton() {
  return (
    <div className="flex items-center justify-center h-64">
      <motion.div
        animate={{ opacity: [0.3, 1, 0.3] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        className="flex gap-1 items-end"
      >
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            animate={{ scaleY: [0.3, 1, 0.3] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.08 }}
            className="w-1.5 h-8 rounded-full bg-[hsl(var(--dynamic-accent))]"
          />
        ))}
      </motion.div>
    </div>
  );
}
