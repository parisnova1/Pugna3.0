export type EmailMessage = { to: string; subject: string; text: string };

/**
 * Origin used inside emailed links. Deliberately NEVER derived from the
 * request's Host header -- that would let an attacker request a reset for a
 * victim with a forged Host and get a link pointing at their own domain.
 */
export function appUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL;
  if (explicit) return explicit.replace(/\/$/, "");
  if (process.env.NODE_ENV !== "production") return "http://localhost:3000";
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return prod ? `https://${prod}` : "https://pugna3-0.vercel.app";
}

/** Real delivery needs a provider key AND a verified sender address. */
export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

type FetchLike = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<{ ok: boolean; status: number }>;

/**
 * Sends through Resend's HTTP API. With no provider configured nothing is
 * delivered: in development the message (including its link) is printed to
 * the server console so the flows can be exercised locally; in production
 * only a warning is logged -- the link is never written to production logs.
 */
export async function sendEmail(message: EmailMessage, fetchImpl: FetchLike = fetch as unknown as FetchLike): Promise<{ delivered: boolean }> {
  if (!isEmailConfigured()) {
    if (process.env.NODE_ENV === "production") {
      console.warn("[email] no provider configured (set RESEND_API_KEY and EMAIL_FROM); message not delivered");
    } else {
      console.info(`[email:dev] to=${message.to}\nsubject=${message.subject}\n${message.text}`);
    }
    return { delivered: false };
  }

  const response = await fetchImpl("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.EMAIL_FROM, to: [message.to], subject: message.subject, text: message.text }),
  });
  if (!response.ok) throw new Error(`Email provider responded ${response.status}`);
  return { delivered: true };
}

export function passwordResetEmail(to: string, link: string): EmailMessage {
  return {
    to,
    subject: "Reset your PUGNA password",
    text: `Someone asked to reset the password for this PUGNA account.\n\nReset it here (the link works once and expires in 30 minutes):\n${link}\n\nIf this wasn't you, ignore this email -- your password stays the same.`,
  };
}

export function verificationEmail(to: string, link: string): EmailMessage {
  return {
    to,
    subject: "Confirm your PUGNA email",
    text: `Welcome to PUGNA. Confirm this email address to unlock hosting events and managing clubs:\n${link}\n\nThe link works once and expires in 24 hours. If you didn't create an account, ignore this email.`,
  };
}
