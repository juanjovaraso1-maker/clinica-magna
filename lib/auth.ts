import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { prisma } from "./prisma";
import bcrypt from "bcryptjs";

// In-memory rate limiter: max 5 failed attempts per 5 minutes per username+ip
const failedAttempts = new Map<string, { count: number; since: number }>();
const MAX_FAILURES   = 5;
const WINDOW_MS      = 5 * 60 * 1000;  // 5 minutes
const LOCKOUT_MS     = 5 * 60 * 1000;  // 5 minutes lockout

function isRateLimited(key: string): boolean {
  const now   = Date.now();
  const entry = failedAttempts.get(key);
  if (!entry) return false;
  if (now - entry.since > LOCKOUT_MS) { failedAttempts.delete(key); return false; }
  return entry.count >= MAX_FAILURES;
}

function recordFailure(key: string) {
  const now   = Date.now();
  const entry = failedAttempts.get(key);
  if (!entry || now - entry.since > WINDOW_MS) {
    failedAttempts.set(key, { count: 1, since: now });
  } else {
    entry.count++;
  }
}

function clearFailures(key: string) { failedAttempts.delete(key); }

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        username: { label: "Usuario", type: "text" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials, req) {
        if (!credentials?.username || !credentials?.password) return null;

        const ip  = (req as any)?.headers?.["x-forwarded-for"]?.split(",")[0].trim() ?? "unknown";
        const key = `${credentials.username}:${ip}`;

        if (isRateLimited(key)) {
          throw new Error("RATE_LIMITED");
        }

        const user = await prisma.user.findFirst({
          where: { username: credentials.username, active: true },
        });

        if (!user?.password) {
          recordFailure(key);
          await prisma.loginAttempt.create({ data: { username: credentials.username, ip, success: false } }).catch(() => {});
          return null;
        }

        const valid = await bcrypt.compare(credentials.password, user.password);
        if (!valid) {
          recordFailure(key);
          await prisma.loginAttempt.create({ data: { username: credentials.username, ip, success: false } }).catch(() => {});
          return null;
        }

        clearFailures(key);
        await prisma.loginAttempt.create({ data: { username: credentials.username, ip, success: true } }).catch(() => {});
        return { id: user.id, name: user.name, title: user.title ?? "", email: user.email ?? "", role: user.role };
      },
    }),
  ],
  // Session expires after 60 minutes of inactivity
  session: { strategy: "jwt", maxAge: 60 * 60 },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id    = user.id;
        token.role  = (user as any).role;
        token.title = (user as any).title ?? "";
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        (session.user as any).id    = token.id;
        (session.user as any).role  = token.role;
        (session.user as any).title = token.title ?? "";
      }
      return session;
    },
  },
  pages: { signIn: "/login" },
  secret: process.env.NEXTAUTH_SECRET,
};
