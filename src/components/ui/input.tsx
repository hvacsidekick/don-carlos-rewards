import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Input (DESIGN_SYSTEM.md §5.11). 44px+ height, 16px+ text (prevents iOS
 * zoom-on-focus), rounded-xl, --bg-secondary fill, --dc-red focus ring.
 */
const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        ref={ref}
        className={cn(
          "flex min-h-11 w-full rounded-xl border border-input bg-surface-secondary px-4 py-2.5 text-body text-foreground transition-colors",
          "placeholder:text-fg-tertiary",
          "file:border-0 file:bg-transparent file:text-body-emph file:text-foreground",
          "focus-visible:border-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-0",
          "disabled:cursor-not-allowed disabled:opacity-50",
          "aria-[invalid=true]:border-error aria-[invalid=true]:ring-error",
          className,
        )}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
