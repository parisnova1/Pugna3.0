import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";
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
import {
  inviteClub,
  respondToClubInvite,
  requestToJoinSession,
  respondToClubRequest,
  nominateFighter,
  respondToNomination,
  withdrawNomination,
} from "@/lib/actions/sparringClub";
import { setCheckInStatus, notifyCheckInOpen } from "@/lib/actions/checkin";
import { QrCodeSheet } from "@/components/event/QrCodeSheet";
import type { SparringParticipantStatus, SparringClubStatus, SparringNominationStatus } from "@prisma/client";

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

const CLUB_STATUS_LABEL: Record<SparringClubStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
};

const NOMINATION_STATUS_LABEL: Record<SparringNominationStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  DECLINED: "Declined",
  WITHDRAWN: "Withdrawn",
};

const MODE_LABEL = {
  INVITE: "Invite only",
  OPEN_TO_CLUBS: "Open to clubs",
  OPEN: "Open sparring",
} as const;

const inputClass = "flex-1 rounded-card bg-panel border border-white/10 px-3 py-2 text-sm";

export default async function SparringSessionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ clubQuery?: string }>;
}) {
  const { id } = await params;
  const { clubQuery } = await searchParams;

  const session = await prisma.sparringSession.findUnique({
    where: { id },
    include: {
      club: true,
      weightGroups: { orderBy: { order: "asc" } },
      participants: {
        include: { fighter: { include: { club: true, user: true } }, weightGroup: true },
        orderBy: { createdAt: "asc" },
      },
      clubInvites: { include: { invitedClub: true }, orderBy: { createdAt: "asc" } },
      clubRequests: { include: { requestingClub: true }, orderBy: { createdAt: "asc" } },
      nominations: { include: { fighter: true, nominatingClub: true, weightGroup: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!session) notFound();

  const actor = await getActor();
  const isHost = actor ? actor.clubIds.includes(session.clubId) : false;
  const ownFighter = actor ? await prisma.fighterProfile.findUnique({ where: { userId: actor.userId } }) : null;
  const ownParticipant = ownFighter ? session.participants.find((p) => p.fighterId === ownFighter.id) : null;
  const ownNomination = ownFighter ? session.nominations.find((n) => n.fighterId === ownFighter.id) : null;

  const guestClubIds = actor ? actor.clubIds.filter((cid) => cid !== session.clubId) : [];
  const isInvitedClubAdmin = guestClubIds.some((cid) => session.clubInvites.some((inv) => inv.invitedClubId === cid));
  const sparringPrivileged = isHost || isInvitedClubAdmin || Boolean(ownParticipant || ownNomination);

  const viewGate = can(actor, "sparring.view", { sparringAccessMode: session.accessMode, sparringPrivileged });
  if (!viewGate.allowed) notFound();

  const activeParticipants = session.participants.filter((p) => !["REJECTED", "CANCELLED"].includes(p.status));
  const pendingParticipants = session.participants.filter((p) => p.status === "REQUESTED");

  const rosterFighters = isHost
    ? await prisma.fighterProfile.findMany({
        where: { clubId: session.clubId, id: { notIn: session.participants.map((p) => p.fighterId) } },
      })
    : [];

  const nominatedFighterIds = session.nominations.filter((n) => n.status === "PENDING").map((n) => n.fighterId);
  const participantFighterIds = session.participants.map((p) => p.fighterId);

  const guestClubCards = await Promise.all(
    guestClubIds.map(async (clubId) => {
      const club = await prisma.club.findUnique({ where: { id: clubId } });
      const invite = session.clubInvites.find((inv) => inv.invitedClubId === clubId) ?? null;
      const request = session.clubRequests.find((r) => r.requestingClubId === clubId) ?? null;
      const accepted =
        (session.accessMode === "INVITE" && invite?.status === "ACCEPTED") ||
        (session.accessMode === "OPEN_TO_CLUBS" && request?.status === "ACCEPTED");
      const myNominations = session.nominations.filter((n) => n.nominatingClubId === clubId);
      const nominatableRoster = accepted
        ? await prisma.fighterProfile.findMany({
            where: {
              clubId,
              id: { notIn: [...participantFighterIds, ...nominatedFighterIds] },
            },
          })
        : [];
      return { club, invite, request, accepted, myNominations, nominatableRoster };
    }),
  );
  const visibleGuestClubCards = guestClubCards.filter((c) => c.club && (session.accessMode !== "INVITE" || c.invite));

  const pendingClubRequests = session.clubRequests.filter((r) => r.status === "PENDING");
  const pendingNominations = session.nominations.filter((n) => n.status === "PENDING");

  const invitableClubs =
    isHost && session.accessMode === "INVITE" && clubQuery
      ? await prisma.club.findMany({
          where: {
            name: { contains: clubQuery, mode: "insensitive" },
            id: { not: session.clubId, notIn: session.clubInvites.map((inv) => inv.invitedClubId) },
          },
          take: 10,
        })
      : [];

  const checkIns = await prisma.checkIn.findMany({ where: { attachedType: "SPARRING_SESSION", attachedId: session.id } });
  const checkInFor = (fighterId: string) => checkIns.find((c) => c.fighterId === fighterId) ?? null;

  return (
    <div className="space-y-6 pt-2">
      <div>
        <div className="flex items-center gap-2">
          <Badge>Sparring</Badge>
          <span className="text-xs text-mute">{MODE_LABEL[session.accessMode]}</span>
        </div>
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

      {/* --- Open sparring: unchanged direct self-join path --- */}
      {session.accessMode === "OPEN" && actor && ownFighter && !ownParticipant && session.status === "OPEN" && (
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

      {session.accessMode === "OPEN" && !actor && session.status === "OPEN" && (
        <div className="rounded-card border border-white/10 p-4 text-center space-y-2">
          <p className="text-sm text-mute">Sign in or create an account to join this session.</p>
          <Link
            href={`/account?returnTo=${encodeURIComponent(`/sparring/${session.id}`)}`}
            className="inline-block rounded-pill bg-signal text-onsignal font-semibold px-5 py-2.5 text-sm"
          >
            Sign in
          </Link>
        </div>
      )}

      {session.accessMode === "OPEN" && actor && !ownFighter && session.status === "OPEN" && (
        <div className="rounded-card border border-white/10 p-4 text-center space-y-2">
          <p className="text-sm text-mute">Register as a boxer to join this session.</p>
          <Link
            href={`/account?returnTo=${encodeURIComponent(`/sparring/${session.id}`)}`}
            className="inline-block rounded-pill border border-white/20 text-ink font-semibold px-5 py-2.5 text-sm"
          >
            Register as boxer
          </Link>
        </div>
      )}

      {/* --- Invite / Open-to-clubs: club-gated entry --- */}
      {session.accessMode !== "OPEN" && !actor && (
        <div className="rounded-card border border-white/10 p-4 text-center space-y-2">
          <p className="text-sm text-mute">Sign in to see how your club can join this session.</p>
          <Link
            href={`/account?returnTo=${encodeURIComponent(`/sparring/${session.id}`)}`}
            className="inline-block rounded-pill bg-signal text-onsignal font-semibold px-5 py-2.5 text-sm"
          >
            Sign in
          </Link>
        </div>
      )}

      {session.accessMode !== "OPEN" &&
        actor &&
        !isHost &&
        guestClubIds.length === 0 &&
        !ownParticipant &&
        !ownNomination && (
          <div className="rounded-card border border-white/10 p-4 text-center space-y-2">
            <p className="text-sm text-mute">
              This session only accepts fighters nominated by an accepted club.
            </p>
            <Link href="/club" className="inline-block rounded-pill border border-white/20 text-ink font-semibold px-5 py-2.5 text-sm">
              Represent a club
            </Link>
          </div>
        )}

      {session.accessMode !== "OPEN" && ownNomination && !ownParticipant && (
        <div className="rounded-card border border-white/10 p-4">
          <p className="text-sm font-medium">
            {ownNomination.status === "PENDING"
              ? "Your club nominated you — waiting on the host."
              : `Your nomination was ${NOMINATION_STATUS_LABEL[ownNomination.status].toLowerCase()}.`}
          </p>
        </div>
      )}

      {session.accessMode !== "OPEN" &&
        visibleGuestClubCards.map(({ club, invite, request, accepted, myNominations, nominatableRoster }) => (
          <section key={club!.id} className="rounded-card bg-panel border border-white/10 p-4 space-y-3">
            <p className="text-xs font-semibold text-mute uppercase tracking-wide">{club!.name}</p>

            {session.accessMode === "INVITE" && invite && invite.status === "PENDING" && (
              <div className="space-y-2">
                <p className="text-sm text-mute">{session.club.name} invited your club to spar.</p>
                <div className="flex gap-2">
                  <form
                    action={async () => {
                      "use server";
                      await respondToClubInvite(invite.id, true);
                    }}
                    className="flex-1"
                  >
                    <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-2 text-xs">
                      Accept invite
                    </button>
                  </form>
                  <form
                    action={async () => {
                      "use server";
                      await respondToClubInvite(invite.id, false);
                    }}
                    className="flex-1"
                  >
                    <button type="submit" className="w-full rounded-pill border border-white/20 py-2 text-xs font-medium">
                      Decline
                    </button>
                  </form>
                </div>
              </div>
            )}

            {session.accessMode === "INVITE" && invite && invite.status === "DECLINED" && (
              <p className="text-sm text-mute">You declined this invite.</p>
            )}

            {session.accessMode === "OPEN_TO_CLUBS" && !request && (
              <form
                action={async (formData: FormData) => {
                  "use server";
                  await requestToJoinSession(session.id, formData);
                }}
              >
                <input type="hidden" name="clubId" value={club!.id} />
                <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-2.5 text-sm">
                  Request to join
                </button>
              </form>
            )}

            {session.accessMode === "OPEN_TO_CLUBS" && request?.status === "PENDING" && (
              <p className="text-sm text-mute">Request pending — waiting on {session.club.name}.</p>
            )}
            {session.accessMode === "OPEN_TO_CLUBS" && request?.status === "DECLINED" && (
              <p className="text-sm text-mute">{session.club.name} declined your request to join.</p>
            )}

            {accepted && (
              <div className="space-y-3 pt-1">
                {nominatableRoster.length > 0 && (
                  <form
                    action={async (formData: FormData) => {
                      "use server";
                      await nominateFighter(session.id, formData);
                    }}
                    className="flex gap-2"
                  >
                    <input type="hidden" name="clubId" value={club!.id} />
                    <select name="fighterId" className={inputClass}>
                      {nominatableRoster.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.displayName}
                        </option>
                      ))}
                    </select>
                    {session.weightGroups.length > 0 && (
                      <select name="weightGroupId" className={inputClass}>
                        <option value="">No weight group</option>
                        {session.weightGroups.map((wg) => (
                          <option key={wg.id} value={wg.id}>
                            {wg.label}
                          </option>
                        ))}
                      </select>
                    )}
                    <button type="submit" className="rounded-pill border border-white/20 px-4 text-sm font-medium">
                      Nominate
                    </button>
                  </form>
                )}
                {myNominations.length > 0 && (
                  <div className="space-y-1">
                    {myNominations.map((n) => (
                      <div key={n.id} className="flex items-center justify-between text-sm">
                        <span>
                          {n.fighter.displayName}
                          {n.weightGroup ? ` · ${n.weightGroup.label}` : ""}
                        </span>
                        <span className="flex items-center gap-2">
                          <span className="text-xs text-mute">{NOMINATION_STATUS_LABEL[n.status]}</span>
                          {n.status === "PENDING" && (
                            <form
                              action={async () => {
                                "use server";
                                await withdrawNomination(n.id);
                              }}
                            >
                              <button type="submit" className="text-xs text-mute underline">
                                Withdraw
                              </button>
                            </form>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        ))}

      {ownParticipant && (
        <div className="rounded-card border border-white/10 p-4 flex items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium">You&apos;re {STATUS_LABEL[ownParticipant.status].toLowerCase()}</p>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            {ownParticipant.status === "CONFIRMED" && checkInFor(ownParticipant.fighterId)?.status !== "CHECKED_IN" && (
              <Link
                href={`/checkin/sparring/${session.id}`}
                className="rounded-pill bg-signal text-onsignal font-semibold px-4 py-2 text-xs"
              >
                Check In
              </Link>
            )}
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
          <div className="grid grid-cols-2 gap-2">
            <QrCodeSheet path={`/checkin/sparring/${session.id}`} label="Check-in QR" buttonLabel="Show check-in QR" />
            <form
              action={async () => {
                "use server";
                await notifyCheckInOpen("SPARRING_SESSION", session.id);
              }}
            >
              <button type="submit" className="w-full rounded-pill border border-white/20 text-ink font-semibold py-3 text-sm">
                Notify fighters
              </button>
            </form>
          </div>

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

          {session.accessMode === "INVITE" && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <p className="text-xs font-semibold text-mute uppercase tracking-wide">Invite a club</p>
              <form className="flex gap-2">
                <input name="clubQuery" defaultValue={clubQuery ?? ""} placeholder="Search clubs" className={inputClass} />
                <button type="submit" className="rounded-pill border border-white/20 px-4 text-sm font-medium">
                  Search
                </button>
              </form>
              {invitableClubs.length > 0 && (
                <div className="space-y-1">
                  {invitableClubs.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-sm">
                      <span>{c.name}</span>
                      <form
                        action={async (formData: FormData) => {
                          "use server";
                          await inviteClub(session.id, formData);
                        }}
                      >
                        <input type="hidden" name="clubId" value={c.id} />
                        <button type="submit" className="rounded-pill border border-white/20 px-3 py-1 text-xs font-medium">
                          Invite
                        </button>
                      </form>
                    </div>
                  ))}
                </div>
              )}
              {session.clubInvites.length > 0 && (
                <div className="space-y-1 pt-1">
                  {session.clubInvites.map((inv) => (
                    <div key={inv.id} className="flex items-center justify-between text-sm">
                      <span>{inv.invitedClub.name}</span>
                      <span className="text-xs text-mute">{CLUB_STATUS_LABEL[inv.status]}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {session.accessMode === "OPEN_TO_CLUBS" && pendingClubRequests.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <p className="text-xs font-semibold text-mute uppercase tracking-wide">Club requests</p>
              {pendingClubRequests.map((r) => (
                <div key={r.id} className="rounded-card border border-white/10 p-3 flex items-center justify-between">
                  <span className="text-sm">{r.requestingClub.name}</span>
                  <div className="flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await respondToClubRequest(r.id, true);
                      }}
                    >
                      <button type="submit" className="rounded-pill bg-signal text-onsignal px-3 py-1 text-xs font-semibold">
                        Accept
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await respondToClubRequest(r.id, false);
                      }}
                    >
                      <button type="submit" className="rounded-pill border border-white/20 px-3 py-1 text-xs font-medium">
                        Decline
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}

          {session.accessMode !== "OPEN" && pendingNominations.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-white/10">
              <p className="text-xs font-semibold text-mute uppercase tracking-wide">Nominations pending</p>
              {pendingNominations.map((n) => (
                <div key={n.id} className="rounded-card border border-white/10 p-3 flex items-center justify-between">
                  <span className="text-sm">
                    {n.fighter.displayName} <span className="text-mute">· {n.nominatingClub.name}</span>
                  </span>
                  <div className="flex gap-2">
                    <form
                      action={async () => {
                        "use server";
                        await respondToNomination(n.id, true);
                      }}
                    >
                      <button type="submit" className="rounded-pill bg-signal text-onsignal px-3 py-1 text-xs font-semibold">
                        Accept
                      </button>
                    </form>
                    <form
                      action={async () => {
                        "use server";
                        await respondToNomination(n.id, false);
                      }}
                    >
                      <button type="submit" className="rounded-pill border border-white/20 px-3 py-1 text-xs font-medium">
                        Decline
                      </button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
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
