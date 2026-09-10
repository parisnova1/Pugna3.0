import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { addRosterFighter, addCoach, removeCoach } from "@/lib/actions/club";
import { ActionForm } from "@/components/host/ActionForm";

const inputClass = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

export default async function ClubRosterPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/roster");
  const clubId = actor.clubIds[0];
  if (!clubId) redirect("/club");

  const { tab } = await searchParams;
  const activeTab = tab === "coaches" || tab === "teams" ? tab : "fighters";

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Roster</h1>

      <nav className="flex gap-2 text-sm">
        <Link
          href="/club/roster?tab=fighters"
          className={`rounded-pill border px-4 py-2 font-medium ${activeTab === "fighters" ? "border-signal bg-signal/10" : "border-white/15 text-mute"}`}
        >
          Fighters
        </Link>
        <Link
          href="/club/roster?tab=coaches"
          className={`rounded-pill border px-4 py-2 font-medium ${activeTab === "coaches" ? "border-signal bg-signal/10" : "border-white/15 text-mute"}`}
        >
          Coaches
        </Link>
        <Link
          href="/club/roster?tab=teams"
          className={`rounded-pill border px-4 py-2 font-medium ${activeTab === "teams" ? "border-signal bg-signal/10" : "border-white/15 text-mute"}`}
        >
          Teams
        </Link>
      </nav>

      {activeTab === "fighters" && <FightersTab clubId={clubId} />}
      {activeTab === "coaches" && <CoachesTab clubId={clubId} />}
      {activeTab === "teams" && (
        <p className="text-sm text-mute text-center py-10">Team groupings are coming soon.</p>
      )}
    </div>
  );
}

async function FightersTab({ clubId }: { clubId: string }) {
  const fighters = await prisma.fighterProfile.findMany({ where: { clubId }, orderBy: { displayName: "asc" } });

  return (
    <>
      {fighters.length === 0 ? (
        <p className="text-mute text-sm">No boxers yet.</p>
      ) : (
        <div className="space-y-2">
          {fighters.map((f) => (
            <div key={f.id} className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3">
              <Link href={`/fighters/${f.id}`} className="text-sm font-medium">
                {f.displayName}
              </Link>
              <p className="text-xs text-mute">{f.weightClass ?? "—"}</p>
            </div>
          ))}
        </div>
      )}

      <ActionForm action={addRosterFighter} submitLabel="Add boxer" className="space-y-3">
        <input type="hidden" name="clubId" value={clubId} />
        <input name="name" placeholder="Boxer name" required className={inputClass} />
        <input name="weightClass" placeholder="Weight class" className={inputClass} />
      </ActionForm>
    </>
  );
}

async function CoachesTab({ clubId }: { clubId: string }) {
  const coaches = await prisma.coach.findMany({ where: { clubId }, orderBy: { displayName: "asc" } });

  return (
    <>
      {coaches.length === 0 ? (
        <p className="text-mute text-sm">No coaches yet.</p>
      ) : (
        <div className="space-y-2">
          {coaches.map((c) => (
            <div key={c.id} className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3">
              <div>
                <p className="text-sm font-medium">{c.displayName}</p>
                {c.bio && <p className="text-xs text-mute mt-0.5">{c.bio}</p>}
              </div>
              <form
                action={async () => {
                  "use server";
                  await removeCoach(c.id, clubId);
                }}
              >
                <button type="submit" className="text-xs text-mute underline">
                  Remove
                </button>
              </form>
            </div>
          ))}
        </div>
      )}

      <ActionForm action={addCoach} submitLabel="Add coach" className="space-y-3">
        <input type="hidden" name="clubId" value={clubId} />
        <input name="name" placeholder="Coach name" required className={inputClass} />
        <input name="bio" placeholder="Bio (optional)" className={inputClass} />
      </ActionForm>
    </>
  );
}
