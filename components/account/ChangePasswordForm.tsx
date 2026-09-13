"use client";

import { useActionState, useRef } from "react";
import { changePassword } from "@/lib/actions/profile";
import type { ActionResult } from "@/lib/actions/types";

const INPUT_CLASS = "w-full rounded-card bg-panel border border-white/10 px-4 py-3 text-ink placeholder:text-mute";

type State = ActionResult | { ok: "reset" } | null;

export function ChangePasswordForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState<State, FormData>(async (_prev, formData) => {
    const result = await changePassword(formData);
    if (result.ok) formRef.current?.reset();
    return result;
  }, null);

  return (
    <form ref={formRef} action={formAction} className="space-y-3">
      <input name="currentPassword" type="password" placeholder="Current password" required className={INPUT_CLASS} />
      <input name="newPassword" type="password" placeholder="New password (8+ characters)" required minLength={8} className={INPUT_CLASS} />
      <input name="confirmPassword" type="password" placeholder="Confirm new password" required minLength={8} className={INPUT_CLASS} />
      {state && !state.ok && <p className="text-signal text-sm">{state.reason}</p>}
      {state && state.ok && <p className="text-success text-sm">Password updated.</p>}
      <button
        type="submit"
        disabled={pending}
        className="w-full rounded-pill border border-white/20 text-ink font-semibold py-3 disabled:opacity-60"
      >
        {pending ? "…" : "Change password"}
      </button>
    </form>
  );
}
