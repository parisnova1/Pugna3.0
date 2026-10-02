"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { THEME } from "@/lib/theme";
import { Modal } from "@/components/ui/Modal";
import { Button } from "@/components/ui/Button";

/** Generic QR display sheet — used for event/sparring check-in QR codes shown at the door. */
export function QrCodeSheet({
  path,
  label,
  buttonLabel,
  caption = "Fighters scan this at the door to check in.",
}: {
  path: string;
  label: string;
  buttonLabel: string;
  caption?: string;
}) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : "";

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: THEME.ink, light: "#00000000" } }).then(setQr);
  }, [open, url]);

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        variant="outline" text="sm" fullWidth
      >
        {buttonLabel}
      </Button>

      {open && (
        <Modal title={label} onClose={() => setOpen(false)}>
          {qr && (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Check-in QR code" width={200} height={200} />
            </div>
          )}
          <p className="text-xs text-mute text-center">{caption}</p>
        </Modal>
      )}
    </>
  );
}
