import { cn } from "@/lib/utils";

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  showLabel?: boolean;
};

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  showLabel = false,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        viewBox="0 0 256 256"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={cn("h-8 w-8 shrink-0 select-none text-foreground", markClassName)}
      >
        <path
          d="M58 32H106V109.77L178.227 32H238L155.024 122.065L246 224H183.273L106 138.346V224H58V32Z"
          fill="currentColor"
        />
      </svg>
      {showLabel ? (
        <span className={cn("truncate text-lg font-extrabold tracking-tight text-foreground", textClassName)}>
          KNOBB
        </span>
      ) : null}
    </div>
  );
}
