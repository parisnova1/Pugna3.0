"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { Button, buttonClass } from "@/components/ui/Button";
import { AUTH_INPUT_CLASS, Field } from "@/components/account/AuthForm";
import {
  requestPasswordReset,
  resendVerification,
  resetPassword,
  verifyEmail,
  type AuthActionResult,
} from "@/lib/actions/auth";

type State = AuthActionResult | null;

export function ForgotPasswordForm() {
  const [state, action, pending] = useActionState<State, FormData>(requestPasswordReset, null);

  if (state?.ok) return <p className="text-sm text-ink">{state.message}</p>;

  return (
    <form action={action} className="space-y-4">
      <Field label="Email">
        <input name="email" type="email" placeholder="name@example.com" required autoComplete="email" className={AUTH_INPUT_CLASS} />
      </Field>
      {state && !state.ok && <p className="text-signal text-sm">{state.error}</p>}
      <Button type="submit" disabled={pending} size="lg" fullWidth>
        {pending ? "…" : "Send reset link"}
      </Button>
    </form>
  );
}

export function ResetPasswordForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<State, FormData>(resetPassword, null);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink">{state.message}</p>
        <Link href="/account?mode=signin" className={buttonClass({ size: "lg", className: "block text-center" })}>
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <Field label="New password">
        <input
          name="password"
          type="password"
          placeholder="8+ characters"
          required
          minLength={8}
          autoComplete="new-password"
          className={AUTH_INPUT_CLASS}
        />
      </Field>
      <Field label="Confirm new password">
        <input name="confirm" type="password" required minLength={8} autoComplete="new-password" className={AUTH_INPUT_CLASS} />
      </Field>
      {state && !state.ok && (
        <p className="text-signal text-sm">
          {state.error}{" "}
          {state.error.includes("invalid or has expired") && (
            <Link href="/account/forgot" className="underline">
              Request a new link
            </Link>
          )}
        </p>
      )}
      <Button type="submit" disabled={pending} size="lg" fullWidth>
        {pending ? "…" : "Update password"}
      </Button>
    </form>
  );
}

/** Confirming is an explicit button press, not a side effect of opening the link, so mail scanners that prefetch URLs can't spend the token. */
export function VerifyEmailForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<State, FormData>(verifyEmail, null);

  if (state?.ok) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-ink">{state.message}</p>
        <Link href="/" className={buttonClass({ size: "lg", className: "block text-center" })}>
          Continue
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      {state && !state.ok && <p className="text-signal text-sm">{state.error}</p>}
      <Button type="submit" disabled={pending} size="lg" fullWidth>
        {pending ? "…" : "Confirm email"}
      </Button>
    </form>
  );
}

export function ResendVerificationButton() {
  const [result, setResult] = useState<State>(null);
  const [pending, start] = useTransition();

  return (
    <div className="space-y-3">
      {result && <p className={result.ok ? "text-sm text-ink" : "text-sm text-signal"}>{result.ok ? result.message : result.error}</p>}
      <Button
        size="lg"
        fullWidth
        disabled={pending}
        onClick={() => start(async () => setResult(await resendVerification()))}
      >
        {pending ? "…" : "Send a new confirmation email"}
      </Button>
    </div>
  );
}

export function VerifyEmailBanner() {
  const [result, setResult] = useState<State>(null);
  const [pending, start] = useTransition();

  return (
    <div className="mx-auto w-full max-w-md px-4 pt-3">
      <div className="flex items-center justify-between gap-3 rounded-card border border-white/10 bg-panel px-4 py-3 text-sm">
        <span className="text-mute">
          {result ? (result.ok ? result.message : result.error) : "Confirm your email to host events and manage clubs."}
        </span>
        <Button
          variant="outline"
          size="xxs"
          text="xs"
          className="shrink-0 px-3"
          disabled={pending}
          onClick={() => start(async () => setResult(await resendVerification()))}
        >
          Resend
        </Button>
      </div>
    </div>
  );
}
