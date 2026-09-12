import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import type { SearchResult } from "@/lib/search-query";

/** One normalized row shape for every search result kind — events, boxers, clubs and sparring
 * sessions are all genuinely "title + subtitle + link, optional status badge," so this is one
 * component instead of four near-duplicate card layouts. */
export function SearchResultRow({ result }: { result: SearchResult }) {
  return (
    <Link
      href={result.href}
      className="flex items-center justify-between gap-3 rounded-card bg-panel border border-white/10 px-4 py-3 hover:border-white/20 transition-colors"
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate">{result.title}</p>
        <p className="text-xs text-mute truncate">{result.subtitle}</p>
      </div>
      {result.badge && (
        <Badge live={result.badge.tone === "live"} tone={result.badge.tone}>
          {result.badge.text}
        </Badge>
      )}
    </Link>
  );
}
