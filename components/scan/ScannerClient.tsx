"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";
import { logScanOpen } from "@/lib/actions/scanHistory";
import { formatRelativeTime } from "@/lib/format";

// Pugna QR codes always encode one of these path shapes — event, fighter,
// club, competitor check-in, audience check-in — regardless of which origin
// generated them (dev vs production), so match on path, not origin.
const KNOWN_PATH = /^\/(go\/[^/]+|in\/[^/]+|checkin\/event\/[^/]+|checkin\/sparring\/[^/]+|fighters\/[^/]+|clubs\/[^/]+|e\/[^/]+)/;

/** Resolves a scanned QR payload to the in-app path it should open. When
 * `checkin` is true (arrived via /scan?intent=checkin), raw text that isn't
 * already a known path is treated as a check-in code, not an entry code. */
function resolveScannedPath(text: string, checkin: boolean): string | null {
  try {
    const url = new URL(text);
    if (KNOWN_PATH.test(url.pathname)) return url.pathname + url.search;
  } catch {
    // not a URL — fall through to treating raw text as a code
  }
  const trimmed = text.trim();
  if (trimmed.length === 0 || trimmed.length >= 64) return null;
  return checkin ? `/in/${encodeURIComponent(trimmed)}` : `/go/${encodeURIComponent(trimmed)}`;
}

export type ScanRecord = { id: string; label: string; detail: string; href: string; createdAt: string };
type Mode = "event" | "sparring";

export function ScannerClient({
  initialMode,
  checkin,
  eventScans,
  sparringScans,
}: {
  initialMode: Mode;
  checkin: boolean;
  eventScans: ScanRecord[];
  sparringScans: ScanRecord[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(initialMode);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [denied, setDenied] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");

  function openPath(path: string) {
    void logScanOpen(path);
    router.push(path);
  }

  useEffect(() => {
    if (manualMode) return;
    let stream: MediaStream | null = null;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
          tick();
        }
      } catch {
        setDenied(true);
      }
    }

    function tick() {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const result = jsQR(imageData.data, imageData.width, imageData.height);
          if (result?.data) {
            const path = resolveScannedPath(result.data, checkin);
            if (path) {
              openPath(path);
              return;
            }
          }
        }
      }
      rafRef.current = requestAnimationFrame(tick);
    }

    start();

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      stream?.getTracks().forEach((t) => t.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manualMode, checkin]);

  if (denied || manualMode) {
    return (
      <div className="pt-6 space-y-6 text-center">
        <ModeToggle mode={mode} setMode={setMode} />
        <h1 className="text-xl font-semibold">Scan</h1>
        {denied && !manualMode && (
          <p className="text-mute text-sm">
            Camera access is blocked. Enable it in your browser settings, or enter the code instead.
          </p>
        )}
        {mode === "event" ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const path = resolveScannedPath(manualCode.trim(), checkin);
              if (path) openPath(path);
            }}
            className="space-y-3"
          >
            <input
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              placeholder={checkin ? "Enter check-in code" : "Enter fight code"}
              className="w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute text-center"
            />
            <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3">
              Open
            </button>
            <Link href="/events" className="block text-sm font-medium text-mute underline">
              Find an event
            </Link>
          </form>
        ) : (
          <Link href="/sparring" className="block w-full rounded-pill bg-signal text-onsignal font-semibold py-3">
            Browse sparring sessions
          </Link>
        )}
        {denied && (
          <button onClick={() => setDenied(false)} className="text-xs text-mute underline">
            Try camera again
          </button>
        )}
        <RecentScans mode={mode} eventScans={eventScans} sparringScans={sparringScans} />
      </div>
    );
  }

  return (
    <div className="pt-6 space-y-4">
      <ModeToggle mode={mode} setMode={setMode} />
      <div className="text-center space-y-1">
        <h1 className="text-xl font-semibold">
          {checkin ? "Point at the venue QR to check in" : mode === "event" ? "Scan event QR code" : "Scan sparring QR code"}
        </h1>
        <p className="text-sm text-mute">
          {mode === "event" ? "Check in, get event info or open the event page." : "Check in or join a sparring session."}
        </p>
      </div>
      <div className="relative aspect-square rounded-card overflow-hidden bg-panel border border-white/10">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-8 rounded-card border-2 border-signal/70" />
      </div>
      <canvas ref={canvasRef} className="hidden" />

      {mode === "event" ? (
        <button onClick={() => setManualMode(true)} className="w-full text-center text-sm font-medium text-mute underline">
          Open event manually
        </button>
      ) : (
        <Link href="/sparring" className="block w-full text-center text-sm font-medium text-mute underline">
          Open sparring manually
        </Link>
      )}

      <RecentScans mode={mode} eventScans={eventScans} sparringScans={sparringScans} />
    </div>
  );
}

function ModeToggle({ mode, setMode }: { mode: Mode; setMode: (m: Mode) => void }) {
  return (
    <div className="flex rounded-pill border border-white/15 p-1 gap-1 max-w-[280px] mx-auto">
      {(["event", "sparring"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => setMode(m)}
          className={[
            "flex-1 text-center rounded-pill py-2 text-sm font-semibold capitalize transition-colors",
            mode === m ? "bg-signal text-onsignal" : "text-mute",
          ].join(" ")}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

function RecentScans({ mode, eventScans, sparringScans }: { mode: Mode; eventScans: ScanRecord[]; sparringScans: ScanRecord[] }) {
  const items = mode === "event" ? eventScans : sparringScans;
  if (items.length === 0) return null;

  return (
    <div className="text-left space-y-2 pt-2">
      <p className="text-xs font-semibold text-mute uppercase tracking-wide">Recent scans</p>
      <div className="space-y-1">
        {items.map((item) => (
          <Link
            key={item.id}
            href={item.href}
            className="flex items-center justify-between gap-2 rounded-card bg-panel border border-white/10 px-4 py-3"
          >
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{item.label}</p>
              <p className="text-xs text-mute">{item.detail}</p>
            </div>
            <span className="text-xs text-mute shrink-0">{formatRelativeTime(new Date(item.createdAt))}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
