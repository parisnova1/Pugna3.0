"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signIn as nextAuthSignIn } from "@/lib/auth";
import { sanitizeReturnTo } from "@/lib/rbac";
import { AuthError } from "next-auth";

export type AuthActionResult = { ok: true } | { ok: false; error: string };

export async function registerAction(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const name = String(formData.get("name") ?? "").trim() || null;
  const returnTo = sanitizeReturnTo(String(formData.get("returnTo") ?? ""));

  if (!email || !password || password.length < 8) {
    return { ok: false, error: "Email and an 8+ character password are required." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { ok: false, error: "An account with that email already exists." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({ data: { email, passwordHash, name } });

  return credentialsSignIn(email, password, returnTo);
}

export async function signInAction(_prev: AuthActionResult | null, formData: FormData): Promise<AuthActionResult> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const returnTo = sanitizeReturnTo(String(formData.get("returnTo") ?? ""));
  return credentialsSignIn(email, password, returnTo);
}

async function credentialsSignIn(email: string, password: string, returnTo: string): Promise<AuthActionResult> {
  try {
    await nextAuthSignIn("credentials", { email, password, redirectTo: returnTo });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { ok: false, error: "Invalid email or password." };
    }
    // NextAuth throws a NEXT_REDIRECT "error" on success — rethrow so Next.js can navigate.
    throw error;
  }
}
