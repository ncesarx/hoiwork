import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import type { MembershipRole } from "@prisma/client";
import { compare } from "bcryptjs";
import { z } from "zod";

import { prisma } from "@/lib/prisma";

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

      async authorize(rawCredentials) {
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

        const passwordIsValid = await compare(
          parsed.data.password,
          user.passwordHash,
        );

        if (!passwordIsValid) {
          return null;
        }

        const membership = user.memberships[0];

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: membership?.role ?? "CLIENT",
          organizationId: membership?.organizationId ?? null,
          organizationName: membership?.organization.name ?? null,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.organizationName = user.organizationName;
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
      }

      return session;
    },
  },
});
