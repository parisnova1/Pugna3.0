import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { becomeBoxer } from "@/lib/actions/profile";
import { BackButton } from "@/components/event/ContextBar";

const BENEFITS = [
  "Your Boxer profile",
  "Your fight record",
  "Upcoming fights",
  "Follow your own fights",
  "Fight notifications",
  "Join clubs",
];

export default async function BecomeBoxerPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/become-boxer");
  if (actor.isBoxer) redirect("/you");

  return (
    <div className="space-y-6 pt-2">
      <BackButton fallbackHref="/account" />

      <div className="space-y-2 text-center pt-4">
        <h1 className="text-2xl font-bold tracking-tight">Become a Boxer</h1>
        <p className="text-mute text-sm max-w-xs mx-auto">
          Create your fighter profile, track your record, follow your fights and join a club.
        </p>
      </div>

      <form
        action={async () => {
          "use server";
          await becomeBoxer();
          redirect("/you");
        }}
      >
        <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3.5">
          Create Boxer Profile
        </button>
      </form>

      <div className="rounded-card bg-panel border border-white/10 p-4 space-y-2.5">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">What you get</p>
        {BENEFITS.map((b) => (
          <p key={b} className="text-sm flex items-center gap-2">
            <span className="text-signal">✓</span> {b}
          </p>
        ))}
      </div>
    </div>
  );
}
