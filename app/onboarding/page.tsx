import Link from "next/link";

export const metadata = { title: "Welcome to PUGNA" };

/**
 * Full-bleed splash screen -- deliberately outside the (shell) route group
 * so it escapes the shell's max-w-md/padding/TabBar wrapper entirely. Pure
 * presentation: both buttons hand off to the existing /account auth flow
 * (AuthScreen), which already does all the real sign-in/register work.
 */
export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string }>;
}) {
  const { returnTo } = await searchParams;
  const safeReturnTo = returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//") ? returnTo : "/";
  const authQuery = safeReturnTo !== "/" ? `&returnTo=${encodeURIComponent(safeReturnTo)}` : "";

  return (
    <div className="relative min-h-screen overflow-hidden bg-void">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/onboarding-hero.jpg"
        alt=""
        className="absolute inset-0 w-full h-full object-cover object-top"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/70 to-void/10" />
      <div className="absolute inset-0 bg-gradient-to-b from-void/40 via-transparent to-transparent" />

      <div className="relative min-h-screen flex flex-col justify-end px-6 pb-[calc(env(safe-area-inset-bottom)+32px)] pt-12">
        <div className="space-y-1.5 mb-8">
          <h1 className="text-4xl font-bold tracking-tight text-ink">
            PUGNA<span className="text-signal">.</span>
          </h1>
          <p className="text-lg font-semibold text-ink/90 leading-snug">
            Combat sports.
            <br />
            All in one place.
          </p>
          <p className="text-sm text-mute">Events, sparring &amp; clubs -- no subscription.</p>
        </div>

        <div className="flex gap-3">
          <Link
            href={`/account?mode=signin${authQuery}`}
            className="flex-1 text-center rounded-pill bg-signal text-onsignal font-bold py-3.5"
          >
            Log In
          </Link>
          <Link
            href={`/account?mode=register${authQuery}`}
            className="flex-1 text-center rounded-pill bg-panel border border-white/20 text-ink font-bold py-3.5"
          >
            Sign Up
          </Link>
        </div>

        <Link
          href={safeReturnTo}
          className="block text-center rounded-pill border border-white/15 text-ink/80 font-semibold py-3 mt-3"
        >
          Discover
        </Link>
      </div>
    </div>
  );
}
