import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { checkInToEvent } from "@/lib/actions/checkin";
import { Button, buttonClass } from "@/components/ui/Button";
import { can } from "@/lib/rbac";
import { isPublishedEventStatus } from "@/lib/event-status";

export default async function EventCheckInPage({ params }: { params: Promise<{ eventId: string }> }) {
  const { eventId } = await params;
  const event = await prisma.event.findUnique({ where: { id: eventId } });
  if (!event) notFound();

  const actor = await getActor();
  // Same visibility rule as the public page: drafts are for their hosts only.
  if (!can(actor, "event.view", { eventId, eventPublished: isPublishedEventStatus(event.status) }).allowed) notFound();
  const fighter = actor ? await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } }) : null;
  const existing = fighter
    ? await prisma.checkIn.findUnique({
        where: { attachedType_attachedId_fighterId: { attachedType: "EVENT", attachedId: eventId, fighterId: fighter.id } },
      })
    : null;

  return (
    <div className="min-h-screen mx-auto w-full max-w-md px-4 pt-16 text-center space-y-6">
      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Check-in</p>
        <h1 className="text-2xl font-semibold mt-1">{event.name}</h1>
      </div>

      {!actor ? (
        <>
          <p className="text-mute text-sm">Sign in to check in.</p>
          <Link
            href={`/account?returnTo=${encodeURIComponent(`/checkin/event/${eventId}`)}`}
            className={buttonClass({ text: "sm", className: "inline-block px-5" })}
          >
            Sign in
          </Link>
        </>
      ) : !fighter ? (
        <p className="text-mute text-sm">Only registered fighters can check in.</p>
      ) : existing?.status === "CHECKED_IN" ? (
        <p className="text-success text-sm font-semibold">🟢 You&apos;re checked in.</p>
      ) : (
        <form
          action={async () => {
            "use server";
            await checkInToEvent(eventId);
          }}
        >
          <Button type="submit" fullWidth>
            Confirm check-in
          </Button>
        </form>
      )}

      {event.slug && (
        <Link href={`/e/${event.slug}`} className="block text-sm text-mute underline">
          View event
        </Link>
      )}
    </div>
  );
}
