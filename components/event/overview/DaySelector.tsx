import Link from "next/link";
import { dayContextLabel } from "@/lib/format";

export function DaySelector({
  slug,
  dayCount,
  eventDate,
  selectedDay,
  boutCounts,
  buildQuery,
}: {
  slug: string;
  dayCount: number;
  eventDate: Date;
  selectedDay: number;
  boutCounts: number[];
  buildQuery: (changes: { day?: string; weight?: string }) => string;
}) {
  if (dayCount <= 1) return null;

  return (
    <div className="mb-5">
      <div className="flex rounded-pill border border-white/15 p-1 gap-1">
        {Array.from({ length: dayCount }, (_, i) => i + 1).map((d) => (
          <Link
            key={d}
            href={`/e/${slug}${buildQuery({ day: String(d) })}`}
            className={[
              "flex-1 text-center rounded-pill py-2.5 text-sm font-semibold transition-colors",
              d === selectedDay ? "bg-signal text-onsignal" : "text-mute",
            ].join(" ")}
          >
            Day {d}
          </Link>
        ))}
      </div>
      <p className="text-xs text-mute mt-2 px-1">
        {dayContextLabel(eventDate, selectedDay, boutCounts[selectedDay - 1] ?? 0)}
      </p>
    </div>
  );
}
