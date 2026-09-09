"use client";

import { useState } from "react";

export function Stepper({ name, label, defaultValue, min = 1 }: { name: string; label: string; defaultValue: number; min?: number }) {
  const [value, setValue] = useState(defaultValue);

  return (
    <div>
      <label className="text-xs text-mute">{label}</label>
      <div className="flex items-center gap-3 mt-1">
        <button
          type="button"
          onClick={() => setValue((v) => Math.max(min, v - 1))}
          className="w-10 h-10 rounded-card bg-panel border border-white/10 text-lg font-semibold"
          aria-label={`Decrease ${label}`}
        >
          −
        </button>
        <span className="flex-1 text-center text-lg font-semibold">{value}</span>
        <button
          type="button"
          onClick={() => setValue((v) => v + 1)}
          className="w-10 h-10 rounded-card bg-panel border border-white/10 text-lg font-semibold"
          aria-label={`Increase ${label}`}
        >
          +
        </button>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
