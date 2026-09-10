import Link from "next/link";
import { getActor } from "@/lib/actor";

export default async function SparringPage() {
  const actor = await getActor();
  const hasClub = Boolean(actor && actor.clubIds.length > 0);

  return (
    <div className="pt-10 text-center space-y-4">
      <h1 className="text-2xl font-semibold">Sparring</h1>
      <p className="text-mute text-sm">
        Find your next sparring partner. The full sparring marketplace — discovery, matchmaking, and
        check-in — is coming soon.
      </p>
      {hasClub ? (
        <Link href="/club/sparring" className="inline-block rounded-pill bg-signal text-onsignal font-semibold px-5 py-3 text-sm">
          Open your club&apos;s sparring board
        </Link>
      ) : (
        <Link href="/clubs" className="inline-block rounded-pill border border-white/20 text-ink font-semibold px-5 py-3 text-sm">
          Browse clubs
        </Link>
      )}
    </div>
  );
}
