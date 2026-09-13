import Link from "next/link";
import { requireHostEvent } from "@/lib/host-guard";
import { cancelEvent } from "@/lib/actions/event";
import { formatEventDate } from "@/lib/format";
import { QrCodeSheet } from "@/components/event/QrCodeSheet";

const MANAGEMENT_STEPS = [
  { href: "pair", label: "Pair Fighters", desc: "Match bouts" },
  { href: "checkin", label: "Check-In", desc: "Roster arrivals" },
  { href: "entries", label: "Boxers", desc: "Nominations and clubs" },
  { href: "structure", label: "Rings", desc: "Sport, rings, days" },
  { href: "schedule", label: "Schedule", desc: "Times and order" },
  { href: "media", label: "Media", desc: "Cover, gallery, sponsors" },
  { href: "review", label: "Settings", desc: "Blockers, warnings, publish" },
];

export default async function HostEventDashboard({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { event } = await requireHostEvent(id, `/host/events/${id}`);
  const isLive = event.status === "PUBLISHED" || event.status === "LIVE" || event.status === "INTERMISSION";

  return (
    <div className="space-y-6 pt-2">
      <div>
        <span
          className={`text-[11px] font-semibold rounded-pill px-2 py-0.5 border ${
            event.status === "LIVE" || event.status === "INTERMISSION"
              ? "text-live border-live/40"
              : "text-mute border-white/10"
          }`}
        >
          {event.status === "LIVE" ? "🟢 LIVE" : event.status}
        </span>
        <h1 className="text-2xl font-semibold mt-2">{event.name}</h1>
        <p className="text-mute text-sm mt-1">{formatEventDate(event.date)} · {event.venue ?? event.city ?? "TBD"}</p>
      </div>

      {isLive && (
        <Link
          href={`/host/events/${event.id}/live`}
          className="block rounded-pill bg-signal text-onsignal font-bold text-center py-3.5"
        >
          Open Event Control →
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2">
        {event.slug && (
          <Link
            href={`/e/${event.slug}`}
            className="block rounded-pill border border-white/20 text-ink font-semibold text-center py-2.5 text-sm"
          >
            Public view
          </Link>
        )}
        {event.code && (
          <QrCodeSheet
            path={`/go/${event.code}`}
            label="Event QR"
            buttonLabel="Show event QR"
            caption={`Scan to open ${event.name}, or share the code: ${event.code}`}
          />
        )}
        {!event.slug && event.ringCount === 1 && event.dayCount === 1 && (
          <Link
            href={`/host/events/${event.id}/preview`}
            className="block rounded-pill border border-white/20 text-ink font-semibold text-center py-2.5 text-sm"
          >
            Preview public card
          </Link>
        )}
      </div>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Quick update</p>
        <div className="grid grid-cols-2 gap-2">
          <Link href={`/host/events/${event.id}/build`} className="rounded-card bg-panel border border-white/10 p-3 text-sm font-semibold text-center">
            Update Event Info
          </Link>
          <Link href={`/host/events/${event.id}/schedule`} className="rounded-card bg-panel border border-white/10 p-3 text-sm font-semibold text-center">
            Change Schedule
          </Link>
          <Link href={`/host/events/${event.id}/pair`} className="rounded-card bg-panel border border-white/10 p-3 text-sm font-semibold text-center">
            Add / Remove Bout
          </Link>
          <Link href={`/host/events/${event.id}/structure`} className="rounded-card bg-panel border border-white/10 p-3 text-sm font-semibold text-center">
            Change Ring
          </Link>
          {isLive && (
            <>
              <Link href={`/host/events/${event.id}/live`} className="rounded-card bg-panel border border-white/10 p-3 text-sm font-semibold text-center">
                Add Break
              </Link>
              <Link href={`/host/events/${event.id}/live`} className="rounded-card bg-panel border border-white/10 p-3 text-sm font-semibold text-center">
                Announcement
              </Link>
            </>
          )}
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-semibold text-mute uppercase tracking-wide">Event management</p>
        <div className="space-y-2">
          {MANAGEMENT_STEPS.map((step) => (
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
      </section>

      {event.status !== "CANCELLED" && event.status !== "ARCHIVED" && (
        <details className="rounded-card border border-white/10 p-4">
          <summary className="text-sm text-error cursor-pointer">Cancel event</summary>
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
