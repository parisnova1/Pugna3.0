export const WAITLIST_ROLES = ["FAN", "COACH", "FIGHTER", "ORGANIZER"] as const;
export type WaitlistRoleValue = (typeof WAITLIST_ROLES)[number];

export type WaitlistLocale = "en" | "de";

export type WaitlistInput = {
  email: string;
  name: string | null;
  role: WaitlistRoleValue;
  clubName: string | null;
  city: string | null;
  newsletter: boolean;
  source: string;
  locale: WaitlistLocale;
};

export type WaitlistParse = { ok: true; value: WaitlistInput } | { ok: false; field: "email" | "consent" | "form" };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SOURCE_RE = /^[a-z0-9-]{1,80}$/;

const clean = (value: FormDataEntryValue | null, max: number): string | null => {
  const text = String(value ?? "").trim().replace(/\s+/g, " ");
  return text ? text.slice(0, max) : null;
};

/** Validates and normalises the public signup form. Pure, so it is unit-tested. */
export function parseWaitlistForm(formData: FormData): WaitlistParse {
  // Honeypot: a field no person sees or fills. Bots that do get a silent pass upstream.
  if (String(formData.get("website") ?? "").trim() !== "") return { ok: false, field: "form" };

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (email.length > 254 || !EMAIL_RE.test(email)) return { ok: false, field: "email" };
  if (formData.get("consent") !== "on") return { ok: false, field: "consent" };

  const roleRaw = String(formData.get("role") ?? "FAN").toUpperCase();
  const role = (WAITLIST_ROLES as readonly string[]).includes(roleRaw) ? (roleRaw as WaitlistRoleValue) : "FAN";
  const sourceRaw = String(formData.get("from") ?? "").trim().toLowerCase();

  return {
    ok: true,
    value: {
      email,
      name: clean(formData.get("name"), 100),
      role,
      clubName: clean(formData.get("clubName"), 120),
      city: clean(formData.get("city"), 80),
      newsletter: formData.get("newsletter") === "on",
      source: SOURCE_RE.test(sourceRaw) ? sourceRaw : "site",
      locale: formData.get("locale") === "de" ? "de" : "en",
    },
  };
}

export function waitlistLocale(lang: string | undefined, acceptLanguage: string | null): WaitlistLocale {
  if (lang === "de" || lang === "en") return lang;
  return (acceptLanguage ?? "").trim().toLowerCase().startsWith("de") ? "de" : "en";
}
