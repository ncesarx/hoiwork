import type { DefaultSession } from "next-auth";
import type { MembershipRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: MembershipRole;
    organizationId: string | null;
    organizationName: string | null;
    sessionVersion: number;
  }

  interface Session {
    user: {
      id: string;
      role: MembershipRole;
      organizationId: string | null;
      organizationName: string | null;
      sessionVersion: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: MembershipRole;
    organizationId: string | null;
    organizationName: string | null;
    sessionVersion: number;
  }
}

export {};
