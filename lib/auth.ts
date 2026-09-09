import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

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
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;
        if (!email || !password) return null;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

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

      token.userId = userId;
      const dbUser = await prisma.user.findUnique({
        where: { id: userId },
        include: { fighterProfile: true, organizerProfile: true, clubAdminships: true, hostEvents: true },
      });
      if (dbUser) {
        token.isBoxer = Boolean(dbUser.fighterProfile);
        token.isOrganizer = Boolean(dbUser.organizerProfile);
        token.clubIds = dbUser.clubAdminships.map((a) => a.clubId);
        token.hostEventIds = dbUser.hostEvents.map((h) => h.eventId);
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.userId as string;
        session.user.isBoxer = Boolean(token.isBoxer);
        session.user.isOrganizer = Boolean(token.isOrganizer);
        session.user.clubIds = (token.clubIds as string[]) ?? [];
        session.user.hostEventIds = (token.hostEventIds as string[]) ?? [];
      }
      return session;
    },
  },
});
