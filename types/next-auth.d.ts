import type { DefaultSession } from "next-auth";
import type { EventRole, ClubRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isBoxer: boolean;
      clubIds: string[];
      isOrganizer: boolean;
      emailConfirmed: boolean;
      authAt?: number;
      hostEventIds: string[];
      hostRoles: Record<string, { role: EventRole; ringIds: string[] }>;
      clubRoles: Record<string, ClubRole>;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    isBoxer?: boolean;
    clubIds?: string[];
    isOrganizer?: boolean;
    emailConfirmed?: boolean;
    /** ms epoch of sign-in; sessions older than User.passwordChangedAt are revoked. */
    authAt?: number;
    hostEventIds?: string[];
    hostRoles?: Record<string, { role: EventRole; ringIds: string[] }>;
    clubRoles?: Record<string, ClubRole>;
  }
}
