import { betterAuth } from "better-auth";
import { prismaAdapter } from "@better-auth/prisma-adapter";
import prisma from "./prisma.js";
import bcrypt from "bcrypt";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL || (process.env.NODE_ENV === "production" ? "https://vsqc-platform-backend.vercel.app" : "http://localhost:5000"),
  trustedOrigins: [
    process.env.FRONTEND_URL || "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:3002",
    "http://127.0.0.1:3002",
    "http://localhost:*",
    "http://127.0.0.1:*",
    "https://*.vercel.app",
    ...(process.env.TRUSTED_ORIGINS ? process.env.TRUSTED_ORIGINS.split(",").map(url => url.trim()) : []),
  ],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    autoSignIn: false,
    password: {
      hash: async (password: string) => {
        return bcrypt.hash(password, 12);
      },
      verify: async ({ hash, password }) => {
        return bcrypt.compare(password, hash);
      },
    },
  },
  // Ensure sessions last long enough and cookies are secure
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
    additionalFields: {
      isExtended: {
        type: "boolean",
        defaultValue: false,
        input: true,
      },
    },
  },
  databaseHooks: {
    session: {
      create: {
        before: async (session, context) => {
          const isExtendedHeader = context?.request?.headers?.get("x-is-extended");
          console.log("BETTER AUTH HOOK: context.request exists?", !!context?.request);
          console.log("BETTER AUTH HOOK: session.isExtended =", session.isExtended, "isExtendedHeader =", isExtendedHeader);
          // If we passed the header (from auth.ts fallback injection) or if it's already on the payload
          const isExtended = session.isExtended === true || isExtendedHeader === "true";
          
          if (isExtended) {
            const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000);
            return { data: { ...session, isExtended: true, expiresAt } };
          }
          return { data: { ...session, isExtended: false } };
        },
      },
      update: {
        before: async (session, context) => {
          if (session.isExtended === true) {
            const expiresAt = new Date(Date.now() + 60 * 60 * 24 * 30 * 1000);
            return { data: { ...session, expiresAt } };
          }
        },
      },
    },
  },
});
