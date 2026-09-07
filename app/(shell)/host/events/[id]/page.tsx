import Link from "next/link";
import { requireHostEvent } from "@/lib/host-guard";
import { cancelEvent } from "@/lib/actions/event";
import { formatEventDate } from "@/lib/format";

const STEPS = [
  { href: "build", label: "Skeleton", desc: "Name, date, venue" },
  { href: "structure", label: "Structure", desc: "Sport, rings, days" },
  { href: "entries", label: "Entries", desc: "Fighters and clubs" },
  { href: "pair", label: "Pair", desc: "Match bouts" },
  { href: "schedule", label: "Schedule", desc: "Times and order" },
  { href: "review", label: "Review & publish", desc: "Blockers, warnings" },
];

export default async function HostEventDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}`);

  return (
    <div className="space-y-6 pt-2">
      <div>
        <span className="text-[11px] font-semibold text-mute border border-white/10 rounded-pill px-2 py-0.5">
          {event.status}
        </span>
        <h1 className="text-2xl font-semibold mt-2">{event.name}</h1>
        <p className="text-mute text-sm mt-1">{formatEventDate(event.date)} · {event.venue ?? event.city ?? "TBD"}</p>
      </div>

      {(event.status === "PUBLISHED" || event.status === "LIVE" || event.status === "INTERMISSION") && (
        <Link
          href={`/host/events/${event.id}/live`}
          className="block rounded-pill bg-signal text-onsignal font-semibold text-center py-3"
        >
          Open live console
        </Link>
      )}

      {event.slug && (
        <Link href={`/e/${event.slug}`} className="block text-center text-sm text-mute underline">
          View public event card
        </Link>
      )}

      <div className="space-y-2">
        {STEPS.map((step) => (
          <Link
            key={step.href}
            href={`/host/events/${event.id}/${step.href}`}
            className="flex items-center justify-between rounded-card bg-panel border border-white/10 px-4 py-3"
          >
            <div>
              <p className="text-sm font-medium">{step.label}</p>
              <p className="text-xs text-mute mt-0.5">{step.desc}</p>
            </div>
            <span className="text-mute">›</span>
          </Link>
        ))}
      </div>

      {event.status !== "CANCELLED" && event.status !== "ARCHIVED" && (
        <details className="rounded-card border border-white/10 p-4">
          <summary className="text-sm text-signal cursor-pointer">Cancel event</summary>
          <form
            action={async (formData: FormData) => {
              "use server";
              await cancelEvent(event.id, formData);
            }}
            className="mt-3 space-y-2"
          >
            <input
              name="reason"
              placeholder="Reason"
              className="w-full rounded-card bg-panel border border-white/10 px-3 py-2 text-sm"
            />
            <button type="submit" className="w-full rounded-pill border border-signal text-signal font-semibold py-2 text-sm">
              Confirm cancel
            </button>
          </form>
        </details>
      )}
    </div>
  );
}
