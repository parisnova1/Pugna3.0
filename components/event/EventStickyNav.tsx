import { BackButton } from "@/components/event/ContextBar";
import { Badge } from "@/components/ui/Badge";
import { EventTabs, type EventTab } from "@/components/event/EventTabs";

/**
 * The event page's one persistent nav element. It looks "big" only because
 * nothing sits above it while the hero (cover image, title, Follow row) is
 * still in view — once that scrolls past, `sticky` pins this exact same
 * element at the top, compact by construction rather than via a separate JS
 * "compact mode." Replaces the old inline back+wordmark row so there's never
 * a second back button once this becomes sticky.
 */
export function EventStickyNav({
  eventName,
  isLive,
  fallbackHref,
  tabs,
}: {
  eventName: string;
  isLive: boolean;
  fallbackHref: string;
  tabs: EventTab[];
}) {
  return (
    <div className="sticky top-0 z-30 glass -mx-4 px-4 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <BackButton fallbackHref={fallbackHref} />
        <div className="flex items-center gap-1.5 min-w-0 flex-1 justify-end">
          <span className="text-sm font-semibold text-ink truncate">{eventName}</span>
          {isLive && (
            <Badge live tone="live">
              LIVE
            </Badge>
          )}
        </div>
      </div>
      <EventTabs tabs={tabs} />
    </div>
  );
}
