import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { useMotionPreferences } from "@/hooks/useMotionPreferences";
import { getControlHover, getControlTap, getMotionProfile } from "@/lib/motion";

interface FilterPillProps<T extends string> {
  options: { key: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function FilterPill<T extends string>({ options, value, onChange, className }: FilterPillProps<T>) {
  const { motionEnabled, websiteMode } = useMotionPreferences();
  const motionProfile = getMotionProfile(websiteMode);

  return (
    <div className={cn("flex gap-1.5 overflow-x-auto scrollbar-hide", className)}>
      {options.map((opt) => (
        <motion.button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          whileHover={getControlHover(motionEnabled, websiteMode)}
          whileTap={getControlTap(motionEnabled, websiteMode)}
          transition={motionProfile.spring.control}
          className={cn(
            "group relative overflow-hidden border border-white/10 px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === opt.key
              ? "bg-[hsl(var(--player-waveform))] text-black shadow-sm"
              : "bg-transparent text-white/72 hover:text-black"
          )}
        >
          {value !== opt.key && (
            <span className="absolute inset-0 origin-left scale-x-0 bg-[hsl(var(--player-waveform)/0.95)] transition-transform duration-300 ease-out group-hover:scale-x-100" />
          )}
          <span className="relative z-10 inline-flex items-center gap-1.5">
            {opt.icon ? <span className="inline-flex">{opt.icon}</span> : null}
            {opt.label}
          </span>
        </motion.button>
      ))}
    </div>
  );
}
