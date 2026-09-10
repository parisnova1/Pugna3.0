"use client";

import dynamic from "next/dynamic";
import type { MapPoint } from "@/components/home/LiveMap";

const LiveMap = dynamic(() => import("@/components/home/LiveMap").then((m) => m.LiveMap), { ssr: false });

export function SparringResultsMap({ points }: { points: MapPoint[] }) {
  return <LiveMap points={points} />;
}
