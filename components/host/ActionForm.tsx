"use client";

import { useActionState } from "react";
import type { ReactNode } from "react";
import type { ActionResult } from "@/lib/actions/types";

export function ActionForm({
  action,
  children,
  submitLabel,
  className,
  variant = "primary",
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  children: ReactNode;
  submitLabel: string;
  className?: string;
  variant?: "primary" | "secondary";
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    async (_prev, formData) => action(formData),
    null,
  );

  return (
    <form action={formAction} className={className}>
      {children}
      {state && !state.ok && <p className="text-signal text-sm mt-2">{state.reason}</p>}
      <button
        type="submit"
        disabled={pending}
        className={[
          "w-full rounded-pill font-semibold py-3 mt-3 disabled:opacity-60",
          variant === "primary" ? "bg-signal text-onsignal" : "border border-white/20 text-ink",
        ].join(" ")}
      >
        {pending ? "…" : submitLabel}
      </button>
    </form>
  );
}
