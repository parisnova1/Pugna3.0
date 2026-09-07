import { redirect } from "next/navigation";
import Link from "next/link";
import { getActor } from "@/lib/actor";
import { prisma } from "@/lib/prisma";
import { markAllNotificationsRead } from "@/lib/actions/notifications-read";
import { BackButton } from "@/components/event/ContextBar";

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
        <p className="text-mute text-sm py-10 text-center">Nothing yet.</p>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <Link
              key={n.id}
              href={n.link ?? "/you/notifications"}
              className={[
                "block rounded-card border px-4 py-3",
                n.read ? "border-white/10 bg-panel" : "border-signal/30 bg-signal/5",
              ].join(" ")}
            >
              <p className="text-sm">{n.message}</p>
              <p className="text-xs text-mute mt-1">{timeAgo(n.createdAt)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
