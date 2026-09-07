import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { signOut } from "@/lib/auth";
import { registerAction, signInAction } from "@/lib/actions/auth";
import { HatSwitcher } from "@/components/nav/HatSwitcher";
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

  const user = await prisma.user.findUnique({ where: { id: actor.userId } });

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold">{user?.name || user?.email}</h1>
        <p className="text-mute text-sm mt-1">{user?.email}</p>
      </div>

      <HatSwitcher hats={actor.hats} activeHat={actor.activeHat} />

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
