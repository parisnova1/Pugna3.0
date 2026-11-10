"use server";

import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { clientIp } from "@/lib/security/client-ip";
import { POLICIES } from "@/lib/security/policies";
import { rateLimit } from "@/lib/security/rate-limit-db";
import { parseWaitlistForm } from "@/lib/waitlist";

export type WaitlistState = { status: "ok" } | { status: "error"; field: "email" | "consent" | "form" | "rate" };

/**
 * Public pre-launch signup. Answers "ok" whether or not the address was
 * already on the list, so the form can't be used to check who signed up.
 * A repeat signup refreshes the person's details; a newsletter opt-in is
 * never silently removed by signing up again without the box ticked.
 */
export async function joinWaitlist(_prev: WaitlistState | null, formData: FormData): Promise<WaitlistState> {
  const parsed = parseWaitlistForm(formData);
  if (!parsed.ok) {
    // A filled honeypot looks like success to the bot and stores nothing.
    return parsed.field === "form" ? { status: "ok" } : { status: "error", field: parsed.field };
  }
  const input = parsed.value;

  const limit = await rateLimit([
    { policy: POLICIES.waitlistIp, subject: clientIp(await headers()) },
    { policy: POLICIES.waitlistEmail, subject: input.email },
  ]);
  if (!limit.ok) return { status: "error", field: "rate" };

  try {
    await prisma.waitlistSignup.upsert({
      where: { email: input.email },
      create: { ...input, consentAt: new Date() },
      update: {
        role: input.role,
        locale: input.locale,
        ...(input.name ? { name: input.name } : {}),
        ...(input.clubName ? { clubName: input.clubName } : {}),
        ...(input.city ? { city: input.city } : {}),
        ...(input.newsletter ? { newsletter: true, consentAt: new Date() } : {}),
      },
    });
  } catch (error) {
    console.error("[waitlist] signup failed", error);
    return { status: "error", field: "form" };
  }

  return { status: "ok" };
}
