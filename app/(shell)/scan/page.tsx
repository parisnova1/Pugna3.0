"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import jsQR from "jsqr";

function extractCode(text: string): string | null {
  try {
    const url = new URL(text);
    const match = url.pathname.match(/\/go\/([^/]+)/);
    if (match) return match[1] ?? null;
  } catch {
    // not a URL — treat raw text as the code itself
  }
  const trimmed = text.trim();
  return trimmed.length > 0 && trimmed.length < 64 ? trimmed : null;
}

export default function ScanPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const [denied, setDenied] = useState(false);
  const [manualMode, setManualMode] = useState(false);
  const [manualCode, setManualCode] = useState("");

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
            const code = extractCode(result.data);
            if (code) {
              router.push(`/go/${code}`);
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
  }, [manualMode, router]);

  if (denied || manualMode) {
    return (
      <div className="pt-6 space-y-6 text-center">
        <h1 className="text-xl font-semibold">Scan</h1>
        {denied && !manualMode && (
          <p className="text-mute text-sm">
            Camera access is blocked. Enable it in your browser settings, or enter the code instead.
          </p>
        )}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            if (manualCode.trim()) router.push(`/go/${encodeURIComponent(manualCode.trim())}`);
          }}
          className="space-y-3"
        >
          <input
            value={manualCode}
            onChange={(e) => setManualCode(e.target.value)}
            placeholder="Enter fight code"
            className="w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute text-center"
          />
          <button type="submit" className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3">
            Open
          </button>
        </form>
        {denied && (
          <button onClick={() => setDenied(false)} className="text-xs text-mute underline">
            Try camera again
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="pt-6 space-y-4">
      <h1 className="text-xl font-semibold text-center">Point at a fight QR code</h1>
      <div className="relative aspect-square rounded-card overflow-hidden bg-panel border border-white/10">
        <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
        <div className="absolute inset-8 rounded-card border-2 border-signal/70" />
      </div>
      <canvas ref={canvasRef} className="hidden" />
      <button onClick={() => setManualMode(true)} className="w-full text-center text-sm text-mute underline">
        Enter code instead
      </button>
    </div>
  );
}
