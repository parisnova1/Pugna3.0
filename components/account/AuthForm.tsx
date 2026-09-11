"use client";

import { useActionState } from "react";
import type { AuthActionResult } from "@/lib/actions/auth";

type Action = (prev: AuthActionResult | null, formData: FormData) => Promise<AuthActionResult>;

const INPUT_CLASS = "w-full rounded-card bg-panel border border-white/10 px-4 py-3.5 text-ink placeholder:text-mute";

export function AuthForm({
  action,
  returnTo,
  submitLabel,
  showName,
}: {
  action: Action;
  returnTo: string;
  submitLabel: string;
  showName?: boolean;
}) {
  const [state, formAction, pending] = useActionState<AuthActionResult | null, FormData>(action, null);

  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="returnTo" value={returnTo} />
      {showName && (
        <Field label="Name">
          <input name="name" type="text" placeholder="Your name (optional)" className={INPUT_CLASS} />
        </Field>
      )}
      <Field label="Email">
        <input name="email" type="email" placeholder="name@example.com" required className={INPUT_CLASS} />
      </Field>
      <Field label="Password">
        <input
          name="password"
          type="password"
          placeholder={showName ? "8+ characters" : "Password"}
          required
          minLength={showName ? 8 : undefined}
          className={INPUT_CLASS}
        />
      </Field>
      {state && !state.ok && <p className="text-signal text-sm">{state.error}</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-pill bg-signal text-onsignal font-semibold py-3.5 disabled:opacity-60"
      >
        {pending ? "…" : submitLabel}
      </button>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}
