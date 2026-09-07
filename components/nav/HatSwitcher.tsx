"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Hat } from "@prisma/client";
import { switchHat } from "@/lib/actions/hat";
import { grantHat } from "@/lib/actions/profile";

const ALL_HATS: { hat: Hat; label: string }[] = [
  { hat: "FIGHTER", label: "Fighter" },
  { hat: "CLUB", label: "Club" },
  { hat: "ORGANIZER", label: "Organizer" },
];

export function HatSwitcher({ hats, activeHat }: { hats: Hat[]; activeHat: Hat | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">Hats</h2>
      <div className="grid grid-cols-3 gap-2">
        {ALL_HATS.map(({ hat, label }) => {
          const granted = hats.includes(hat);
          const active = activeHat === hat;
          return (
            <button
              key={hat}
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  setError(null);
                  const result = granted ? await switchHat(hat) : await grantHat(hat);
                  if (!result.ok) setError(result.reason);
                  router.refresh();
                })
              }
              className={[
                "rounded-card border px-3 py-3 text-sm font-medium transition-colors",
                active ? "border-signal bg-signal/10 text-ink" : "border-white/10 text-mute",
              ].join(" ")}
            >
              {label}
              {!granted && <div className="text-[10px] text-mute mt-1">Add</div>}
            </button>
          );
        })}
      </div>
      {error && <p className="text-signal text-xs">{error}</p>}
    </div>
  );
}
