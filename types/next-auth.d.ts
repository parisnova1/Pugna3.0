import type { Hat } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      hats: Hat[];
      activeHat: Hat | null;
      adminClubIds: string[];
      hostEventIds: string[];
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId?: string;
    hats?: Hat[];
    activeHat?: Hat | null;
    adminClubIds?: string[];
    hostEventIds?: string[];
  }
}
