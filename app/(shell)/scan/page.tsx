import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { ScannerClient, type ScanRecord } from "@/components/scan/ScannerClient";

function toRecord(row: { id: string; label: string; detail: string; href: string; createdAt: Date }): ScanRecord {
  return { id: row.id, label: row.label, detail: row.detail, href: row.href, createdAt: row.createdAt.toISOString() };
}

export default async function ScanPage({
  searchParams,
}: {
  searchParams: Promise<{ mode?: string; intent?: string }>;
}) {
  const { mode, intent } = await searchParams;
  const actor = await getActor();

  const [eventScans, sparringScans] = actor
    ? await Promise.all([
        prisma.scanEvent.findMany({ where: { userId: actor.userId, kind: "EVENT" }, orderBy: { createdAt: "desc" }, take: 5 }),
        prisma.scanEvent.findMany({ where: { userId: actor.userId, kind: "SPARRING" }, orderBy: { createdAt: "desc" }, take: 5 }),
      ])
    : [[], []];

  return (
    <ScannerClient
      initialMode={mode === "sparring" ? "sparring" : "event"}
      checkin={intent === "checkin"}
      eventScans={eventScans.map(toRecord)}
      sparringScans={sparringScans.map(toRecord)}
    />
  );
}
