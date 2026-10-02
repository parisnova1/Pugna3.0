import { prisma } from "@/lib/prisma";

/** The "N new" badge count. One definition, used by every screen that shows the bell. */
export function getUnreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, read: false } });
}
