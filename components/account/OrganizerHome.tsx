import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { computeRingProjections } from "@/lib/projection";
import { createEvent } from "@/lib/actions/event";
import { formatEventDate } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";
import type { Actor } from "@/lib/rbac";

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The Organizer's account homepage — an event operations command center, not
 * a social/profile dashboard. Rendered instead of the normal viewer account
 * page for anyone with `actor.isOrganizer`; the viewer page underneath is
 * completely untouched for everyone else (single account, capability-driven
 * UI, per the brief — not a second account system).
 */
export async function OrganizerHome({ actor, unreadCount }: { actor: NonNullable<Actor>; unreadCount: number }) {
  const events = await prisma.event.findMany({
    where: { hostMembers: { some: { userId: actor.userId } } },
    orderBy: { date: "asc" },
  });

  const liveEvent = events.find((e) => e.status === "LIVE" || e.status === "INTERMISSION") ?? null;
  const otherEvents = events.filter((e) => e.id !== liveEvent?.id);
  const upcomingEvents = otherEvents.filter((e) => ["DRAFT", "READY", "PUBLISHED"].includes(e.status));
  const pastEvents = otherEvents.filter((e) => ["FINISHED", "CANCELLED", "ARCHIVED"].includes(e.status));
  const nextUpcoming = upcomingEvents[0] ?? null;

  // The event Quick Actions / Organizer Tools act on — whichever the
  // organizer is most likely mid-task on right now.
  const currentEvent = liveEvent ?? nextUpcoming;

  let ringLines: { label: string; text: string; live: boolean }[] = [];
  let dayCount = 1;
  let boutCount = 0;
  if (liveEvent) {
    const full = await prisma.event.findUnique({
      where: { id: liveEvent.id },
      include: { rings: { orderBy: { number: "asc" } }, bouts: { orderBy: { number: "asc" } } },
    });
    if (full) {
      dayCount = full.dayCount;
      boutCount = full.bouts.filter((b) => b.status !== "DRAFT").length;
      const projections = computeRingProjections(full.status, full.rings, full.bouts);
      ringLines = full.rings.map((ring) => {
        const p = projections.get(ring.id);
        const label = ring.name ?? `Ring ${ring.number}`;
        if (!p || (!p.now && !p.next)) return { label, text: "No bout scheduled", live: false };
        if (p.nowLabel === "BREAK") return { label, text: "BREAK", live: false };
        if (p.now) {
          const statusText = p.nowLabel === "LIVE" ? "LIVE" : p.nowLabel === "UP_NEXT" ? "NEXT" : p.nowLabel === "DELAYED" ? "DELAYED" : "";
          return { label, text: `Bout ${p.now.number} — ${statusText}`, live: p.nowLabel === "LIVE" };
        }
        if (p.next) return { label, text: `Bout ${p.next.number} — NEXT`, live: false };
        return { label, text: "—", live: false };
      });
    }
  }

  const currentEventHref = currentEvent
    ? currentEvent.status === "DRAFT" || currentEvent.status === "READY"
      ? `/host/events/${currentEvent.id}/build`
      : `/host/events/${currentEvent.id}`
    : null;

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {greeting(new Date())},
          <br />
          Organizer.
        </h1>
        <Link
          href="/you/notifications"
          className="shrink-0 rounded-pill border border-white/15 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
        >
          🔔 {unreadCount > 0 ? `${unreadCount} new` : "Notifications"}
        </Link>
      </div>

      <section className="rounded-card bg-panel border border-white/10 p-5 space-y-3">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Ready to run your next event?</p>
        <form
          action={async () => {
            "use server";
            const result = await createEvent();
            if (result.ok) redirect(`/host/events/${result.eventId}/build`);
          }}
        >
          <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-bold py-3.5">
            + Host an Event
          </button>
        </form>
        <p className="text-xs text-mute">
          Create and manage tournaments, fight nights and other combat-sport events with PUGNA.
        </p>
      </section>

      <section className="space-y-3">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Your events</p>

        {events.length === 0 && (
          <div className="rounded-card bg-panel border border-white/10 p-5 text-center space-y-1">
            <p className="font-semibold text-sm">Host your first event</p>
            <p className="text-xs text-mute">Create and manage your first event with PUGNA.</p>
          </div>
        )}

        {liveEvent && (
          <div className="rounded-card bg-panel border border-live/40 p-5 space-y-3">
            <Badge live tone="live">
              LIVE NOW
            </Badge>
            <p className="text-lg font-bold leading-tight">{liveEvent.name}</p>
            <p className="text-xs text-mute uppercase tracking-wide">
              Day {dayCount} · {ringLines.length} ring{ringLines.length === 1 ? "" : "s"} · {boutCount} bout{boutCount === 1 ? "" : "s"}
            </p>
            {ringLines.length > 0 && (
              <div className="space-y-1 pt-1">
                {ringLines.map((r) => (
                  <div key={r.label} className="flex items-center justify-between text-sm">
                    <span className="text-mute">{r.label}</span>
                    <span className={r.live ? "text-live font-semibold" : "text-ink"}>{r.text}</span>
                  </div>
                ))}
              </div>
            )}
            <Link
              href={`/host/events/${liveEvent.id}/live`}
              className="block text-center rounded-pill bg-signal text-onsignal font-bold py-3 mt-1"
            >
              Open Event Control →
            </Link>
          </div>
        )}

        {!liveEvent && nextUpcoming && (
          <Link
            href={currentEventHref!}
            className="block rounded-card bg-panel border border-white/10 p-5 space-y-2"
          >
            <p className="font-semibold text-sm">{nextUpcoming.name}</p>
            <p className="text-xs text-mute">
              {formatEventDate(nextUpcoming.date)} · Upcoming
            </p>
            <p className="text-sm font-semibold text-signal pt-1">Manage Event →</p>
          </Link>
        )}

        {[...upcomingEvents.slice(liveEvent ? 0 : 1), ...pastEvents].map((event) => (
          <Link
            key={event.id}
            href={event.status === "DRAFT" || event.status === "READY" ? `/host/events/${event.id}/build` : `/host/events/${event.id}`}
            className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{event.name}</p>
              <p className="text-xs text-mute mt-0.5">{formatEventDate(event.date)}</p>
            </div>
            <span className="text-xs text-mute">
              {["FINISHED", "CANCELLED", "ARCHIVED"].includes(event.status) ? "View event" : event.status}
            </span>
          </Link>
        ))}
      </section>

      {currentEvent && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Quick actions</p>
          <div className="grid grid-cols-2 gap-2">
            <Link href={`/host/events/${currentEvent.id}/pair`} className="rounded-card bg-panel border border-white/10 p-3 text-center text-sm font-semibold">
              + Add Bout
            </Link>
            <Link href={`/host/events/${currentEvent.id}/checkin`} className="rounded-card bg-panel border border-white/10 p-3 text-center text-sm font-semibold">
              Check-In
            </Link>
            <Link href={`/host/events/${currentEvent.id}/build`} className="rounded-card bg-panel border border-white/10 p-3 text-center text-sm font-semibold">
              Update Event
            </Link>
            <Link
              href={liveEvent ? `/host/events/${liveEvent.id}/live` : `/host/events/${currentEvent.id}`}
              className="rounded-card bg-panel border border-white/10 p-3 text-center text-sm font-semibold"
            >
              Announcement
            </Link>
          </div>
        </section>
      )}

      <section className="space-y-1">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide px-1">Organizer tools</p>
        <div className="rounded-card bg-panel border border-white/10 divide-y divide-white/10">
          <ToolRow href="/host/events" label="Events" />
          {currentEvent && (
            <>
              <ToolRow href={`/host/events/${currentEvent.id}/pair`} label="Pair Fighters" />
              <ToolRow href={`/host/events/${currentEvent.id}/entries`} label="Manage Boxers" />
              {liveEvent && <ToolRow href={`/host/events/${liveEvent.id}/live`} label="Live Control" />}
              <ToolRow href={`/host/events/${currentEvent.id}/schedule`} label="Event Schedule" />
              <ToolRow href={`/host/events/${currentEvent.id}/structure`} label="Rings" />
              <ToolRow href={`/host/events/${currentEvent.id}/checkin`} label="Check-In" />
              <ToolRow href={`/host/events/${currentEvent.id}/media`} label="Media" />
              <ToolRow href={`/host/events/${currentEvent.id}/review`} label="Event Settings" />
            </>
          )}
        </div>
      </section>

      <Link
        href="/account/settings"
        className="block rounded-card bg-panel border border-white/10 p-4 text-sm font-semibold text-center"
      >
        Account & Settings →
      </Link>
    </div>
  );
}

function ToolRow({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center justify-between px-4 py-3 text-sm">
      <span>{label}</span>
      <span className="text-mute">›</span>
    </Link>
  );
}
