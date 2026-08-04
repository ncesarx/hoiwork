import type { DefaultSession } from "next-auth";
import type { MembershipRole } from "@prisma/client";

declare module "next-auth" {
  interface User {
    role: MembershipRole;
    organizationId: string | null;
    organizationName: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: MembershipRole;
      organizationId: string | null;
      organizationName: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: MembershipRole;
    organizationId: string | null;
    organizationName: string | null;
  }
}

export {};
