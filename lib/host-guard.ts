import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";

/**
 * Shared guard for every /host/events/:id/* page — resolves actor + event or
 * redirects/404s. Defaults to Owner/Admin-only ("admin", via `event.edit`) —
 * the right gate for build/structure/entries/schedule/pair/media/review. Pass
 * `{ minimum: "member" }` for pages any host role (including Ring Official
 * and Staff) may open, like the live console — it uses `live.access`, and
 * finer per-action restriction (e.g. ring scoping) happens in the actions
 * themselves via `live.act`, never here.
 */
export async function requireHostEvent(eventId: string, returnTo: string, options: { minimum?: "admin" | "member" } = {}) {
  const actor = await getActor();
  if (!actor) redirect(`/account?returnTo=${encodeURIComponent(returnTo)}`);

  const event = await prisma.event.findUnique({
    where: { id: eventId },
    include: {
      bouts: { include: { fighterA: true, fighterB: true, result: true, ring: true }, orderBy: { number: "asc" } },
      rings: { orderBy: { number: "asc" } },
    },
  });
  if (!event) notFound();

  const gate = can(actor, options.minimum === "member" ? "live.access" : "event.edit", { eventId });
  if (!gate.allowed) redirect("/host");

  return { actor, event };
}
