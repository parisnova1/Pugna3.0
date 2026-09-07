import Link from "next/link";
import type { EventStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { EventPreviewCard } from "@/components/event/EventPreviewCard";

type Filter = "today" | "week" | "upcoming" | "finished";

const LIVE_ISH: EventStatus[] = ["PUBLISHED", "LIVE", "INTERMISSION"];

const FILTERS: { key: Filter; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "week", label: "This week" },
  { key: "upcoming", label: "Upcoming" },
  { key: "finished", label: "Finished" },
];

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: Filter }>;
}) {
  const { filter = "upcoming" } = await searchParams;

  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfDay = new Date(startOfDay.getTime() + 24 * 60 * 60 * 1000);
  const endOfWeek = new Date(startOfDay.getTime() + 7 * 24 * 60 * 60 * 1000);

  const where: Prisma.EventWhereInput =
    filter === "today"
      ? { date: { gte: startOfDay, lt: endOfDay }, status: { in: LIVE_ISH } }
      : filter === "week"
        ? { date: { gte: startOfDay, lt: endOfWeek }, status: { in: LIVE_ISH } }
        : filter === "finished"
          ? { status: "FINISHED" }
          : { status: { in: LIVE_ISH } };

  const events = await prisma.event.findMany({
    where,
    orderBy: { date: filter === "finished" ? "desc" : "asc" },
    take: 30,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between pt-2">
        <h1 className="text-2xl font-semibold">Events</h1>
        <Link href="/scan" aria-label="Scan QR" className="rounded-full border border-white/15 p-2.5">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
            <path d="M14 14h3v3h-3zM20 14v3M14 20h3M20 20v.01" />
          </svg>
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/events?filter=${f.key}`}
            className={[
              "shrink-0 rounded-pill px-4 py-2 text-sm font-medium border",
              filter === f.key ? "bg-ink text-void border-ink" : "border-white/15 text-mute",
            ].join(" ")}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {events.length === 0 ? (
        <div className="text-center py-16 space-y-4">
          <p className="text-mute text-sm">No events nearby yet.</p>
          <Link href="/scan" className="inline-block rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm">
            Scan QR
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event) => (
            <EventPreviewCard key={event.id} event={event} />
          ))}
        </div>
      )}
    </div>
  );
}
