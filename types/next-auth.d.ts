import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      isBoxer: boolean;
      clubIds: string[];
      isOrganizer: boolean;
      hostEventIds: string[];
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
  }
}
