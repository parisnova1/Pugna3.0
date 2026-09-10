"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { formatEventDate } from "@/lib/format";
import { EventPreviewCard, type EventPreview } from "@/components/event/EventPreviewCard";
import { SeeAllLink } from "@/components/event/SeeAllLink";
import { EventCodeBar } from "@/components/event/EventCodeBar";
import type { MapPoint } from "@/components/home/LiveMap";

const LiveMap = dynamic(() => import("@/components/home/LiveMap").then((m) => m.LiveMap), { ssr: false });

type EventRow = EventPreview & {
  id: string;
  latitude: number | null;
  longitude: number | null;
  coverUrl: string | null;
  checkedInCount: number;
};
type SparringRow = {
  id: string;
  gym: string;
  city: string | null;
  date: Date;
  latitude: number | null;
  longitude: number | null;
  club: { name: string };
  weightGroups: { label: string }[];
};

function toPoints(events: EventRow[], hrefFor: (e: EventRow) => string | null): MapPoint[] {
  return events
    .filter((e) => e.latitude != null && e.longitude != null)
    .map((e) => {
      const href = hrefFor(e);
      return href ? { id: e.id, lat: e.latitude!, lng: e.longitude!, label: e.name, href } : null;
    })
    .filter((p): p is MapPoint => p != null);
}

export function HomeTabs({
  live,
  upcoming,
  openSparring,
}: {
  live: EventRow[];
  upcoming: EventRow[];
  openSparring: SparringRow[];
}) {
  const [tab, setTab] = useState<"events" | "sparring">("events");

  const mapEvents = live.length > 0 ? live : upcoming;
  const eventPoints = toPoints(mapEvents, (e) => (e.slug ? `/e/${e.slug}` : null));
  const sparringPoints: MapPoint[] = openSparring
    .filter((s) => s.latitude != null && s.longitude != null)
    .map((s) => ({ id: s.id, lat: s.latitude!, lng: s.longitude!, label: s.club.name, href: `/sparring/${s.id}` }));

  return (
    <div className="space-y-6">
      <EventCodeBar />

      <div className="flex gap-2">
        <button
          onClick={() => setTab("events")}
          className={`flex-1 rounded-pill font-semibold px-5 py-3 text-sm transition-colors ${
            tab === "events" ? "bg-signal text-onsignal" : "border border-white/20 text-ink"
          }`}
        >
          Explore Events
        </button>
        <button
          onClick={() => setTab("sparring")}
          className={`flex-1 rounded-pill font-semibold px-5 py-3 text-sm transition-colors ${
            tab === "sparring" ? "bg-signal text-onsignal" : "border border-white/20 text-ink"
          }`}
        >
          Find Sparring
        </button>
      </div>

      {tab === "events" ? (
        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">
                {live.length > 0 ? "Live now" : "Upcoming near you"}
              </h2>
              <SeeAllLink href="/events?filter=live" />
            </div>
            {eventPoints.length > 0 ? (
              <LiveMap points={eventPoints} />
            ) : (
              <p className="text-sm text-mute">No events on the map yet.</p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Upcoming events</h2>
              <SeeAllLink href="/events" />
            </div>
            {upcoming.length === 0 ? (
              <p className="text-sm text-mute">No events nearby yet.</p>
            ) : (
              <div className="space-y-3">
                {upcoming.map((event) => (
                  <EventPreviewCard key={event.id} event={event} coverUrl={event.coverUrl} checkedInCount={event.checkedInCount} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Open sparring near you</h2>
            {sparringPoints.length > 0 ? (
              <LiveMap points={sparringPoints} />
            ) : (
              <p className="text-sm text-mute">No open sparring on the map yet.</p>
            )}
          </section>

          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Open sparring to join</h2>
              <SeeAllLink href="/sparring" />
            </div>
            {openSparring.length === 0 ? (
              <p className="text-sm text-mute">No open sparring sessions right now.</p>
            ) : (
              <div className="space-y-3">
                {openSparring.map((session) => (
                  <Link
                    key={session.id}
                    href={`/sparring/${session.id}`}
                    className="block rounded-card bg-panel border border-white/10 p-4 hover:border-white/20 transition-colors"
                  >
                    <p className="font-semibold text-sm">{session.club.name}</p>
                    <p className="text-xs text-mute mt-1">
                      {session.gym} · {formatEventDate(session.date)}
                      {session.weightGroups[0] ? ` · ${session.weightGroups[0].label}` : ""}
                    </p>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
