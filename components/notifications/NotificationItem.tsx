"use client";

import Link from "next/link";
import { markNotificationRead } from "@/lib/actions/notifications-read";

/** One inbox row. Opening it marks just that notification read, so the unread badge reflects what you've actually seen. */
export function NotificationItem({
  id,
  href,
  read,
  message,
  ago,
}: {
  id: string;
  href: string;
  read: boolean;
  message: string;
  ago: string;
}) {
  return (
    <Link
      href={href}
      onClick={() => {
        if (!read) void markNotificationRead(id);
      }}
      className={[
        "block rounded-card border px-4 py-3",
        read ? "border-white/10 bg-panel" : "border-signal/30 bg-signal/5",
      ].join(" ")}
    >
      <p className="text-sm">{message}</p>
      <p className="text-xs text-mute mt-1">{ago}</p>
    </Link>
  );
}
