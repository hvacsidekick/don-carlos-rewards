"use client";

import { Toaster as Sonner, type ToasterProps } from "sonner";

/**
 * Toast host (sonner). We use `darkMode: 'media'` with no theme provider, so
 * the toaster follows the OS via sonner's built-in `theme="system"`.
 * Styled to the design tokens (DESIGN_SYSTEM.md §7.2 toast).
 */
function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="system"
      className="toaster group"
      position="top-center"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card group-[.toaster]:text-card-foreground group-[.toaster]:border-border group-[.toaster]:rounded-2xl group-[.toaster]:shadow-card-hero",
          description: "group-[.toast]:text-fg-secondary",
          actionButton: "group-[.toast]:bg-dc-red group-[.toast]:text-white",
          cancelButton: "group-[.toast]:bg-fill-quaternary group-[.toast]:text-foreground",
        },
      }}
      {...props}
    />
  );
}

export { Toaster };
