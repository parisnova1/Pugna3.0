"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { PREFS_COOKIE, cleanCity, cleanSports, serializePrefs } from "@/lib/prefs";

const ONE_YEAR_S = 60 * 60 * 24 * 365;

async function writePrefs(value: Parameters<typeof serializePrefs>[0]) {
  (await cookies()).set(PREFS_COOKIE, serializePrefs(value), {
    maxAge: ONE_YEAR_S,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    httpOnly: true,
  });
}

/** Only ever lands on a page of this app; anything else falls back to the events list. */
function safeReturn(formData: FormData): string {
  const to = String(formData.get("returnTo") ?? "");
  return to.startsWith("/") && !to.startsWith("//") && !to.includes("\\") ? to : "/events";
}

export async function savePrefs(formData: FormData): Promise<void> {
  await writePrefs({
    sports: cleanSports(formData.getAll("sport").map(String)),
    city: cleanCity(formData.get("city")),
    dismissed: true,
  });
  redirect(safeReturn(formData));
}

/** "No thanks": remember that the prompt was declined, with no preferences stored. */
export async function dismissPrefs(formData: FormData): Promise<void> {
  await writePrefs({ sports: [], city: "", dismissed: true });
  redirect(safeReturn(formData));
}

export async function clearPrefs(formData: FormData): Promise<void> {
  (await cookies()).delete(PREFS_COOKIE);
  redirect(safeReturn(formData));
}
