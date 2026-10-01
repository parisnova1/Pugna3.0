import Link from "next/link";
import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { ClubNav } from "@/components/club/ClubNav";

/** Thin landing into the existing, unmodified sparring pages — no duplicate
 * sparring system here, per the redesign brief's own "keep the existing
 * concept, simplify the interface" instruction. */
export default async function ClubSparringPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/club/sparring");
  if (actor.clubIds.length === 0) redirect("/club");

  return (
    <div className="space-y-6 pt-2">
      <h1 className="text-2xl font-semibold">Sparring</h1>
      <ClubNav active="sparring" />

      <div className="space-y-2">
        <Link href="/sparring/host/new" className="block rounded-pill bg-signal text-onsignal font-semibold py-3.5 text-center">
          + Create Sparring
        </Link>
        <Link href="/sparring" className="block rounded-card bg-panel border border-white/10 p-4">
          <p className="font-semibold text-sm">Find Sparring</p>
          <p className="text-xs text-mute mt-1">Discover open sessions from other clubs</p>
        </Link>
        <Link href="/sparring/host" className="block rounded-card bg-panel border border-white/10 p-4">
          <p className="font-semibold text-sm">My Sparring</p>
          <p className="text-xs text-mute mt-1">Sessions this club hosts or is part of</p>
        </Link>
      </div>
    </div>
  );
}
