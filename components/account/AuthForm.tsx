"use client";

import { useActionState } from "react";
import type { AuthActionResult } from "@/lib/actions/auth";

type Action = (prev: AuthActionResult | null, formData: FormData) => Promise<AuthActionResult>;

export function AuthForm({
  action,
  returnTo,
  title,
  submitLabel,
  primary,
  showName,
}: {
  action: Action;
  returnTo: string;
  title: string;
  submitLabel: string;
  primary: boolean;
  showName?: boolean;
}) {
  const [state, formAction, pending] = useActionState<AuthActionResult | null, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-3">
      <input type="hidden" name="returnTo" value={returnTo} />
      <h2 className="text-sm font-semibold text-mute uppercase tracking-wide">{title}</h2>
      {showName && (
        <input
          name="name"
          type="text"
          placeholder="Name (optional)"
          className="w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute"
        />
      )}
      <input
        name="email"
        type="email"
        placeholder="Email"
        required
        className="w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute"
      />
      <input
        name="password"
        type="password"
        placeholder={showName ? "Password (8+ characters)" : "Password"}
        required
        minLength={showName ? 8 : undefined}
        className="w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute"
      />
      {state && !state.ok && <p className="text-signal text-sm">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className={[
          "w-full rounded-pill font-semibold py-3 disabled:opacity-60",
          primary ? "bg-signal text-onsignal" : "border border-white/20 text-ink",
        ].join(" ")}
      >
        {pending ? "…" : submitLabel}
      </button>
    </form>
  );
}
