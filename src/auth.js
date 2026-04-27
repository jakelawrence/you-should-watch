import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "@/app/api/lib/dynamodb";
import { createOAuthUser } from "@/app/api/lib/auth-helpers";
import authConfig from "@/auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    ...authConfig.providers,
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await getUserByEmail(credentials.email);
        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.email,
          email: user.email,
          name: user.name || user.username,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      // Require email for all providers
      if (!user.email) return false;

      if (account?.type === "oauth") {
        const existingUser = await getUserByEmail(user.email);
        if (!existingUser) {
          await createOAuthUser({
            email: user.email,
            name: user.name,
            provider: account.provider,
          });
        }
      }
      return true;
    },

    async jwt({ token, user }) {
      // Only hit DynamoDB on initial sign-in (when user object is present)
      if (user) {
        const dbUser = await getUserByEmail(user.email);
        token.username = dbUser?.username;
        token.isAdmin = dbUser?.isAdmin || false;
        token.name = dbUser?.name || dbUser?.username || user.name;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.username = token.username;
      session.user.isAdmin = token.isAdmin;
      session.user.name = token.name;
      return session;
    },
  },
});
