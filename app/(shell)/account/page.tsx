import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { AuthScreen } from "@/components/account/AuthScreen";
import { formatEventDate, formatCountdown } from "@/lib/format";
import { Badge } from "@/components/ui/Badge";

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function guestMessage(returnTo: string | undefined): string | undefined {
  if (!returnTo) return undefined;
  if (returnTo.startsWith("/sparring/host")) return "Create an account to host sparring sessions.";
  if (returnTo.startsWith("/sparring")) return "Create an account to join sparring.";
  if (returnTo.startsWith("/host")) return "Create an account to host tournaments.";
  if (returnTo.startsWith("/clubs")) return "Create an account to follow or join a club.";
  if (returnTo.startsWith("/club")) return "Create an account to manage a club.";
  if (returnTo.startsWith("/you")) return "Create an account to see your fighter profile.";
  if (returnTo.startsWith("/checkin")) return "Create an account to check in.";
  return undefined;
}

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const actor = await getActor();

  if (!actor) {
    return <AuthScreen returnTo={returnTo ?? "/"} subtext={guestMessage(returnTo)} />;
  }

  const [
    user,
    fighter,
    recentNotifications,
    unreadCount,
    savedFightsCount,
    fighterFollowCount,
    clubFollowCount,
    eventFollowCount,
    liveFollowedEvent,
    upcomingFollowedEvent,
  ] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.userId } }),
    prisma.fighterProfile.findUnique({ where: { userId: actor.userId }, include: { club: true } }),
    prisma.notification.findMany({ where: { userId: actor.userId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.notification.count({ where: { userId: actor.userId, read: false } }),
    prisma.savedBout.count({ where: { userId: actor.userId } }),
    prisma.fighterFollow.count({ where: { userId: actor.userId } }),
    prisma.clubFollow.count({ where: { userId: actor.userId } }),
    prisma.follow.count({ where: { userId: actor.userId } }),
    prisma.event.findFirst({
      where: { follows: { some: { userId: actor.userId } }, status: { in: ["LIVE", "INTERMISSION"] } },
      orderBy: { date: "asc" },
    }),
    prisma.event.findFirst({
      where: { follows: { some: { userId: actor.userId } }, status: "PUBLISHED" },
      orderBy: { date: "asc" },
    }),
  ]);

  const upNextEvent = liveFollowedEvent ?? upcomingFollowedEvent;
  const upNextCoverUrl = upNextEvent
    ? (
        await prisma.media.findFirst({
          where: { attachedType: "EVENT", attachedId: upNextEvent.id, kind: "EVENT_COVER" },
          orderBy: { createdAt: "desc" },
        })
      )?.url ?? null
    : null;

  let nextFight: Awaited<ReturnType<typeof prisma.bout.findFirst>> | null = null;
  let nextFightEvent: { name: string; startTime: Date | null; slug: string | null } | null = null;
  let nextFightOpponent: string | null = null;
  let nextSparring: Awaited<ReturnType<typeof prisma.sparringParticipant.findFirst>> | null = null;
  let nextSparringSession: { gym: string; date: Date } | null = null;
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let followerCount = 0;
  let lastResult: { outcome: "Win" | "Loss" | "Draw"; date: Date; opponent: string } | null = null;

  if (fighter) {
    const [boutRow, sparringRow, finishedBouts, followers] = await Promise.all([
      prisma.bout.findFirst({
        where: {
          OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }],
          status: { in: ["CONFIRMED", "READY", "DELAYED", "IN_PROGRESS"] },
        },
        include: { event: true, fighterA: true, fighterB: true },
        orderBy: { scheduledTime: "asc" },
      }),
      prisma.sparringParticipant.findFirst({
        where: { fighterId: fighter.id, status: { in: ["CONFIRMED", "INVITED"] }, session: { date: { gte: new Date() } } },
        include: { session: true },
        orderBy: { session: { date: "asc" } },
      }),
      prisma.bout.findMany({
        where: { OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }], status: "FINAL" },
        include: { result: true, event: true, fighterA: true, fighterB: true },
      }),
      prisma.fighterFollow.count({ where: { fighterId: fighter.id } }),
    ]);

    nextFight = boutRow;
    nextFightEvent = boutRow?.event ?? null;
    nextFightOpponent = boutRow ? (boutRow.fighterAId === fighter.id ? boutRow.fighterB?.displayName : boutRow.fighterA?.displayName) ?? null : null;
    nextSparring = sparringRow;
    nextSparringSession = sparringRow?.session ?? null;
    followerCount = followers;
    wins = finishedBouts.filter((b) => b.result?.winnerId === fighter.id).length;
    losses = finishedBouts.filter((b) => b.result?.winnerId && b.result.winnerId !== fighter.id).length;
    draws = finishedBouts.filter((b) => b.result && !b.result.winnerId).length;

    const mostRecent = [...finishedBouts].sort((a, b) => b.event.date.getTime() - a.event.date.getTime())[0];
    if (mostRecent) {
      const opponent =
        (mostRecent.fighterAId === fighter.id ? mostRecent.fighterB?.displayName : mostRecent.fighterA?.displayName) ?? "TBD";
      const outcome = mostRecent.result?.winnerId
        ? mostRecent.result.winnerId === fighter.id
          ? "Win"
          : "Loss"
        : "Draw";
      lastResult = { outcome, date: mostRecent.event.date, opponent };
    }
  }

  // Whichever comes sooner: next fight or next sparring session.
  const nextIsSparring =
    nextSparringSession && (!nextFightEvent?.startTime || nextSparringSession.date < nextFightEvent.startTime);

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">
          {greeting(new Date())}, {(user?.name || user?.email || "").split(" ")[0]}.
        </h1>
        <Link
          href="/you/notifications"
          className="shrink-0 rounded-pill border border-white/15 px-3 py-1.5 text-xs font-semibold flex items-center gap-1.5"
        >
          🔔 {unreadCount > 0 ? `${unreadCount} new` : "Notifications"}
        </Link>
      </div>

      <section className="grid grid-cols-2 gap-2">
        <Link href="/scan?mode=event" className="rounded-card bg-panel border border-white/10 p-4 space-y-1">
          <p className="text-sm font-semibold">Check In</p>
          <p className="text-xs text-mute">at an event</p>
          <p className="text-[11px] text-mute pt-1">Scan your ticket or find an event.</p>
        </Link>
        <Link href="/scan?mode=sparring" className="rounded-card bg-panel border border-white/10 p-4 space-y-1">
          <p className="text-sm font-semibold">Check In</p>
          <p className="text-xs text-mute">for sparring</p>
          <p className="text-[11px] text-mute pt-1">Find a club or sparring session.</p>
        </Link>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Saved</p>
        <Link href="/you/saved" className="block rounded-card bg-panel border border-white/10 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">♡ Saved fights</p>
            <span className="text-lg font-semibold tabular">{savedFightsCount}</span>
          </div>
        </Link>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Following</p>
        <div className="grid grid-cols-3 gap-2">
          <ActivityStat href="/you/fighters" value={fighterFollowCount} label="Fighters" />
          <ActivityStat href="/you/clubs" value={clubFollowCount} label="Clubs" />
          <ActivityStat href="/you/events" value={eventFollowCount} label="Events" />
        </div>
      </section>

      {upNextEvent && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Up next</p>
          <Link
            href={upNextEvent.slug ? `/e/${upNextEvent.slug}` : "#"}
            className="block rounded-card bg-panel border border-signal/30 overflow-hidden"
          >
            {upNextCoverUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={upNextCoverUrl} alt="" className="w-full aspect-video object-cover" />
            )}
            <div className="p-4 space-y-2">
              <p className="font-semibold">{upNextEvent.name}</p>
              {upNextEvent.status === "LIVE" || upNextEvent.status === "INTERMISSION" ? (
                <Badge live tone="live">
                  Live
                </Badge>
              ) : (
                <p className="text-sm text-mute">{formatEventDate(upNextEvent.date)}</p>
              )}
              <p className="inline-flex items-center gap-1 text-sm font-semibold text-signal pt-1">Open Event →</p>
            </div>
          </Link>
        </section>
      )}

      {fighter && (nextFight || nextSparring) && (
        <section className="rounded-card bg-panel border border-signal/30 p-4">
          <p className="text-xs font-semibold text-signal uppercase tracking-wide mb-2">Your next fight</p>
          {nextIsSparring && nextSparringSession ? (
            <>
              <p className="font-semibold">🥊 Sparring</p>
              <p className="text-sm text-mute mt-1">
                {nextSparringSession.gym} · {formatEventDate(nextSparringSession.date)}
              </p>
            </>
          ) : nextFight && nextFightEvent ? (
            <>
              <p className="font-semibold">⚔️ {nextFightEvent.name}</p>
              <p className="text-sm text-mute mt-1">
                {nextFightEvent.startTime ? formatCountdown(nextFightEvent.startTime) : "Scheduled"}
              </p>
            </>
          ) : null}
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Recent activity</p>
          <Link href="/you/notifications" className="text-xs text-signal">
            View all
          </Link>
        </div>
        {recentNotifications.length === 0 ? (
          <div className="rounded-card border border-white/10 px-4 py-3">
            <p className="text-sm font-medium">No activity yet.</p>
            <p className="text-xs text-mute mt-0.5">Follow a fighter, club or event to see updates here.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {recentNotifications.map((n) => (
              <Link
                key={n.id}
                href={n.link ?? "/you/notifications"}
                className={`block rounded-card border px-4 py-2.5 text-sm ${n.read ? "border-white/10 text-mute" : "border-white/15 bg-panel"}`}
              >
                {n.message}
              </Link>
            ))}
          </div>
        )}
      </section>

      {(!fighter || actor.clubIds.length === 0) && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Your PUGNA profiles</p>
          {!fighter && (
            <Link
              href="/become-boxer"
              className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4"
            >
              <div>
                <p className="font-semibold text-sm">Boxer</p>
                <p className="text-xs text-mute mt-0.5">Create your Boxer profile →</p>
              </div>
              <span className="text-mute">›</span>
            </Link>
          )}
          {actor.clubIds.length === 0 && (
            <Link href="/club" className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4">
              <div>
                <p className="font-semibold text-sm">Clubs</p>
                <p className="text-xs text-mute mt-0.5">Join a club →</p>
              </div>
              <span className="text-mute">›</span>
            </Link>
          )}
        </section>
      )}

      {fighter && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Boxer</p>
          <div className="rounded-card bg-panel border border-white/10 p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-2xl font-bold tabular">
                {wins}–{losses}–{draws}
              </p>
              {fighter.club && (
                <Link href={`/clubs/${fighter.club.id}`} className="flex items-center gap-1.5 text-xs">
                  <span className="text-success">✓ Member</span>
                  <span className="text-mute">{fighter.club.name}</span>
                </Link>
              )}
            </div>

            {nextFight && nextFightEvent && (
              <div className="text-sm">
                <span className="text-mute">Next: </span>
                <span className="font-medium">vs {nextFightOpponent ?? "TBD"}</span>
                <span className="text-mute"> · {nextFightEvent.startTime ? formatCountdown(nextFightEvent.startTime) : "Scheduled"}</span>
              </div>
            )}

            {lastResult && (
              <div className="text-sm">
                <span className={lastResult.outcome === "Win" ? "text-success font-medium" : "text-mute font-medium"}>
                  {lastResult.outcome}
                </span>
                <span className="text-mute"> vs {lastResult.opponent} · {formatEventDate(lastResult.date)}</span>
              </div>
            )}

            <div className="flex items-center justify-between pt-1">
              <p className="text-xs text-mute">
                {followerCount} follower{followerCount === 1 ? "" : "s"}
              </p>
              <Link href="/you" className="text-xs text-signal font-semibold">
                View Boxer Profile →
              </Link>
            </div>
          </div>
        </section>
      )}

      <Link
        href="/account/settings"
        className="block rounded-card bg-panel border border-white/10 p-4 text-sm font-semibold text-center"
      >
        Account & Settings →
      </Link>
    </div>
  );
}

function ActivityStat({ href, value, label }: { href: string; value: number; label: string }) {
  return (
    <Link href={href} className="block rounded-card bg-panel border border-white/10 p-3">
      <p className="text-lg font-semibold tabular">{value}</p>
      <p className="text-[11px] text-mute mt-0.5">{label}</p>
    </Link>
  );
}
