"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { THEME } from "@/lib/theme";
import { Modal } from "@/components/ui/Modal";

export function ShareSheet({ code, name }: { code: string | null; name: string }) {
  const [open, setOpen] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const dialogUrl = typeof window !== "undefined" && code ? `${window.location.origin}/go/${code}` : "";
  const canvasRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open || !code) return;
    const url = `${window.location.origin}/go/${code}`;
    QRCode.toDataURL(url, { margin: 1, width: 240, color: { dark: THEME.ink, light: "#00000000" } }).then(setQr);
  }, [open, code]);

  if (!code) return null;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Share"
        className="rounded-full border border-white/15 p-2.5"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <path d="M8.6 10.5l6.8-3.9M8.6 13.5l6.8 3.9" />
        </svg>
      </button>

      {open && (
        <Modal title={`Share ${name}`} onClose={() => setOpen(false)}>
          {qr && (
            <div ref={canvasRef} className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="Event QR code" width={200} height={200} />
            </div>
          )}
          <div className="flex items-center gap-2 rounded-card bg-panel border border-white/10 px-3 py-2">
            <span className="text-xs text-mute truncate flex-1">{dialogUrl}</span>
            <button
              onClick={async () => {
                await navigator.clipboard.writeText(dialogUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 1500);
              }}
              className="text-xs font-semibold text-signal shrink-0"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </Modal>
      )}
    </>
  );
}
