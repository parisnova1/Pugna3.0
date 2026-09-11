import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { signOut } from "@/lib/auth";
import { becomeBoxer, becomeOrganizer } from "@/lib/actions/profile";
import { AuthScreen } from "@/components/account/AuthScreen";
import { formatEventDate, formatCountdown } from "@/lib/format";

function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function guestMessage(returnTo: string | undefined): string {
  if (!returnTo) return "Sign in to follow, nominate, or organize.";
  if (returnTo.startsWith("/sparring/host")) return "Create an account to host sparring sessions.";
  if (returnTo.startsWith("/sparring")) return "Create an account to join sparring.";
  if (returnTo.startsWith("/host")) return "Create an account to host tournaments.";
  if (returnTo.startsWith("/club")) return "Create an account to manage a club.";
  if (returnTo.startsWith("/you")) return "Create an account to see your fighter profile.";
  if (returnTo.startsWith("/checkin")) return "Create an account to check in.";
  return "Create an account to use this feature.";
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

  const [user, clubs, fighter, recentNotifications, unreadCount] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.userId } }),
    actor.clubIds.length > 0 ? prisma.club.findMany({ where: { id: { in: actor.clubIds } } }) : Promise.resolve([]),
    prisma.fighterProfile.findUnique({ where: { userId: actor.userId }, include: { club: true } }),
    prisma.notification.findMany({ where: { userId: actor.userId }, orderBy: { createdAt: "desc" }, take: 5 }),
    prisma.notification.count({ where: { userId: actor.userId, read: false } }),
  ]);

  const hasAnyContext = actor.isBoxer || clubs.length > 0 || actor.isOrganizer;

  let nextFight: Awaited<ReturnType<typeof prisma.bout.findFirst>> | null = null;
  let nextFightEvent: { name: string; startTime: Date | null; slug: string | null } | null = null;
  let nextSparring: Awaited<ReturnType<typeof prisma.sparringParticipant.findFirst>> | null = null;
  let nextSparringSession: { gym: string; date: Date } | null = null;
  let upcomingEventCount = 0;
  let upcomingSparringCount = 0;
  let careerFightCount = 0;
  let totalSparringCount = 0;
  let wins = 0;
  let losses = 0;
  let draws = 0;

  if (fighter) {
    const [boutRow, sparringRow, upcomingBouts, upcomingSparring, finishedBouts, sparringAllTime] = await Promise.all([
      prisma.bout.findFirst({
        where: {
          OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }],
          status: { in: ["CONFIRMED", "READY", "DELAYED", "IN_PROGRESS"] },
        },
        include: { event: true },
        orderBy: { scheduledTime: "asc" },
      }),
      prisma.sparringParticipant.findFirst({
        where: { fighterId: fighter.id, status: { in: ["CONFIRMED", "INVITED"] }, session: { date: { gte: new Date() } } },
        include: { session: true },
        orderBy: { session: { date: "asc" } },
      }),
      prisma.bout.count({
        where: { OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }], status: { in: ["CONFIRMED", "READY", "DELAYED"] } },
      }),
      prisma.sparringParticipant.count({
        where: { fighterId: fighter.id, status: { in: ["CONFIRMED", "INVITED"] }, session: { date: { gte: new Date() } } },
      }),
      prisma.bout.findMany({
        where: { OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }], status: "FINAL" },
        include: { result: true },
      }),
      prisma.sparringParticipant.count({ where: { fighterId: fighter.id } }),
    ]);

    nextFight = boutRow;
    nextFightEvent = boutRow?.event ?? null;
    nextSparring = sparringRow;
    nextSparringSession = sparringRow?.session ?? null;
    upcomingEventCount = upcomingBouts;
    upcomingSparringCount = upcomingSparring;
    careerFightCount = finishedBouts.length;
    totalSparringCount = sparringAllTime;
    wins = finishedBouts.filter((b) => b.result?.winnerId === fighter.id).length;
    losses = finishedBouts.filter((b) => b.result?.winnerId && b.result.winnerId !== fighter.id).length;
    draws = finishedBouts.filter((b) => b.result && !b.result.winnerId).length;
  }

  // Whichever comes sooner: next fight or next sparring session.
  const nextIsSparring =
    nextSparringSession && (!nextFightEvent?.startTime || nextSparringSession.date < nextFightEvent.startTime);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">
          {greeting(new Date())}, {(user?.name || user?.email || "").split(" ")[0]}.
        </h1>
      </div>

      {fighter && (nextFight || nextSparring) && (
        <section className="rounded-card bg-panel border border-signal/30 p-4">
          <p className="text-xs font-semibold text-signal uppercase tracking-wide mb-2">Next</p>
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

      {fighter && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Your activity</p>
          <div className="grid grid-cols-2 gap-2">
            <ActivityStat value={upcomingEventCount} label="Upcoming events" />
            <ActivityStat value={upcomingSparringCount} label="Upcoming sparring" />
            <ActivityStat value={careerFightCount} label="Career fights" />
            <ActivityStat value={totalSparringCount} label="Sparring sessions" />
          </div>
        </section>
      )}

      {fighter?.club && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Your club</p>
          <Link href={`/clubs/${fighter.club.id}`} className="block rounded-card bg-panel border border-white/10 p-4">
            <p className="font-semibold text-sm">{fighter.club.name}</p>
          </Link>
        </section>
      )}

      {fighter && careerFightCount > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Your record</p>
          <p className="text-3xl font-bold tabular">
            {wins}–{losses}–{draws}
          </p>
        </section>
      )}

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Notifications</p>
          <Link href="/you/notifications" className="text-xs text-signal">
            {unreadCount > 0 ? `${unreadCount} unread` : "View all"}
          </Link>
        </div>
        {recentNotifications.length === 0 ? (
          <p className="text-sm text-mute">Nothing yet.</p>
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

      <section className="space-y-3 pt-2 border-t border-white/10">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Your contexts</h2>

        {actor.isBoxer && (
          <Link href="/you" className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4">
            <div>
              <p className="font-semibold text-sm">Boxer</p>
              <p className="text-xs text-mute mt-0.5">My fights</p>
            </div>
            <span className="text-mute">›</span>
          </Link>
        )}

        {clubs.map((club) => (
          <Link
            key={club.id}
            href={`/club?club=${club.id}`}
            className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4"
          >
            <div>
              <p className="font-semibold text-sm">{club.name}</p>
              <p className="text-xs text-mute mt-0.5">Club dashboard</p>
            </div>
            <span className="text-mute">›</span>
          </Link>
        ))}

        {actor.isOrganizer && (
          <Link href="/host" className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4">
            <div>
              <p className="font-semibold text-sm">Organizer</p>
              <p className="text-xs text-mute mt-0.5">Tournament dashboard</p>
            </div>
            <span className="text-mute">›</span>
          </Link>
        )}

        {!hasAnyContext && <p className="text-sm text-mute">You&apos;re just browsing so far. Pick a space below to get started.</p>}
      </section>

      <section className="space-y-2">
        {!actor.isBoxer && (
          <form
            action={async () => {
              "use server";
              await becomeBoxer();
            }}
          >
            <button type="submit" className="w-full rounded-pill border border-white/20 text-ink font-semibold py-3">
              Register as boxer
            </button>
          </form>
        )}
        {clubs.length === 0 && (
          <Link href="/club" className="block w-full text-center rounded-pill border border-white/20 text-ink font-semibold py-3">
            Represent a club
          </Link>
        )}
        {!actor.isOrganizer && (
          <form
            action={async () => {
              "use server";
              await becomeOrganizer();
            }}
          >
            <button type="submit" className="w-full rounded-pill border border-white/20 text-ink font-semibold py-3">
              Become an organizer
            </button>
          </form>
        )}
      </section>

      <div className="space-y-2 pt-2 border-t border-white/10">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Settings</p>
        <p className="text-sm text-mute py-1">{user?.email}</p>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="w-full rounded-pill border border-white/20 text-ink font-semibold py-3">
            Log out
          </button>
        </form>
      </div>
    </div>
  );
}

function ActivityStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-card bg-panel border border-white/10 p-3">
      <p className="text-lg font-semibold tabular">{value}</p>
      <p className="text-[11px] text-mute mt-0.5">{label}</p>
    </div>
  );
}
