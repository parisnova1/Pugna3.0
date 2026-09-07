import Link from "next/link";
import { BellIcon } from "@/components/nav/icons";

export function BellLink({ unreadCount }: { unreadCount: number }) {
  return (
    <Link href="/you/notifications" aria-label="Notifications" className="relative rounded-full border border-white/15 p-2.5">
      <BellIcon />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-signal text-onsignal text-[10px] font-semibold flex items-center justify-center">
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
