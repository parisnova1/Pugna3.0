import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "@/lib/prisma";
import type { EventRole, ClubRole } from "@prisma/client";
import { clientIp } from "@/lib/security/client-ip";
import { POLICIES, loginChecks } from "@/lib/security/policies";
import { clearRateLimit, rateLimit } from "@/lib/security/rate-limit-db";
import { isSessionRevoked } from "@/lib/security/session";
import { DUMMY_HASH, hashPassword, needsRehash, normalizeEmail, verifyPassword } from "@/lib/security/password";

const EMPTY_HOST_ROLES: Record<string, { role: EventRole; ringIds: string[] }> = {};
const EMPTY_CLUB_ROLES: Record<string, ClubRole> = {};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: { signIn: "/account" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // The one choke point every password sign-in passes through -- the server
      // action AND a direct POST to /api/auth/callback/credentials -- so the
      // rate limit lives here, where it can't be bypassed by skipping the UI.
      authorize: async (credentials, request) => {
        const email = normalizeEmail(credentials?.email);
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password || password.length > 1024) return null;

        const ip = clientIp(request?.headers ?? new Headers());
        const limit = await rateLimit(loginChecks(email, ip));
        if (!limit.ok) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        // Always burn one bcrypt comparison, even for an unknown email, so
        // response time doesn't reveal which addresses are registered.
        const valid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);
        if (!user || !valid) return null;

        await clearRateLimit({ policy: POLICIES.loginIdentity, subject: `${email}|${ip}` });
        if (needsRehash(user.passwordHash)) {
          await prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } });
        }

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    // Runs on every server-side session read (not just sign-in), so this
    // always re-derives capabilities from the DB rather than freezing them at
    // login. Capabilities are existence-based (Boxer profile / club admin
    // rows / Organizer profile) — never a stored "active role".
    async jwt({ token, user }) {
      const userId = user?.id ?? (token.userId as string | undefined);
      if (!userId) return token;

      if (user) token.authAt = Date.now();
      token.userId = userId;
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { fighterProfile: true, organizerProfile: true, clubAdminships: true, hostEvents: true },
      });

      // Returning null ends the session. Do it when the account no longer
      // exists, or when its password changed after this session began (a reset
      // or change must kick out whoever else is signed in with the old one).
      if (!dbUser) return null;
      const authAt = token.authAt as number | undefined;
      if (isSessionRevoked({ authAt, passwordChangedAt: dbUser.passwordChangedAt, trustedSessionAt: dbUser.trustedSessionAt })) return null;

      token.authAt = authAt;
      token.isBoxer = Boolean(dbUser.fighterProfile);
      token.isOrganizer = Boolean(dbUser.organizerProfile);
      token.emailConfirmed = Boolean(dbUser.emailVerifiedAt);
      token.clubIds = dbUser.clubAdminships.map((a) => a.clubId);
      token.hostEventIds = dbUser.hostEvents.map((h) => h.eventId);
      token.hostRoles = Object.fromEntries(
        dbUser.hostEvents.map((h) => [h.eventId, { role: h.role, ringIds: h.ringIds }]),
      );
      token.clubRoles = Object.fromEntries(dbUser.clubAdminships.map((a) => [a.clubId, a.role]));
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.isBoxer = Boolean(token.isBoxer);
        session.user.isOrganizer = Boolean(token.isOrganizer);
        session.user.emailConfirmed = Boolean(token.emailConfirmed);
        session.user.authAt = token.authAt as number | undefined;
        session.user.clubIds = (token.clubIds as string[]) ?? [];
        session.user.hostEventIds = (token.hostEventIds as string[]) ?? [];
        session.user.hostRoles = (token.hostRoles ?? EMPTY_HOST_ROLES) as Record<string, { role: EventRole; ringIds: string[] }>;
        session.user.clubRoles = (token.clubRoles ?? EMPTY_CLUB_ROLES) as Record<string, ClubRole>;
      }
      return session;
    },
  },
});
