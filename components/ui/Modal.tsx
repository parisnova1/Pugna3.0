"use client";

import { useEffect, useId } from "react";
import { Button } from "@/components/ui/Button";

/**
 * Bottom sheet used for every in-page dialog (share, QR, nominate, live
 * controls, crowd). Backdrop click and Escape close it. Render it
 * conditionally (`{open && <Modal ...>}`) so it only mounts while open.
 */
export function Modal({
  title,
  onClose,
  children,
  closeLabel = "Close",
  compactClose = false,
  scrollable = false,
}: {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  /** Label of the footer close button; `null` hides it (for flows with their own actions). */
  closeLabel?: string | null;
  /** Smaller footer button, for sheets that sit on dense control panels. */
  compactClose?: boolean;
  /** Cap the sheet height and scroll its content. */
  scrollable?: boolean;
}) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={`glass relative w-full max-w-md rounded-t-card p-6 space-y-4${scrollable ? " max-h-[70vh] overflow-y-auto" : ""}`}
      >
        <h3 id={titleId} className="font-semibold">
          {title}
        </h3>
        {children}
        {closeLabel !== null && (
          <Button
            variant="outline"
            size={compactClose ? "xs" : "md"}
            text={compactClose ? "sm" : undefined}
            fullWidth
            onClick={onClose}
          >
            {closeLabel}
          </Button>
        )}
      </div>
    </div>
  );
}
