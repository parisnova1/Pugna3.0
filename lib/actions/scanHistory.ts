"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";

export type ScanKind = "EVENT" | "SPARRING";

/** Records one row of real Scan-hub history — never called speculatively, only after a scan/manual
 * entry actually resolved to something, or a check-in actually succeeded. */
export async function logScan(params: { userId: string; kind: ScanKind; label: string; detail: string; href: string }): Promise<void> {
  await prisma.scanEvent.create({ data: params });
}

const EVENT_PATH = /^\/e\/([^/]+)\/?$/;
const SPARRING_PATH = /^\/sparring\/([^/]+)\/?$/;

/** Called from the Scan hub right after a QR decode or manual code resolves to a real event or
 * sparring-session page (not a check-in path — those log their own "Check in successful" entry from
 * inside the check-in actions themselves). No-op for guests and for any other destination. */
export async function logScanOpen(path: string): Promise<void> {
  const actor = await getActor();
  if (!actor) return;

  const eventMatch = EVENT_PATH.exec(path);
  if (eventMatch) {
    const event = await prisma.event.findUnique({ where: { slug: eventMatch[1] } });
    if (event) await logScan({ userId: actor.userId, kind: "EVENT", label: event.name, detail: "Event opened", href: path });
    return;
  }

  const sparringMatch = SPARRING_PATH.exec(path);
  if (sparringMatch) {
    const session = await prisma.sparringSession.findUnique({ where: { id: sparringMatch[1] }, include: { club: true } });
    if (session) await logScan({ userId: actor.userId, kind: "SPARRING", label: session.club.name, detail: "Session opened", href: path });
  }
}
