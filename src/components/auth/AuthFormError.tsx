import { AlertCircle } from "lucide-react";

/**
 * Form-level error banner for auth actions (DESIGN_SYSTEM.md §5.11, §9). Server
 * errors that aren't tied to a single field surface here. `role="alert"` so
 * screen readers announce it; paired with an icon so state isn't color-alone.
 */
export function AuthFormError({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="flex items-start gap-2 rounded-xl border border-error/40 bg-error/10 px-4 py-3 text-footnote font-medium text-error-text"
    >
      <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
}
