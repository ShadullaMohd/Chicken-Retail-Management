import type { NextAuthConfig } from "next-auth";
import type { Role } from "@prisma/client";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/dispatch",
  "/sales",
  "/expenses",
  "/branches",
  "/reports",
  "/settings",
];

/**
 * Edge-safe Auth.js configuration (no database or Node-only imports).
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },
  providers: [],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const { pathname } = nextUrl;

      const isProtectedRoute = PROTECTED_PREFIXES.some(
        (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
      );

      if (isProtectedRoute && !isLoggedIn) {
        return false; // Redirects automatically to pages.signIn (/login)
      }

      if (pathname === "/login" && isLoggedIn) {
        return Response.redirect(new URL("/dashboard", nextUrl));
      }

      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.businessId = user.businessId;
        token.branchIds = user.branchIds;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as Role;
        session.user.businessId = token.businessId as string;
        session.user.branchIds = (token.branchIds as string[]) ?? [];
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
