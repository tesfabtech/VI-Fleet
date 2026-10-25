
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { prisma } from "@/lib/prisma";

export const { handlers, auth, signIn, signOut } = NextAuth({
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
          label: "Email",
          type: "email",
        },
        password: {
          label: "Password",
          type: "password",
        },
      },

      async authorize(credentials) {
        const email =
          typeof credentials?.email === "string"
            ? credentials.email.trim().toLowerCase()
            : "";

        const password =
          typeof credentials?.password === "string"
            ? credentials.password
            : "";

        if (!email || !password) {
          return null;
        }

        const user = await prisma.user.findFirst({
          where: {
            email,
            deletedAt: null,
          },
        });

        if (
          !user ||
          !user.passwordHash ||
          user.status !== "ACTIVE"
        ) {
          return null;
        }

        const passwordMatches = await bcrypt.compare(
          password,
          user.passwordHash,
        );

        if (!passwordMatches) {
          return null;
        }

        return {
  id: user.id,
  name: [user.firstName, user.middleName, user.lastName].join(" "),
  email: user.email,
  role: user.role,
  organizationId: user.organizationId,
  departmentId: user.departmentId,
};
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.organizationId = user.organizationId;
        token.departmentId = user.departmentId;
      }

      return token;
    },

    async session({ session, token }) {
  if (
    session.user &&
    token.sub &&
    token.role &&
    token.organizationId !== undefined &&
    token.departmentId !== undefined
  ) {
    session.user.id = token.sub;
    session.user.role = token.role;
    session.user.organizationId = token.organizationId;
    session.user.departmentId = token.departmentId;
  }

  return session;
},
  },
});
