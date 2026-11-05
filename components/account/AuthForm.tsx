"use client";

import { useActionState, useId, useState } from "react";
import type { AuthActionResult } from "@/lib/actions/auth";
import { Button } from "@/components/ui/Button";
import { emailProblem, passwordProblem, PASSWORD_MIN_LENGTH } from "@/lib/validation";

type Action = (prev: AuthActionResult | null, formData: FormData) => Promise<AuthActionResult>;

export const AUTH_INPUT_CLASS = "w-full rounded-card bg-panel border border-white/10 px-4 py-3.5 text-ink placeholder:text-mute";
const INVALID_CLASS = "!border-error";

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
  const registering = Boolean(showName);
  const uid = useId();
  const nameId = `${uid}-name`;
  const emailId = `${uid}-email`;
  const passwordId = `${uid}-password`;
  const emailErrorId = `${uid}-email-error`;
  const passwordHintId = `${uid}-password-hint`;
  const passwordErrorId = `${uid}-password-error`;

  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  // Registering enforces the real rule; signing in only needs *something* typed.
  const checkPassword = (value: string) => (registering ? passwordProblem(value) : value ? null : "Enter your password.");

  return (
    <form
      action={formAction}
      noValidate
      className="space-y-4"
      onSubmit={(event) => {
        const form = event.currentTarget;
        const email = (form.elements.namedItem("email") as HTMLInputElement).value;
        const password = (form.elements.namedItem("password") as HTMLInputElement).value;
        const nextEmail = emailProblem(email);
        const nextPassword = checkPassword(password);
        setEmailError(nextEmail);
        setPasswordError(nextPassword);
        if (nextEmail || nextPassword) {
          event.preventDefault();
          (form.elements.namedItem(nextEmail ? "email" : "password") as HTMLInputElement).focus();
        }
      }}
    >
      <input type="hidden" name="returnTo" value={returnTo} />

      {registering && (
        <Field label="Name" optional htmlFor={nameId}>
          <input
            id={nameId}
            name="name"
            type="text"
            placeholder="Your name"
            autoComplete="name"
            maxLength={80}
            className={AUTH_INPUT_CLASS}
          />
        </Field>
      )}

      <Field label="Email" htmlFor={emailId} error={emailError} errorId={emailErrorId}>
        <input
          id={emailId}
          name="email"
          type="email"
          inputMode="email"
          autoComplete={registering ? "email" : "username"}
          autoCapitalize="none"
          spellCheck={false}
          placeholder="name@example.com"
          required
          aria-invalid={emailError ? true : undefined}
          aria-describedby={emailError ? emailErrorId : undefined}
          onBlur={(e) => setEmailError(e.target.value ? emailProblem(e.target.value) : null)}
          onChange={() => emailError && setEmailError(null)}
          className={`${AUTH_INPUT_CLASS} ${emailError ? INVALID_CLASS : ""}`}
        />
      </Field>

      <Field
        label="Password"
        htmlFor={passwordId}
        error={passwordError}
        errorId={passwordErrorId}
        hint={registering ? `At least ${PASSWORD_MIN_LENGTH} characters.` : undefined}
        hintId={passwordHintId}
      >
        <div className="relative">
          <input
            id={passwordId}
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete={registering ? "new-password" : "current-password"}
            placeholder={registering ? `${PASSWORD_MIN_LENGTH}+ characters` : "Password"}
            required
            aria-invalid={passwordError ? true : undefined}
            aria-describedby={passwordError ? passwordErrorId : registering ? passwordHintId : undefined}
            onBlur={(e) => registering && e.target.value && setPasswordError(passwordProblem(e.target.value))}
            onChange={() => passwordError && setPasswordError(null)}
            className={`${AUTH_INPUT_CLASS} pr-16 ${passwordError ? INVALID_CLASS : ""}`}
          />
          <button
            type="button"
            onClick={() => setShowPassword((v) => !v)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
            className="absolute inset-y-0 right-0 px-4 text-sm font-medium text-mute"
          >
            {showPassword ? "Hide" : "Show"}
          </button>
        </div>
      </Field>

      {state && !state.ok && (
        <p role="alert" className="text-error-ink text-sm">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending} aria-busy={pending} size="lg" fullWidth>
        {pending ? (registering ? "Creating account…" : "Signing in…") : submitLabel}
      </Button>
    </form>
  );
}

export function Field({
  label,
  optional,
  htmlFor,
  hint,
  hintId,
  error,
  errorId,
  children,
}: {
  label: string;
  optional?: boolean;
  /** Id of the control. When given, label and messages sit beside the control instead of wrapping it. */
  htmlFor?: string;
  hint?: string;
  hintId?: string;
  error?: string | null;
  errorId?: string;
  children: React.ReactNode;
}) {
  const labelText = (
    <span className="text-sm font-medium text-ink">
      {label}
      {optional && <span className="font-normal text-mute"> (optional)</span>}
    </span>
  );
  const message = error ? (
    <span id={errorId} role="alert" className="block text-sm text-error-ink">
      {error}
    </span>
  ) : (
    hint && (
      <span id={hintId} className="block text-xs text-mute">
        {hint}
      </span>
    )
  );

  // Explicit association keeps the control's accessible name to just the label text
  // (a wrapping <label> would also fold in a Show/Hide button and any error text).
  if (htmlFor) {
    return (
      <div className="space-y-1.5">
        <label htmlFor={htmlFor} className="block">
          {labelText}
        </label>
        {children}
        {message}
      </div>
    );
  }
  return (
    <label className="block space-y-1.5">
      {labelText}
      {children}
      {message}
    </label>
  );
}
