import { cn } from "@/lib/utils";

interface FilterPillProps<T extends string> {
  options: { key: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function FilterPill<T extends string>({ options, value, onChange, className }: FilterPillProps<T>) {
  return (
    <div className={cn("flex gap-2 overflow-x-auto scrollbar-hide", className)}>
      {options.map((opt) => (
        <button
          key={opt.key}
          onClick={() => onChange(opt.key)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            value === opt.key
              ? "bg-foreground text-background shadow-sm"
              : "bg-accent text-muted-foreground hover:bg-accent/80 hover:text-foreground"
          )}
        >
          {opt.icon && <span className="mr-1.5 inline-flex">{opt.icon}</span>}
          {opt.label}
        </button>
      ))}
    </div>
  );
}
