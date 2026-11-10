import Link from "next/link";
import { buttonClass } from "@/components/ui/Button";

/** Pre-launch nudge on public event pages: coaches and fans can leave their email. */
export function WaitlistCta({ slug }: { slug: string }) {
  return (
    <section className="rounded-card bg-panel border border-white/10 p-4">
      <p className="text-sm font-semibold">Coach or club? Run your next event on Pugna.</p>
      <p className="text-sm text-mute mt-1">
        Fight cards, live results and brackets like the ones on this page. Join the waiting list and we&apos;ll tell you when
        the app opens.
      </p>
      <Link
        href={`/waitlist?from=${encodeURIComponent(slug)}`}
        className={buttonClass({ variant: "signalOutline", size: "sm", text: "sm", className: "mt-3 inline-block px-5" })}
      >
        Join the waiting list
      </Link>
    </section>
  );
}
