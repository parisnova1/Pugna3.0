import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { signOut } from "@/lib/auth";
import { registerAction, signInAction } from "@/lib/actions/auth";
import { becomeBoxer, becomeOrganizer } from "@/lib/actions/profile";
import { AuthForm } from "@/components/account/AuthForm";

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const actor = await getActor();

  if (!actor) {
    return (
      <div className="space-y-8">
        <div>
          <h1 className="text-2xl font-semibold">Account</h1>
          <p className="text-mute text-sm mt-1">Sign in to follow, nominate, or organize.</p>
        </div>

        <AuthForm action={signInAction} returnTo={returnTo ?? "/"} title="Sign in" submitLabel="Sign in" primary />
        <AuthForm
          action={registerAction}
          returnTo={returnTo ?? "/"}
          title="Create account"
          submitLabel="Create account"
          primary={false}
          showName
        />

        <p className="text-xs text-mute text-center">
          Browsing, scanning, and viewing events never requires an account.
        </p>
      </div>
    );
  }

  const [user, clubs] = await Promise.all([
    prisma.user.findUnique({ where: { id: actor.userId } }),
    actor.clubIds.length > 0 ? prisma.club.findMany({ where: { id: { in: actor.clubIds } } }) : Promise.resolve([]),
  ]);

  const hasAnyContext = actor.isBoxer || clubs.length > 0 || actor.isOrganizer;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{user?.name || user?.email}</h1>
        <p className="text-mute text-sm mt-1">{user?.email}</p>
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Your Pugna</h2>

        {actor.isBoxer && (
          <Link href="/you" className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4">
            <div>
              <p className="font-semibold text-sm">Boxer</p>
              <p className="text-xs text-mute mt-0.5">My fights</p>
            </div>
            <span className="text-mute">›</span>
          </Link>
        )}

        {clubs.map((club) => (
          <Link
            key={club.id}
            href={`/club?club=${club.id}`}
            className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4"
          >
            <div>
              <p className="font-semibold text-sm">{club.name}</p>
              <p className="text-xs text-mute mt-0.5">Club dashboard</p>
            </div>
            <span className="text-mute">›</span>
          </Link>
        ))}

        {actor.isOrganizer && (
          <Link href="/host" className="flex items-center justify-between rounded-card bg-panel border border-white/10 p-4">
            <div>
              <p className="font-semibold text-sm">Organizer</p>
              <p className="text-xs text-mute mt-0.5">Tournament dashboard</p>
            </div>
            <span className="text-mute">›</span>
          </Link>
        )}

        {!hasAnyContext && <p className="text-sm text-mute">You&apos;re just browsing so far. Pick a space below to get started.</p>}
      </section>

      <section className="space-y-2">
        {!actor.isBoxer && (
          <form
            action={async () => {
              "use server";
              await becomeBoxer();
            }}
          >
            <button type="submit" className="w-full rounded-pill border border-white/20 text-ink font-semibold py-3">
              Register as boxer
            </button>
          </form>
        )}
        {clubs.length === 0 && (
          <Link href="/club" className="block w-full text-center rounded-pill border border-white/20 text-ink font-semibold py-3">
            Represent a club
          </Link>
        )}
        {!actor.isOrganizer && (
          <form
            action={async () => {
              "use server";
              await becomeOrganizer();
            }}
          >
            <button type="submit" className="w-full rounded-pill border border-white/20 text-ink font-semibold py-3">
              Become an organizer
            </button>
          </form>
        )}
      </section>

      <div className="space-y-2 pt-2 border-t border-white/10">
        <Link href="/you/notifications" className="block text-sm text-mute py-2">
          Notifications
        </Link>
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
    </div>
  );
}
