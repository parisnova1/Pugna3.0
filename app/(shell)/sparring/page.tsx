import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { formatEventDate } from "@/lib/format";
import { SportTag } from "@/components/ui/SportTag";
import { Badge } from "@/components/ui/Badge";

const SPORTS = ["Boxing", "Kickboxing", "MMA"];
const EXPERIENCE_LEVELS = ["Beginner", "Intermediate", "Advanced", "Pro"];
const MODE_LABEL = { INVITE: "Invite only", OPEN_TO_CLUBS: "Open to clubs", OPEN: "Open sparring" } as const;

export default async function SparringDiscoverPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; city?: string; sex?: string; experience?: string }>;
}) {
  const { sport, city, sex, experience } = await searchParams;
  const actor = await getActor();
  const clubIds = actor?.clubIds ?? [];

  const sessions = await prisma.sparringSession.findMany({
    where: {
      status: "OPEN",
      date: { gte: new Date() },
      ...(sport ? { sport } : {}),
      ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
      ...(sex ? { sex } : {}),
      ...(experience ? { experienceLevel: experience } : {}),
      OR: [
        { accessMode: { not: "INVITE" } },
        { clubId: { in: clubIds } },
        { clubInvites: { some: { invitedClubId: { in: clubIds } } } },
      ],
    },
    orderBy: { date: "asc" },
    include: {
      club: true,
      weightGroups: { orderBy: { order: "asc" } },
      _count: { select: { participants: true } },
    },
  });

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sparring</h1>
      </div>

      <nav className="flex gap-2 overflow-x-auto text-sm">
        <span className="rounded-pill border border-signal bg-signal/10 px-4 py-2 font-medium whitespace-nowrap">Discover</span>
        <Link href="/sparring/mine" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          My Sparring
        </Link>
        <Link href="/sparring/host" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          Host
        </Link>
        <Link href="/sparring/requests" className="rounded-pill border border-white/15 text-mute px-4 py-2 font-medium whitespace-nowrap">
          Requests
        </Link>
      </nav>

      <form className="grid grid-cols-2 gap-2 text-sm" action="/sparring">
        <select name="sport" defaultValue={sport ?? ""} className="rounded-card bg-panel border border-white/10 px-3 py-2 text-ink">
          <option value="">Any sport</option>
          {SPORTS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <input
          name="city"
          defaultValue={city ?? ""}
          placeholder="Location"
          className="rounded-card bg-panel border border-white/10 px-3 py-2 text-ink placeholder:text-mute"
        />
        <select name="sex" defaultValue={sex ?? ""} className="rounded-card bg-panel border border-white/10 px-3 py-2 text-ink">
          <option value="">Any sex</option>
          <option value="Male">Male</option>
          <option value="Female">Female</option>
        </select>
        <select name="experience" defaultValue={experience ?? ""} className="rounded-card bg-panel border border-white/10 px-3 py-2 text-ink">
          <option value="">Any experience</option>
          {EXPERIENCE_LEVELS.map((e) => (
            <option key={e} value={e}>
              {e}
            </option>
          ))}
        </select>
        <button type="submit" className="col-span-2 rounded-pill bg-signal text-onsignal font-semibold py-2.5">
          Filter
        </button>
      </form>

      <div className="space-y-3">
        {sessions.length === 0 ? (
          <p className="text-sm text-mute text-center py-10">No open sparring sessions match your filters.</p>
        ) : (
          sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sparring/${session.id}`}
              className="block rounded-card bg-panel border border-white/10 p-4 hover:border-white/20 transition-colors"
            >
              <div className="flex items-center justify-between">
                <Badge>{MODE_LABEL[session.accessMode]}</Badge>
                <span className="text-xs text-mute tabular">{formatEventDate(session.date)}</span>
              </div>
              <p className="font-semibold mt-2">{session.club.name}</p>
              <p className="text-sm text-mute mt-0.5">
                {session.gym}
                {session.city ? ` · ${session.city}` : ""}
              </p>
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <SportTag>{session.sport}</SportTag>
                {session.weightGroups.map((wg) => (
                  <span key={wg.id} className="text-[11px] text-mute border border-white/10 rounded-pill px-2 py-0.5">
                    {wg.label}
                  </span>
                ))}
              </div>
              <p className="text-xs text-mute mt-2">{session._count.participants} fighter{session._count.participants === 1 ? "" : "s"} registered</p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
