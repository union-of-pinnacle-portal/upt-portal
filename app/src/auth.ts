import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";

import { findUserByEmail, createUser } from "@/lib/user-store";

/**
 * Auth config for the UPT portal.
 *
 * Supports:
 *  - Google OAuth — auto-creates a "general" account on first sign-in
 *  - Email/password — user registers via /register, logs in via /login
 *
 * Role is stored in the JWT so it's available everywhere without a
 * DB lookup on every request.
 *
 * NOTE: user-store.ts is currently in-memory.
 * When DynamoDB is ready, only that file needs to change.
 */
export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google,
    Credentials({
      name: "Email and Password",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email as string | undefined;
        const password = credentials?.password as string | undefined;

        if (!email || !password) return null;

        const user = findUserByEmail(email);
        if (!user || !user.passwordHash) return null;

        const passwordMatch = await bcrypt.compare(password, user.passwordHash);
        if (!passwordMatch) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],

  pages: {
    signIn: "/login",
  },

  callbacks: {
    // Auto-create account for first-time Google sign-ins
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existing = findUserByEmail(user.email);
        if (!existing) {
          createUser({
            name: user.name ?? user.email,
            email: user.email,
            passwordHash: null,
          });
        }
      }
      return true;
    },

    // Add role to JWT on sign-in
    async jwt({ token }) {
      if (token.email) {
        const user = findUserByEmail(token.email as string);
        token.role = user?.role ?? "general";
      }
      return token;
    },

    // Expose role on session so components can read it
    async session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
      }
      return session;
    },
  },
});
