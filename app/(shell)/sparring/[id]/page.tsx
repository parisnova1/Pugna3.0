import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { formatEventDate } from "@/lib/format";
import { SportTag } from "@/components/ui/SportTag";
import { Badge } from "@/components/ui/Badge";
import {
  registerForSparring,
  respondToParticipant,
  inviteFighter,
  cancelParticipant,
  moveWeightGroup,
  setSessionStatus,
} from "@/lib/actions/sparring";
import { setCheckInStatus } from "@/lib/actions/checkin";
import { QrCodeSheet } from "@/components/event/QrCodeSheet";
import type { SparringParticipantStatus } from "@prisma/client";

const STATUS_LABEL: Record<SparringParticipantStatus, string> = {
  REQUESTED: "Requested",
  INVITED: "Invited",
  CONFIRMED: "Confirmed",
  REJECTED: "Declined",
  CANCELLED: "Cancelled",
  CHECKED_IN: "Checked in",
  COMPLETED: "Completed",
  NO_SHOW: "No-show",
};

export default async function SparringSessionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await prisma.sparringSession.findUnique({
    where: { id },
    include: {
      club: true,
      weightGroups: { orderBy: { order: "asc" } },
      participants: {
        include: { fighter: { include: { club: true, user: true } }, weightGroup: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });
  if (!session) notFound();

  const actor = await getActor();
  const isHost = actor ? actor.clubIds.includes(session.clubId) : false;
  const ownFighter = actor ? await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } }) : null;
  const ownParticipant = ownFighter ? session.participants.find((p) => p.fighterId === ownFighter.id) : null;

  const activeParticipants = session.participants.filter((p) => !["REJECTED", "CANCELLED"].includes(p.status));
  const pendingParticipants = session.participants.filter((p) => p.status === "REQUESTED");

  const rosterFighters = isHost
    ? await prisma.fighterProfile.findMany({
        where: { clubId: session.clubId, id: { notIn: session.participants.map((p) => p.fighterId) } },
      })
    : [];

  const checkIns = await prisma.checkIn.findMany({ where: { attachedType: "SPARRING_SESSION", attachedId: session.id } });
  const checkInFor = (fighterId: string) => checkIns.find((c) => c.fighterId === fighterId) ?? null;

  return (
    <div className="space-y-6 pt-2">
      <div>
        <Badge>Open Sparring</Badge>
        <h1 className="text-2xl font-semibold mt-2">{session.club.name}</h1>
        <p className="text-mute text-sm mt-1">
          {session.gym}
          {session.city ? ` · ${session.city}` : ""}
        </p>
        <p className="text-mute text-sm">{formatEventDate(session.date)}</p>
      </div>

      <section className="rounded-card bg-panel border border-white/10 p-4 space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Session details</p>
        <div className="flex gap-2 flex-wrap">
          <SportTag>{session.sport}</SportTag>
          {session.experienceLevel && <SportTag>{session.experienceLevel}</SportTag>}
          {session.sex && <SportTag>{session.sex}</SportTag>}
          {(session.minAge || session.maxAge) && (
            <SportTag>
              {session.minAge ?? "0"}
              {session.maxAge ? `–${session.maxAge}` : "+"}
            </SportTag>
          )}
        </div>
        {session.rulesText && <p className="text-sm text-mute">{session.rulesText}</p>}
      </section>

      {session.weightGroups.length > 0 && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Weight groups</p>
          <div className="flex gap-2 flex-wrap">
            {session.weightGroups.map((wg) => (
              <span key={wg.id} className="text-sm rounded-pill border border-white/10 px-3 py-1.5">
                {wg.label}
              </span>
            ))}
          </div>
        </section>
      )}

      {actor && ownFighter && !ownParticipant && session.status === "OPEN" && (
        <form
          action={async (formData: FormData) => {
            "use server";
            await registerForSparring(session.id, formData);
          }}
          className="space-y-2"
        >
          {session.weightGroups.length > 0 && (
            <select name="weightGroupId" className="w-full rounded-card bg-panel border border-white/10 px-3 py-2 text-sm">
              <option value="">Choose weight group</option>
              {session.weightGroups.map((wg) => (
                <option key={wg.id} value={wg.id}>
                  {wg.label}
                </option>
              ))}
            </select>
          )}
          <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3">
            Join Sparring
          </button>
        </form>
      )}

      {ownParticipant && (
        <div className="rounded-card border border-white/10 p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">You&apos;re {STATUS_LABEL[ownParticipant.status].toLowerCase()}</p>
          </div>
          {["REQUESTED", "INVITED", "CONFIRMED"].includes(ownParticipant.status) && (
            <form
              action={async () => {
                "use server";
                await cancelParticipant(ownParticipant.id);
              }}
            >
              <button type="submit" className="text-xs text-mute underline">
                Withdraw
              </button>
            </form>
          )}
        </div>
      )}

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">
          Registered fighters ({activeParticipants.length})
        </p>
        {activeParticipants.length === 0 ? (
          <p className="text-sm text-mute">No fighters registered yet.</p>
        ) : (
          <div className="space-y-2">
            {activeParticipants.map((p) => (
              <div key={p.id} className="rounded-card bg-panel border border-white/10 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{p.fighter.displayName}</p>
                    <p className="text-xs text-mute mt-0.5">
                      {p.fighter.club?.name ?? "Independent"}
                      {p.fighter.weightClass ? ` · ${p.fighter.weightClass}` : ""}
                      {p.fighter.experienceLevel ? ` · ${p.fighter.experienceLevel}` : ""}
                    </p>
                    {p.weightGroup && <p className="text-xs text-signal mt-0.5">{p.weightGroup.label}</p>}
                  </div>
                  <span className="text-xs text-mute shrink-0 ml-2">{STATUS_LABEL[p.status]}</span>
                </div>
                {isHost && p.status === "REQUESTED" && (
                  <div className="flex gap-2 mt-3">
                    <form
                      action={async () => {
                        "use server";
                        await respondToParticipant(p.id, true);
                      }}
                      className="flex-1"
                    >
                      <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-2 text-xs">
                        Accept
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await respondToParticipant(p.id, false);
                      }}
                      className="flex-1"
                    >
                      <button type="submit" className="w-full rounded-pill border border-white/20 py-2 text-xs font-medium">
                        Reject
                      </button>
                    </form>
                  </div>
                )}
                {isHost && (p.status === "CONFIRMED" || p.status === "CHECKED_IN") && (
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-white/10">
                    <span className="text-xs text-mute">
                      {checkInFor(p.fighterId)?.status === "CHECKED_IN"
                        ? "🟢 Checked in"
                        : checkInFor(p.fighterId)?.status === "NO_SHOW"
                          ? "No-show"
                          : "Not checked in"}
                    </span>
                    <div className="flex gap-2">
                      <form
                        action={async () => {
                          "use server";
                          await setCheckInStatus("SPARRING_SESSION", session.id, p.fighterId, "CHECKED_IN");
                        }}
                      >
                        <button type="submit" className="rounded-pill border border-white/20 px-3 py-1 text-[11px] font-medium">
                          Check in
                        </button>
                      </form>
                      <form
                        action={async () => {
                          "use server";
                          await setCheckInStatus("SPARRING_SESSION", session.id, p.fighterId, "NO_SHOW");
                        }}
                      >
                        <button type="submit" className="rounded-pill border border-white/20 px-3 py-1 text-[11px] font-medium">
                          No-show
                        </button>
                      </form>
                    </div>
                  </div>
                )}
                {isHost && p.status === "CONFIRMED" && session.weightGroups.length > 0 && (
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      const wg = String(formData.get("weightGroupId") ?? "") || null;
                      await moveWeightGroup(p.id, wg);
                    }}
                    className="flex gap-2 mt-3"
                  >
                    <select
                      name="weightGroupId"
                      defaultValue={p.weightGroupId ?? ""}
                      className="flex-1 rounded-card bg-void border border-white/10 px-3 py-2 text-xs"
                    >
                      <option value="">No weight group</option>
                      {session.weightGroups.map((wg) => (
                        <option key={wg.id} value={wg.id}>
                          {wg.label}
                        </option>
                      ))}
                    </select>
                    <button type="submit" className="rounded-pill border border-white/20 px-3 text-xs font-medium">
                      Move
                    </button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {isHost && (
        <section className="space-y-3 pt-4 border-t border-white/10">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">Host actions</p>
          <Link
            href={`/sparring/${session.id}/match`}
            className="block text-center rounded-pill border border-white/20 text-ink font-semibold py-3 text-sm"
          >
            Suggested matches
          </Link>
          <QrCodeSheet path={`/checkin/sparring/${session.id}`} label="Check-in QR" buttonLabel="Show check-in QR" />

          {rosterFighters.length > 0 && (
            <form
              action={async (formData: FormData) => {
                "use server";
                await inviteFighter(session.id, formData);
              }}
              className="flex gap-2"
            >
              <select name="fighterId" className="flex-1 rounded-card bg-panel border border-white/10 px-3 py-2 text-sm">
                {rosterFighters.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.displayName}
                  </option>
                ))}
              </select>
              <button type="submit" className="rounded-pill border border-white/20 px-4 text-sm font-medium">
                Invite
              </button>
            </form>
          )}

          {pendingParticipants.length > 0 && (
            <p className="text-xs text-mute">{pendingParticipants.length} pending request{pendingParticipants.length > 1 ? "s" : ""} above.</p>
          )}

          {session.status !== "CANCELLED" && session.status !== "COMPLETED" && (
            <details className="rounded-card border border-white/10 p-4">
              <summary className="text-sm text-signal cursor-pointer">Cancel session</summary>
              <form
                action={async () => {
                  "use server";
                  await setSessionStatus(session.id, "CANCELLED");
                }}
                className="mt-3"
              >
                <button type="submit" className="w-full rounded-pill border border-signal text-signal font-semibold py-2 text-sm">
                  Confirm cancel
                </button>
              </form>
            </details>
          )}
        </section>
      )}
    </div>
  );
}
