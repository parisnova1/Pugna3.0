"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { joinWaitlist, type WaitlistState } from "@/lib/actions/waitlist";
import { WAITLIST_COPY } from "@/lib/waitlist-copy";
import { WAITLIST_ROLES, type WaitlistLocale, type WaitlistRoleValue } from "@/lib/waitlist";
import { Button, buttonClass } from "@/components/ui/Button";
import { inputClass } from "@/components/ui/inputClass";

export function WaitlistForm({
  locale,
  from,
  eventHref,
  defaultRole,
}: {
  locale: WaitlistLocale;
  from: string | null;
  eventHref: string | null;
  defaultRole: WaitlistRoleValue;
}) {
  const t = WAITLIST_COPY[locale];
  const [state, formAction, pending] = useActionState<WaitlistState | null, FormData>(joinWaitlist, null);
  const [role, setRole] = useState<WaitlistRoleValue>(defaultRole);

  if (state?.status === "ok") {
    return (
      <div className="rounded-card bg-panel border border-success/40 p-5" role="status">
        <p className="text-lg font-semibold">{t.doneTitle}</p>
        <p className="text-sm text-mute mt-1">{t.doneBody}</p>
        <Link
          href={eventHref ?? "/events"}
          className={buttonClass({ size: "sm", text: "sm", className: "mt-4 inline-block px-5" })}
        >
          {eventHref ? t.backToEvent : t.openApp}
        </Link>
      </div>
    );
  }

  const error = state?.status === "error" ? t.errors[state.field] : null;
  const showClub = role === "COACH" || role === "FIGHTER" || role === "ORGANIZER";

  return (
    <form action={formAction} className="rounded-card bg-panel border border-white/10 p-5 space-y-4">
      <p className="text-lg font-semibold">{t.formTitle}</p>
      <input type="hidden" name="locale" value={locale} />
      <input type="hidden" name="role" value={role} />
      {from && <input type="hidden" name="from" value={from} />}
      {/* Honeypot: hidden from people and assistive tech, tempting to bots. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-0 w-0 overflow-hidden">
        <label htmlFor="waitlist-website">Website</label>
        <input id="waitlist-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      <fieldset>
        <legend className="text-xs font-semibold text-mute uppercase tracking-wide">{t.roleLabel}</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {WAITLIST_ROLES.map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={role === value}
              onClick={() => setRole(value)}
              className={`rounded-pill px-4 py-2 text-sm font-medium border ${
                role === value ? "bg-signal text-onsignal border-signal" : "border-white/20 text-ink"
              }`}
            >
              {t.roles[value]}
            </button>
          ))}
        </div>
      </fieldset>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-mute uppercase tracking-wide">{t.email}</span>
        <input
          id="waitlist-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          placeholder="name@example.com"
          className={inputClass}
        />
      </label>

      <label className="block space-y-1.5">
        <span className="text-xs font-semibold text-mute uppercase tracking-wide">{t.name}</span>
        <input id="waitlist-name" name="name" type="text" autoComplete="name" maxLength={100} placeholder={t.namePlaceholder} className={inputClass} />
      </label>

      {showClub && (
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-mute uppercase tracking-wide">{t.club}</span>
            <input id="waitlist-club" name="clubName" type="text" maxLength={120} placeholder={t.clubPlaceholder} className={inputClass} />
          </label>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold text-mute uppercase tracking-wide">{t.city}</span>
            <input id="waitlist-city" name="city" type="text" maxLength={80} placeholder={t.cityPlaceholder} className={inputClass} />
          </label>
        </div>
      )}

      <label className="flex items-start gap-3 text-sm">
        <input id="waitlist-newsletter" name="newsletter" type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--signal)]" />
        <span>{t.newsletter}</span>
      </label>

      <label className="flex items-start gap-3 text-sm">
        <input id="waitlist-consent" name="consent" type="checkbox" required className="mt-0.5 h-5 w-5 shrink-0 accent-[var(--signal)]" />
        <span className="text-mute">{t.consent}</span>
      </label>

      {error && (
        <p role="alert" className="text-sm text-error-ink">
          {error}
        </p>
      )}

      <Button type="submit" size="lg" fullWidth disabled={pending}>
        {pending ? t.submitting : t.submit}
      </Button>
    </form>
  );
}
