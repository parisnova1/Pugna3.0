"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** Generic QR display sheet — used for event/sparring check-in QR codes shown at the door. */
export function QrCodeSheet({ path, label, buttonLabel }: { path: string; label: string; buttonLabel: string }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : "";

  useEffect(() => {
    if (!open) return;
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: "#F4F1EC", light: "#00000000" } }).then(setQr);
  }, [open, url]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="w-full rounded-pill border border-white/20 text-ink font-semibold py-3 text-sm"
      >
        {buttonLabel}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="glass relative w-full max-w-md rounded-t-card p-6 space-y-4">
            <h3 className="font-semibold">{label}</h3>
            {qr && (
              <div className="flex justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qr} alt="Check-in QR code" width={200} height={200} />
              </div>
            )}
            <p className="text-xs text-mute text-center">Fighters scan this at the door to check in.</p>
            <button
              onClick={() => setOpen(false)}
              className="w-full rounded-pill border border-white/20 text-ink font-semibold py-3"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
