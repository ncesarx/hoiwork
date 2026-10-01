import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { MembershipRole } from "@prisma/client";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { getSelectedMembership } from "@/lib/organization/access";
import { verifyCredentialLogin } from "@/lib/organization/credential-login";
import { preferredOrganizationFromCookieHeader } from "@/lib/organization/login-context";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),

  session: {
    strategy: "jwt",
  },

  pages: {
    signIn: "/login",
  },

  providers: [
    Credentials({
      credentials: {
        email: {
          label: "E-mail",
          type: "email",
        },
        password: {
          label: "Senha",
          type: "password",
        },
      },

      async authorize(rawCredentials, request) {
        const parsed = credentialsSchema.safeParse(rawCredentials);

        if (!parsed.success) {
          return null;
        }

        const email = parsed.data.email.trim().toLowerCase();

        const user = await prisma.user.findUnique({
          where: {
            email,
          },
          include: {
            memberships: {
              where: { active: true, organization: { active: true } },
              include: {
                organization: true,
              },
              orderBy: {
                createdAt: "asc",
              },
              take: 1,
            },
          },
        });

        if (!user?.passwordHash || !user.active) {
          return null;
        }

        const verified = await verifyCredentialLogin(user.id, parsed.data.password);
        if (!verified) {
          return null;
        }

        const membership = user.memberships[0];
        if (!membership) return null;
        const preferredId = preferredOrganizationFromCookieHeader(request.headers.get("cookie"));
        const selected = await getSelectedMembership(user.id, preferredId, membership.organizationId);
        if (!selected) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: selected.role,
          organizationId: selected.organizationId,
          organizationName: selected.organization.name,
          sessionVersion: verified.sessionVersion,
        };
      },
    }),
  ],

  events: {
    async signIn({ user, account }) {
      if (account?.provider !== "credentials" || !user.id || !user.organizationId) return;
      await prisma.auditLog.create({ data: {
        organizationId: user.organizationId, userId: user.id,
        action: "ACCOUNT_SIGNED_IN", entity: "User", entityId: user.id,
      } });
    },
  },

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
        token.sessionVersion = user.sessionVersion;
      }

      return token;
    },

    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";

        session.user.role =
          typeof token.role === "string"
            ? (token.role as MembershipRole)
            : "CLIENT";

        session.user.organizationId =
          typeof token.organizationId === "string"
            ? token.organizationId
            : null;

        session.user.organizationName =
          typeof token.organizationName === "string"
            ? token.organizationName
            : null;

        // Existing JWTs predate this field; all users start at version zero.
        session.user.sessionVersion =
          typeof token.sessionVersion === "number" ? token.sessionVersion : 0;
      }

      return session;
    },
  },
});
