import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full px-2.5 py-0.5 text-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&_svg]:size-3",
  {
    variants: {
      variant: {
        // AA fill so white label clears 4.5:1 (see --dc-red-fill, C-2/F-1).
        default: "bg-dc-red-fill text-white",
        secondary: "bg-fill-quaternary text-foreground",
        // Tinted semantic badges use the AA on-tint *-text colors (C-2).
        success: "bg-success/15 text-success-text",
        warning: "bg-warning/15 text-warning-text",
        // Fresh / menu tags (DESIGN_SYSTEM §5.7 dietary pills).
        fresh: "bg-dc-green/15 text-dc-green-text",
        outline: "border border-border text-foreground",
        destructive: "bg-error/15 text-error-text",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {
  asChild?: boolean;
}

function Badge({ className, variant, asChild = false, ...props }: BadgeProps) {
  const Comp = asChild ? Slot : "span";
  return <Comp className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
