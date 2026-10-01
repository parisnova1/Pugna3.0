import Link from "next/link";
import { requireHostEvent } from "@/lib/host-guard";
import { addGuestFighter } from "@/lib/actions/event";
import { inviteClubToEvent } from "@/lib/actions/clubEvent";
import { prisma } from "@/lib/prisma";
import { ActionForm } from "@/components/host/ActionForm";
import { BackButton } from "@/components/event/ContextBar";
import type { ActionResult } from "@/lib/actions/types";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function EntriesStepPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}/entries`);

  const [clubs, invites, nominations, participatingClubs] = await Promise.all([
    prisma.club.findMany({ orderBy: { name: "asc" }, take: 50 }),
    prisma.clubEventInvite.findMany({ where: { eventId: id }, include: { invitedClub: true }, orderBy: { createdAt: "desc" } }),
    prisma.nomination.findMany({ where: { eventId: id }, include: { fighter: true, club: true } }),
    prisma.clubEventParticipation.findMany({ where: { eventId: id }, include: { club: true }, orderBy: { createdAt: "asc" } }),
  ]);

  const invitableClubs = clubs.filter(
    (club) => !invites.some((i) => i.invitedClubId === club.id) && !participatingClubs.some((p) => p.clubId === club.id),
  );

  async function inviteClubAction(formData: FormData): Promise<ActionResult> {
    "use server";
    const clubId = String(formData.get("clubId") ?? "");
    return inviteClubToEvent(id, clubId, formData);
  }

  const nominationCountByClub = new Map<string, number>();
  for (const nom of nominations) {
    nominationCountByClub.set(nom.clubId, (nominationCountByClub.get(nom.clubId) ?? 0) + 1);
  }

  return (
    <div className="space-y-8 pt-2">
      <BackButton />
      <div>
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Step 3</p>
        <h1 className="text-2xl font-semibold">Entries</h1>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Participating Clubs</h2>
        {participatingClubs.length === 0 ? (
          <p className="text-sm text-mute">No clubs participating yet — invite one from Clubs.</p>
        ) : (
          <div className="space-y-2">
            {participatingClubs.map((p) => (
              <Link
                key={p.id}
                href={`/clubs/${p.clubId}`}
                className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
              >
                <p className="text-sm font-medium">{p.club.name}</p>
                <span className="text-xs text-mute">
                  {nominationCountByClub.get(p.clubId) ?? 0} boxer{(nominationCountByClub.get(p.clubId) ?? 0) === 1 ? "" : "s"} submitted
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Nominations</h2>
        {nominations.length === 0 ? (
          <p className="text-sm text-mute">No nominations yet.</p>
        ) : (
          <div className="space-y-2">
            {nominations.map((nom) => (
              <div key={nom.id} className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3">
                <div>
                  <p className="text-sm font-medium">{nom.fighter.displayName}</p>
                  <p className="text-xs text-mute mt-0.5">{nom.club.name} · {nom.weightClass}</p>
                </div>
                <span className="text-xs text-mute">{nom.status}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Invite a club</h2>
        {invites.length > 0 && (
          <div className="space-y-1 mb-2">
            {invites.map((invite) => (
              <p key={invite.id} className="text-xs text-mute">
                {invite.invitedClub.name} — {invite.status}
              </p>
            ))}
          </div>
        )}
        {invitableClubs.length === 0 ? (
          <p className="text-sm text-mute">
            {clubs.length === 0
              ? "No clubs on Pugna yet — add a guest boxer below instead."
              : "Every club has already been invited or is participating."}
          </p>
        ) : (
          <ActionForm action={inviteClubAction} submitLabel="Send invitation" className="space-y-3">
            <select name="clubId" required className={inputClass}>
              <option value="">Select club</option>
              {invitableClubs.map((club) => (
                <option key={club.id} value={club.id}>
                  {club.name}
                </option>
              ))}
            </select>
            <textarea name="message" rows={2} placeholder="Message (optional)" className={`${inputClass} resize-none`} />
          </ActionForm>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Guest boxer</h2>
        <p className="text-xs text-mute">Not in the app.</p>
        <ActionForm action={addGuestFighter} submitLabel="Add guest boxer" className="space-y-3">
          <input type="hidden" name="eventId" value={event.id} />
          <input name="name" placeholder="Boxer name" required className={inputClass} />
          <input name="clubText" placeholder="Club (text)" className={inputClass} />
          <input name="weightClass" placeholder="Weight class" className={inputClass} />
        </ActionForm>
      </section>
    </div>
  );
}
