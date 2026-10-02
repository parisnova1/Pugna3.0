import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { checkInToSparring } from "@/lib/actions/checkin";
import { Button, buttonClass } from "@/components/ui/Button";

export default async function SparringCheckInPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await prisma.sparringSession.findUnique({ where: { id }, include: { club: true } });
  if (!session) notFound();

  const actor = await getActor();
  const fighter = actor ? await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } }) : null;
  const participant = fighter
    ? await prisma.sparringParticipant.findUnique({ where: { sessionId_fighterId: { sessionId: id, fighterId: fighter.id } } })
    : null;

  return (
    <div className="min-h-screen mx-auto w-full max-w-md px-4 pt-16 text-center space-y-6">
      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Check-in</p>
        <h1 className="text-2xl font-semibold mt-1">{session.club.name}</h1>
        <p className="text-mute text-sm mt-1">{session.gym}</p>
      </div>

      {!actor ? (
        <>
          <p className="text-mute text-sm">Sign in to check in.</p>
          <Link
            href={`/account?returnTo=${encodeURIComponent(`/checkin/sparring/${id}`)}`}
            className={buttonClass({ text: "sm", className: "inline-block px-5" })}
          >
            Sign in
          </Link>
        </>
      ) : !participant || !["CONFIRMED", "CHECKED_IN"].includes(participant.status) ? (
        <p className="text-mute text-sm">You&apos;re not confirmed for this session.</p>
      ) : participant.status === "CHECKED_IN" ? (
        <p className="text-success text-sm font-semibold">🟢 You&apos;re checked in.</p>
      ) : (
        <form
          action={async () => {
            "use server";
            await checkInToSparring(id);
          }}
        >
          <Button type="submit" fullWidth>
            Confirm check-in
          </Button>
        </form>
      )}

      <Link href={`/sparring/${id}`} className="block text-sm text-mute underline">
        View session
      </Link>
    </div>
  );
}
