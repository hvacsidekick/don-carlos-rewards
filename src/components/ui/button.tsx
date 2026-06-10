import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

/**
 * Button (DESIGN_SYSTEM.md §5.10). Height ≥ 44px on default/lg to satisfy
 * the 44pt touch-target rule. Pressed feedback via active:scale.
 */
const buttonVariants = cva(
  // Disabled (DESIGN_SYSTEM §5.10 / §4.6): neutral --text-tertiary on
  // --fill-quaternary, no shadow — overrides the live variant's fill/text.
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-body-emph font-semibold transition-[transform,background-color,opacity] active:scale-[0.97] disabled:pointer-events-none disabled:bg-fill-quaternary disabled:text-fg-tertiary disabled:shadow-none disabled:hover:bg-fill-quaternary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:size-5 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // AA fill so the white label clears 4.5:1 (see --dc-red-fill, C-2/F-1).
        primary: "bg-dc-red-fill text-white hover:bg-dc-red-fill/90",
        secondary: "bg-fill-quaternary text-foreground hover:bg-fill-quaternary/70",
        tertiary: "bg-transparent text-dc-red-text hover:bg-fill-quaternary",
        // AA red text; on confirm/hover, fill with the same darker red + white.
        destructive: "bg-transparent text-error-text hover:bg-error-text hover:text-white",
        outline: "border border-input bg-transparent text-foreground hover:bg-accent",
        ghost: "bg-transparent text-foreground hover:bg-accent",
        link: "bg-transparent text-dc-red-text underline-offset-4 hover:underline",
      },
      size: {
        default: "min-h-11 px-5 py-2.5",
        sm: "min-h-9 rounded-lg px-3 text-footnote",
        lg: "min-h-12 rounded-xl px-6",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
