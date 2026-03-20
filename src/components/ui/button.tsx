import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--control-radius)] text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-[18px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "menu-sweep-hover relative bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "destructive-sweep-hover relative bg-destructive text-destructive-foreground hover:bg-destructive hover:text-destructive-foreground",
        outline: "menu-sweep-hover relative border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "menu-sweep-hover relative bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "menu-sweep-hover relative hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9  px-3",
        lg: "h-11  px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  allowGlobalShortcuts?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ allowGlobalShortcuts = false, className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const shortcutSafeByClassName =
      typeof className === "string" && (
        className.includes("detail-action-button") ||
        className.includes("bottom-player-control") ||
        className.includes("player-chrome-utility")
      );

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        data-allow-global-shortcuts={allowGlobalShortcuts || shortcutSafeByClassName ? "true" : undefined}
        ref={ref}
        {...props}
      />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
