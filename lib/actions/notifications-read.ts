"use server";

import { prisma } from "@/lib/prisma";
import { getActor } from "@/lib/actor";
import { revalidatePath } from "next/cache";

export async function markNotificationRead(notificationId: string) {
  const actor = await getActor();
  if (!actor) return;

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification || notification.userId !== actor.userId) return;

  await prisma.notification.update({ where: { id: notificationId }, data: { read: true } });
  revalidatePath("/you/notifications");
}

export async function markAllNotificationsRead() {
  const actor = await getActor();
  if (!actor) return;

  await prisma.notification.updateMany({ where: { userId: actor.userId, read: false }, data: { read: true } });
  revalidatePath("/you/notifications");
}
