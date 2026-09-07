import Link from "next/link";

export function SeeAllLink({ href, label = "See all" }: { href: string; label?: string }) {
  return (
    <Link
      href={href}
      className="inline-flex items-center gap-0.5 rounded-pill border border-white/15 px-3 py-1 text-xs font-medium text-ink shrink-0"
    >
      {label}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </Link>
  );
}
