import { prisma } from "@/lib/prisma";

export type ScanKind = "EVENT" | "SPARRING";

/**
 * Records one row of Scan-hub history for `userId`. A plain server helper, not
 * an action: it trusts the caller's userId, so it must never be remotely callable.
 * Only called after a scan or check-in actually succeeded.
 */
export async function logScan(params: { userId: string; kind: ScanKind; label: string; detail: string; href: string }): Promise<void> {
  await prisma.scanEvent.create({ data: params });
}
