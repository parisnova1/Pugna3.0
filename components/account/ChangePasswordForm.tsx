"use client";

import { useActionState, useRef } from "react";
import { changePassword } from "@/lib/actions/profile";
import type { ActionResult } from "@/lib/actions/types";
import { Button } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/inputClass";

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
      <input name="currentPassword" type="password" placeholder="Current password" required className={inputClass} />
      <input name="newPassword" type="password" placeholder="New password (8+ characters)" required minLength={8} className={inputClass} />
      <input name="confirmPassword" type="password" placeholder="Confirm new password" required minLength={8} className={inputClass} />
      {state && !state.ok && <p className="text-signal text-sm">{state.reason}</p>}
      {state && state.ok && <p className="text-success text-sm">Password updated.</p>}
      <Button
        type="submit"
        disabled={pending}
        variant="outline" fullWidth
      >
        {pending ? "…" : "Change password"}
      </Button>
    </form>
  );
}
