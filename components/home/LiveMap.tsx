"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

export type MapPoint = { id: string; lat: number; lng: number; label: string; href: string };

const pinIcon = L.divIcon({
  className: "",
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#e8453c;border:2px solid #F4F1EC;box-shadow:0 0 0 2px rgba(232,69,60,0.35)"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

/** Dark, on-brand live map of event/sparring pins — Leaflet + free OpenStreetMap tiles, no API key. */
export function LiveMap({ points }: { points: MapPoint[] }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const pointsRef = useRef(points);
  pointsRef.current = points;

  function fitAll() {
    const map = mapRef.current;
    const current = pointsRef.current;
    if (!map) return;
    if (current.length > 0) {
      map.fitBounds(L.latLngBounds(current.map((p) => [p.lat, p.lng])), { padding: [24, 24], maxZoom: 12 });
    } else {
      map.setView([39.8283, -98.5795], 3);
    }
  }

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    // zoomControl on so viewers can zoom out past the auto-fit level themselves.
    const map = L.map(containerRef.current, { zoomControl: true, attributionControl: true });
    mapRef.current = map;

    map.attributionControl.setPrefix(false);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    }).addTo(map);

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    const markers = points.map((p) =>
      L.marker([p.lat, p.lng], { icon: pinIcon })
        .addTo(map)
        .bindTooltip(p.label, { direction: "top", offset: [0, -6] })
        .on("click", () => {
          window.location.href = p.href;
        }),
    );

    fitAll();

    return () => {
      markers.forEach((m) => m.remove());
    };
  }, [points]);

  return (
    <div className="relative">
      <div ref={containerRef} className="pugna-map w-full h-72 rounded-card overflow-hidden border border-white/10 shadow-lg shadow-black/40" />
      <button
        onClick={fitAll}
        className="absolute top-2 right-2 z-[1000] rounded-pill bg-void/80 border border-white/20 text-ink text-xs font-medium px-3 py-1.5"
      >
        Fit all
      </button>
    </div>
  );
}
