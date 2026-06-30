import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";

/**
 * Central auth config for the UPT portal.
 *
 * Two sign-in methods are supported:
 *  - Google OAuth (handled entirely by NextAuth + Google provider)
 *  - Email/password (handled by the Credentials provider below)
 *
 * NOTE: The Credentials `authorize` function currently checks against a
 * single hardcoded test account. This is intentional for now — it lets us
 * build and test the full login flow before the real user store
 * (DynamoDB, via infra/) exists. Once that table is ready, replace the
 * body of `authorize` with a real lookup + password check and nothing
 * else in this file (or in the UI) needs to change.
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

        // TODO: replace with a real DynamoDB user lookup + password hash check
        const isValidTestUser =
          email === "test@upt.org" && password === "test123";

        if (!isValidTestUser) return null;

        return { id: "1", email, name: "Test User" };
      },
    }),
  ],
  pages: {
    signIn: "/login",
  },
});
