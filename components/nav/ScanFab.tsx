"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScanIcon } from "@/components/nav/icons";

const STORAGE_KEY = "pugna-scan-fab-position";
const SIZE = 56;
const EDGE_MARGIN = 4;
const DRAG_THRESHOLD = 6;

type Point = { x: number; y: number };

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function defaultPosition(): Point {
  return {
    x: window.innerWidth / 2 - SIZE / 2,
    y: window.innerHeight - 96 - SIZE, // matches the old bottom-24 offset above the tab bar
  };
}

function clampToViewport(p: Point): Point {
  return {
    x: clamp(p.x, EDGE_MARGIN, window.innerWidth - SIZE - EDGE_MARGIN),
    y: clamp(p.y, EDGE_MARGIN, window.innerHeight - SIZE - EDGE_MARGIN),
  };
}

/**
 * Floating Scan button. A right-aligned fixed position used to sit close
 * enough to the rightmost "Profile" tab on some viewports that a tap meant
 * for Profile could land on Scan instead — this replaces that with an
 * explicit, draggable position: real Pointer Events (unifies mouse/touch),
 * a tap-vs-drag distinction by movement distance rather than relying on
 * native link click semantics, and a position the viewer can drag anywhere
 * on screen and have remembered (per-device, via localStorage) instead of
 * a fixed spot that might conflict with something else.
 */
export function ScanFab() {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const [position, setPosition] = useState<Point | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let initial: Point | null = null;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) initial = JSON.parse(saved) as Point;
    } catch {
      // ignore — private browsing / storage blocked
    }
    setPosition(clampToViewport(initial ?? defaultPosition()));
    setReady(true);
  }, []);

  function handlePointerDown(e: React.PointerEvent<HTMLButtonElement>) {
    if (!position) return;
    dragRef.current = { pointerId: e.pointerId, startX: e.clientX, startY: e.clientY, originX: position.x, originY: position.y, moved: false };
    buttonRef.current?.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    if (!drag.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
    drag.moved = true;
    setPosition(clampToViewport({ x: drag.originX + dx, y: drag.originY + dy }));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLButtonElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    buttonRef.current?.releasePointerCapture(e.pointerId);
    dragRef.current = null;

    if (drag.moved) {
      setPosition((current) => {
        if (current) {
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
          } catch {
            // ignore
          }
        }
        return current;
      });
    } else {
      router.push("/scan");
    }
  }

  // Server render and the very first client paint stay empty — avoids a
  // hydration mismatch, since the real position depends on window size and
  // localStorage, neither available on the server.
  if (!ready || !position) return null;

  return (
    <button
      ref={buttonRef}
      type="button"
      aria-label="Scan"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ position: "fixed", left: position.x, top: position.y, touchAction: "none" }}
      className="z-50 flex items-center justify-center w-14 h-14 rounded-full bg-signal text-onsignal shadow-lg shadow-black/40 cursor-grab active:cursor-grabbing select-none"
    >
      <ScanIcon className="shrink-0" />
    </button>
  );
}
