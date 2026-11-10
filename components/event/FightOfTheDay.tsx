import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { isVotableBoutStatus, isVotingOpen, tallyVotes, voterKeyFor, VOTER_COOKIE } from "@/lib/fight-vote";
import { FightVoteList, type FightVoteRow } from "@/components/event/FightVoteList";

export type FightOfTheDayBout = {
  id: string;
  number: number;
  weightClass: string;
  status: string;
  fighterAName: string | null;
  fighterBName: string | null;
};

/**
 * "Fight of the day" audience vote for one event day. Lists every bout that
 * has started or finished, with live counts and the viewer's own pick.
 * Renders nothing if the vote tables are unreachable, so a database hiccup
 * here can never take the event page down mid-show.
 */
export async function FightOfTheDay({
  eventId,
  eventStatus,
  day,
  dayCount,
  bouts,
  viewerUserId,
}: {
  eventId: string;
  eventStatus: string;
  day: number;
  dayCount: number;
  bouts: FightOfTheDayBout[];
  viewerUserId: string | null;
}) {
  if (!isVotingOpen(eventStatus)) return null;

  const votable = bouts.filter((b) => isVotableBoutStatus(b.status)).sort((a, b) => a.number - b.number);
  const heading = dayCount > 1 ? `Fight of the day · Day ${day}` : "Fight of the day";

  if (votable.length === 0) {
    return (
      <section id="vote" className="rounded-card bg-panel border border-white/10 p-4 scroll-mt-24">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">{heading}</p>
        <p className="text-sm text-mute mt-2">Voting opens when the first fight starts. Come back and pick your favourite.</p>
      </section>
    );
  }

  let counts = new Map<string, number>();
  let viewerBoutId: string | null = null;
  try {
    const guestId = (await cookies()).get(VOTER_COOKIE)?.value ?? null;
    const voterKey = voterKeyFor({ userId: viewerUserId, guestId });
    const [grouped, mine] = await Promise.all([
      prisma.fightOfDayVote.groupBy({ by: ["boutId"], where: { eventId, day }, _count: { _all: true } }),
      voterKey
        ? prisma.fightOfDayVote.findUnique({ where: { eventId_day_voterKey: { eventId, day, voterKey } }, select: { boutId: true } })
        : Promise.resolve(null),
    ]);
    counts = new Map(grouped.map((g) => [g.boutId, g._count._all]));
    viewerBoutId = mine?.boutId ?? null;
  } catch (error) {
    console.error("[fight-of-the-day] could not load votes", error);
    return null;
  }

  const { total, rows } = tallyVotes(
    votable.map((b) => b.id),
    counts,
  );
  const byId = new Map(rows.map((r) => [r.boutId, r]));
  const voteRows: FightVoteRow[] = votable.map((b) => {
    const tally = byId.get(b.id)!;
    return {
      boutId: b.id,
      label: `${b.fighterAName ?? "TBD"} vs ${b.fighterBName ?? "TBD"}`,
      detail: `Bout ${b.number} · ${b.weightClass}${b.status === "IN_PROGRESS" ? " · in the ring now" : ""}`,
      votes: tally.votes,
      share: tally.share,
      leading: tally.leading,
    };
  });

  return (
    <section id="vote" className="rounded-card bg-panel border border-white/10 p-4 scroll-mt-24">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">{heading}</p>
        <p className="text-xs text-mute tabular-nums">
          {total} {total === 1 ? "vote" : "votes"}
        </p>
      </div>
      <p className="text-sm text-mute mt-1">One vote per person. You can change it until the event closes.</p>
      <FightVoteList rows={voteRows} viewerBoutId={viewerBoutId} />
    </section>
  );
}
