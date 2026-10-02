/**
 * The "nothing here yet" line shown in place of a list. Renders the same
 * muted paragraph the app already used; `centered` is the roomier variant for
 * a whole-page empty list.
 */
export function EmptyState({
  children,
  centered = false,
  className = "",
}: {
  children: React.ReactNode;
  centered?: boolean;
  className?: string;
}) {
  return (
    <p className={["text-sm text-mute", centered ? "text-center py-10" : "", className].filter(Boolean).join(" ")}>
      {children}
    </p>
  );
}
