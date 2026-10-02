import { prisma } from "@/lib/prisma";

/**
 * Ownership checks for ids that arrive from the client alongside the id the
 * caller was actually authorized for. Authorizing event A and then acting on
 * a bout/ring looked up by id alone would let a host of A touch event B.
 */

/** A weight group is only valid for the session it belongs to. */
export async function weightGroupInSession(weightGroupId: string, sessionId: string): Promise<boolean> {
  const group = await prisma.sparringWeightGroup.findFirst({ where: { id: weightGroupId, sessionId }, select: { id: true } });
  return group !== null;
}
