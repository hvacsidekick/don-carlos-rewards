/** "or" divider between OAuth buttons and the email form (decorative). */
export function OrDivider() {
  return (
    <div className="flex items-center gap-3" aria-hidden="true">
      <span className="h-px flex-1 bg-separator" />
      <span className="text-footnote text-fg-tertiary">or</span>
      <span className="h-px flex-1 bg-separator" />
    </div>
  );
}
