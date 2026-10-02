import { redirect } from "next/navigation";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { markAllNotificationsRead } from "@/lib/actions/notifications-read";
import { BackButton } from "@/components/event/ContextBar";
import { EmptyState } from "@/components/ui/EmptyState";
import { NotificationItem } from "@/components/notifications/NotificationItem";

function timeAgo(date: Date): string {
  const ms = Date.now() - date.getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default async function NotificationsPage() {
  const actor = await getActor();
  if (!actor) redirect("/account?returnTo=/you/notifications");

  const notifications = await prisma.notification.findMany({
    where: { userId: actor.userId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-4 pt-2">
      <BackButton />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        {unreadCount > 0 && (
          <form action={markAllNotificationsRead}>
            <button type="submit" className="text-xs text-signal font-medium">
              Mark all read
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState centered>Nothing yet.</EmptyState>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationItem
              key={n.id}
              id={n.id}
              href={n.link ?? "/you/notifications"}
              read={n.read}
              message={n.message}
              ago={timeAgo(n.createdAt)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
