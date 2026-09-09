import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { can } from "@/lib/rbac";

/** Shared guard for every /host/events/:id/* page — resolves actor + event or redirects/404s. */
export async function requireHostEvent(eventId: string, returnTo: string) {
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

  const gate = can(actor, "event.edit", { eventId });
  if (!gate.allowed) redirect("/host");

  return { actor, event };
}
