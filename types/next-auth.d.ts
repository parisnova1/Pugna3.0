import type { DefaultSession } from "next-auth";
import type { EventRole, ClubRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isBoxer: boolean;
      clubIds: string[];
      isOrganizer: boolean;
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
    hostEventIds?: string[];
    hostRoles?: Record<string, { role: EventRole; ringIds: string[] }>;
    clubRoles?: Record<string, ClubRole>;
  }
}
