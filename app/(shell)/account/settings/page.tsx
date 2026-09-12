import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { signOut } from "@/lib/auth";
import { updateName, becomeOrganizer } from "@/lib/actions/profile";
import { BackButton } from "@/components/event/ContextBar";

export default async function AccountSettingsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/account/settings");

  const [user, clubs, fighter] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.userId } }),
    actor.clubIds.length > 0 ? prisma.club.findMany({ where: { id: { in: actor.clubIds } } }) : Promise.resolve([]),
    prisma.fighterProfile.findUnique({ where: { userId: actor.userId }, include: { club: true } }),
  ]);

  let record: { wins: number; losses: number; draws: number } | null = null;
  let upcomingCount = 0;
  let historyCount = 0;

  if (fighter) {
    const [upcoming, finished] = await Promise.all([
      prisma.bout.count({
        where: { OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }], status: { in: ["CONFIRMED", "READY", "DELAYED"] } },
      }),
      prisma.bout.findMany({
        where: { OR: [{ fighterAId: fighter.id }, { fighterBId: fighter.id }], status: "FINAL" },
        include: { result: true },
      }),
    ]);
    upcomingCount = upcoming;
    historyCount = finished.length;
    record = {
      wins: finished.filter((b) => b.result?.winnerId === fighter.id).length,
      losses: finished.filter((b) => b.result?.winnerId && b.result.winnerId !== fighter.id).length,
      draws: finished.filter((b) => b.result && !b.result.winnerId).length,
    };
  }

  return (
    <div className="space-y-8 pt-2">
      <div className="flex items-center justify-between">
        <BackButton fallbackHref="/account" />
        <h1 className="text-2xl font-semibold">Account & Settings</h1>
        <span className="w-6" />
      </div>

      <section className="space-y-3">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Profile</p>
        <form
          action={async (formData: FormData) => {
            "use server";
            await updateName(formData);
          }}
          className="flex items-center gap-2"
        >
          <input
            type="text"
            name="name"
            defaultValue={user?.name ?? ""}
            placeholder="Your name"
            className="flex-1 rounded-pill border border-white/15 bg-panel px-4 py-2.5 text-sm"
          />
          <button type="submit" className="rounded-pill border border-white/20 px-4 py-2.5 text-sm font-semibold">
            Save
          </button>
        </form>
        <p className="text-sm text-mute px-1">{user?.email}</p>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">PUGNA role</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4">
            <p className="font-medium text-sm">Viewer</p>
            <span className="text-success text-sm font-semibold">✓</span>
          </div>

          <div className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4">
            <p className="font-medium text-sm">Boxer</p>
            {actor.isBoxer ? (
              <span className="text-success text-sm font-semibold">✓</span>
            ) : (
              <Link href="/become-boxer" className="rounded-pill border border-white/20 px-3 py-1.5 text-xs font-semibold">
                Become a Boxer
              </Link>
            )}
          </div>

          <div className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4">
            <p className="font-medium text-sm">Organizer</p>
            {actor.isOrganizer ? (
              <span className="text-success text-sm font-semibold">✓</span>
            ) : (
              <form
                action={async () => {
                  "use server";
                  await becomeOrganizer();
                }}
              >
                <button type="submit" className="rounded-pill border border-white/20 px-3 py-1.5 text-xs font-semibold">
                  Become an organizer
                </button>
              </form>
            )}
          </div>
        </div>
      </section>

      {fighter && (
        <section className="space-y-2">
          <p className="text-xs font-semibold text-mute uppercase tracking-wide">My boxer profile</p>
          <Link href="/you" className="block rounded-card bg-panel border border-white/10 p-4 space-y-1.5">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">Status: Active</p>
              <span className="text-mute">›</span>
            </div>
            {fighter.club && <p className="text-sm text-mute">{fighter.club.name}</p>}
            {record && (
              <p className="text-sm tabular">
                Record {record.wins}–{record.losses}–{record.draws}
              </p>
            )}
            <p className="text-xs text-mute">
              {upcomingCount} upcoming · {historyCount} past
            </p>
          </Link>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Clubs</p>
        {clubs.map((club) => (
          <Link
            key={club.id}
            href={`/club?club=${club.id}`}
            className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4"
          >
            <p className="font-semibold text-sm">{club.name}</p>
            <span className="text-mute">›</span>
          </Link>
        ))}
        <Link href="/club" className="block w-full text-center rounded-pill border border-white/20 text-ink font-semibold py-3">
          Represent a club
        </Link>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Preferences</p>
        <Link href="/you/notifications" className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4">
          <p className="font-medium text-sm">Notifications</p>
          <span className="text-mute">›</span>
        </Link>
      </section>

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
  );
}
