import type { NotificationType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Event-driven notifications only — blueprint §9. Called from inside the
 * mutating server actions themselves (nomination, publish, live console),
 * never from a client. Fire-and-forget: a notification failure should never
 * fail the underlying mutation, so callers don't need to await error-handle
 * this beyond letting it throw if the DB write itself fails.
 */
export async function notify(userId: string, type: NotificationType, message: string, link?: string) {
  await prisma.notification.create({ data: { userId, type, message, link } });
}

export async function notifyMany(userIds: string[], type: NotificationType, message: string, link?: string) {
  const unique = [...new Set(userIds)];
  if (unique.length === 0) return;
  await prisma.notification.createMany({
    data: unique.map((userId) => ({ userId, type, message, link })),
  });
}
