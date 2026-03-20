import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showLabel?: boolean;
  withInteractiveKnob?: boolean;
};

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  showLabel = false,
  withInteractiveKnob = false,
}: BrandLogoProps) {
  const kPath = "M58 32H106V109.77L178.227 32H238L155.024 122.065L246 224H183.273L106 138.346V224H58V32Z";

  if (withInteractiveKnob) {
    return (
      <div className={cn("flex items-center gap-0", className)}>
        <div className="relative h-12 w-12 shrink-0 select-none">
          <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="h-full w-full">
            {/* Knob Base / Outer Ring */}
            <circle cx="50" cy="50" r="48" fill="var(--bg)" stroke="currentColor" strokeWidth="1" opacity="0.2" />
            <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="0.5" strokeDasharray="2 4" opacity="0.5" />
            
            {/* Rotating Dial Group */}
            <g style={{ transform: 'rotate(var(--knob-rotation, 0deg))', transformOrigin: 'center' }}>
              <circle cx="50" cy="50" r="38" fill="currentColor" />
              {/* Scaled K logo inside the dial */}
              <g transform="translate(30, 30) scale(0.15)">
                <path d={kPath} fill="#000" />
              </g>
              {/* Precision Notch */}
              <rect x="48" y="5" width="4" height="12" rx="2" fill="#000" />
            </g>
          </svg>
        </div>
        {showLabel && (
          <span className={cn("truncate text-xl font-extrabold tracking-tight text-foreground", textClassName)}>
            NOBB
          </span>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 256 256"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={cn("h-8 w-8 shrink-0 select-none text-foreground", markClassName)}
      >
        <path d={kPath} fill="currentColor" />
      </svg>
      {showLabel ? (
        <span className={cn("truncate text-lg font-extrabold tracking-tight text-foreground", textClassName)}>
          KNOBB
        </span>
      ) : null}
    </div>
  );
}
