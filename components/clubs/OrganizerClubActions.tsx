"use client";

import { useState, useTransition } from "react";
import { inviteClubToEvent } from "@/lib/actions/clubEvent";
import { formatEventDate } from "@/lib/format";

type EventOption = { id: string; name: string; date: Date };
type Relation = { eventId: string; status?: "PENDING" | "ACCEPTED" | "DECLINED" };

/**
 * Organizer-only actions on a club's public profile — the one place §5 of
 * the brief asks for full event context inline so the club never has to
 * navigate elsewhere to understand an invite. Never shows private roster
 * data; this block only ever talks about the organizer's own events.
 */
export function OrganizerClubActions({
  clubId,
  clubName,
  events,
  invites,
  requests,
  participations,
}: {
  clubId: string;
  clubName: string;
  events: EventOption[];
  invites: Relation[];
  requests: Relation[];
  participations: { eventId: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [selectedEventId, setSelectedEventId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string[]>([]);

  const connectedIds = new Set(participations.map((p) => p.eventId));
  const invitedIds = new Set(invites.filter((i) => i.status === "PENDING").map((i) => i.eventId));
  const requestedIds = new Set(requests.filter((r) => r.status === "PENDING").map((r) => r.eventId));

  const relatedEvents = events.filter((e) => connectedIds.has(e.id) || invitedIds.has(e.id) || requestedIds.has(e.id));
  const invitableEvents = events.filter(
    (e) => !connectedIds.has(e.id) && !invitedIds.has(e.id) && !requestedIds.has(e.id) && !sentTo.includes(e.id),
  );

  function statusFor(eventId: string): string {
    if (connectedIds.has(eventId)) return "Connected";
    if (invitedIds.has(eventId)) return "Invitation sent";
    if (requestedIds.has(eventId)) return "Requested to participate";
    return "";
  }

  function submit() {
    if (!selectedEventId) return;
    setError(null);
    const eventId = selectedEventId;
    const fd = new FormData();
    fd.set("message", message);
    startTransition(async () => {
      const result = await inviteClubToEvent(eventId, clubId, fd);
      if (!result.ok) {
        setError(result.reason);
      } else {
        setSentTo((ids) => [...ids, eventId]);
        setSelectedEventId("");
        setMessage("");
      }
    });
  }

  return (
    <section className="rounded-card bg-panel border border-white/10 p-4 space-y-4">
      <p className="text-xs font-semibold text-mute uppercase tracking-wide">Organizer actions</p>

      {relatedEvents.length > 0 && (
        <div className="space-y-1.5">
          {relatedEvents.map((e) => (
            <div key={e.id} className="flex items-center justify-between text-sm">
              <span>{e.name}</span>
              <span className="text-xs text-mute">{statusFor(e.id)}</span>
            </div>
          ))}
        </div>
      )}

      {invitableEvents.length > 0 ? (
        <div className="space-y-2">
          <label className="text-xs text-mute">Invite {clubName} to</label>
          <select
            value={selectedEventId}
            onChange={(e) => setSelectedEventId(e.target.value)}
            className="w-full rounded-card bg-void border border-white/10 px-4 py-3 text-sm"
          >
            <option value="">Select one of your events</option>
            {invitableEvents.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name} — {formatEventDate(e.date)}
              </option>
            ))}
          </select>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={2}
            placeholder="Message (optional)"
            className="w-full rounded-card bg-void border border-white/10 px-4 py-3 text-sm resize-none"
          />
          {error && <p className="text-signal text-xs">{error}</p>}
          <button
            type="button"
            disabled={pending || !selectedEventId}
            onClick={submit}
            className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3 text-sm disabled:opacity-60"
          >
            Send event invitation
          </button>
        </div>
      ) : (
        relatedEvents.length === 0 && <p className="text-sm text-mute">No events available to invite {clubName} to right now.</p>
      )}
    </section>
  );
}
