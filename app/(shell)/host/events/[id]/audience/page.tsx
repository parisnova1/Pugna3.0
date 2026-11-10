import { requireHostEvent } from "@/lib/host-guard";
import { prisma } from "@/lib/prisma";
import { tallyVotes } from "@/lib/fight-vote";
import { absoluteUrl } from "@/lib/seo";
import { BackButton } from "@/components/event/ContextBar";

const ROLE_LABEL: Record<string, string> = { FAN: "Fan", COACH: "Coach", FIGHTER: "Fighter", ORGANIZER: "Organizer" };

/** Host-only view of what the audience did at this event: fight-of-the-day
 * votes per day, and the waiting-list signups that came in from this event. */
export default async function AudiencePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}/audience`);

  const [grouped, signups] = await Promise.all([
    prisma.fightOfDayVote.groupBy({ by: ["day", "boutId"], where: { eventId: event.id }, _count: { _all: true } }),
    event.slug
      ? prisma.waitlistSignup.findMany({ where: { source: event.slug }, orderBy: { createdAt: "desc" } })
      : Promise.resolve([]),
  ]);

  const days = Array.from({ length: event.dayCount }, (_, i) => i + 1).map((day) => {
    const counts = new Map(grouped.filter((g) => g.day === day).map((g) => [g.boutId, g._count._all]));
    const voted = event.bouts.filter((b) => b.day === day && counts.has(b.id));
    const { total, rows } = tallyVotes(
      voted.map((b) => b.id),
      counts,
    );
    const byId = new Map(rows.map((r) => [r.boutId, r]));
    return {
      day,
      total,
      bouts: voted
        .map((b) => ({ bout: b, tally: byId.get(b.id)! }))
        .sort((a, b) => b.tally.votes - a.tally.votes || a.bout.number - b.bout.number),
    };
  });

  const waitlistUrl = event.slug ? absoluteUrl(`/waitlist?from=${event.slug}`) : null;
  const coachCount = signups.filter((s) => s.role === "COACH").length;

  return (
    <div className="space-y-8 pt-2">
      <BackButton />
      <div>
        <h1 className="text-2xl font-semibold">Audience</h1>
        <p className="text-mute text-sm mt-1">Fight-of-the-day votes and waiting-list signups from {event.name}.</p>
      </div>

      <section className="space-y-3">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Fight of the day</p>
        {days.map(({ day, total, bouts }) => (
          <div key={day} className="rounded-card bg-panel border border-white/10 p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm font-semibold">{event.dayCount > 1 ? `Day ${day}` : "Votes"}</p>
              <p className="text-xs text-mute tabular-nums">
                {total} {total === 1 ? "vote" : "votes"}
              </p>
            </div>
            {bouts.length === 0 ? (
              <p className="text-sm text-mute mt-2">No votes yet. Voting opens on the event page when the first fight starts.</p>
            ) : (
              <ol className="mt-2 space-y-1.5">
                {bouts.map(({ bout, tally }) => (
                  <li key={bout.id} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 truncate">
                      {tally.leading && <span className="mr-2 text-[11px] font-semibold text-signal-ink">Leading</span>}
                      {bout.fighterA?.displayName ?? "TBD"} vs {bout.fighterB?.displayName ?? "TBD"}
                      <span className="text-mute"> · Bout {bout.number}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-mute">
                      {tally.votes} · {tally.share}%
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </div>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Waiting-list signups</p>
          <p className="text-xs text-mute tabular-nums">
            {signups.length} total · {coachCount} {coachCount === 1 ? "coach" : "coaches"}
          </p>
        </div>
        {waitlistUrl && (
          <p className="text-sm text-mute break-all">
            Signup link for QR codes and business cards: <span className="text-ink select-all">{waitlistUrl}</span>
          </p>
        )}
        {signups.length === 0 ? (
          <p className="rounded-card bg-panel border border-white/10 p-4 text-sm text-mute">
            Nobody has signed up from this event yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-card bg-panel border border-white/10">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-mute uppercase tracking-wide">
                  <th className="px-4 py-2 font-semibold">Email</th>
                  <th className="px-4 py-2 font-semibold">Role</th>
                  <th className="px-4 py-2 font-semibold">Name</th>
                  <th className="px-4 py-2 font-semibold">Club</th>
                  <th className="px-4 py-2 font-semibold">City</th>
                  <th className="px-4 py-2 font-semibold">Newsletter</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/10">
                {signups.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-2 select-all whitespace-nowrap">{s.email}</td>
                    <td className="px-4 py-2">{ROLE_LABEL[s.role] ?? s.role}</td>
                    <td className="px-4 py-2">{s.name ?? ""}</td>
                    <td className="px-4 py-2">{s.clubName ?? ""}</td>
                    <td className="px-4 py-2">{s.city ?? ""}</td>
                    <td className="px-4 py-2">{s.newsletter ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
