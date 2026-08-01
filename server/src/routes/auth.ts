import { Router } from "express";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { logAuditEvent } from "../lib/auditLogger.js";

const router = Router();

// GET /api/auth/csrf-token
router.get("/csrf-token", (req, res) => {
  const isProd = process.env.NODE_ENV === "production";
  const cookieName = isProd ? "__Secure-csrf-token-sig" : "csrf-token-sig";
  const token = crypto.randomBytes(32).toString("hex");
  
  res.cookie(cookieName, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/"
  });
  
  return res.json({ csrfToken: token });
});

/**
 * Helper to process and transform Set-Cookie headers from Better Auth based on rememberMe.
 */
function processAndSetCookies(res: any, responseHeaders: Headers, rememberMe: boolean) {
  const isProd = process.env.NODE_ENV === "production";
  
  responseHeaders.forEach((value, name) => {
    if (name.toLowerCase() === "set-cookie") {
      let cookieStr = value;
      
      if (rememberMe) {
        // Enforce 30-day cookie persistence (30 * 24 * 60 * 60 = 2,592,000 seconds)
        const maxAgeSeconds = 30 * 24 * 60 * 60;
        const expiresDate = new Date(Date.now() + maxAgeSeconds * 1000).toUTCString();

        if (/max-age=\d+/i.test(cookieStr)) {
          cookieStr = cookieStr.replace(/max-age=\d+/i, `Max-Age=${maxAgeSeconds}`);
        } else {
          cookieStr += `; Max-Age=${maxAgeSeconds}`;
        }

        if (/expires=[^;]+/i.test(cookieStr)) {
          cookieStr = cookieStr.replace(/expires=[^;]+/i, `Expires=${expiresDate}`);
        } else {
          cookieStr += `; Expires=${expiresDate}`;
        }
      } else {
        // When Remember Me is unchecked, remove Max-Age and Expires to make it a Session Cookie
        // A cookie without Max-Age/Expires is deleted when browser session ends (browser close)
        cookieStr = cookieStr
          .split(";")
          .map((part) => part.trim())
          .filter((part) => !/^max-age=/i.test(part) && !/^expires=/i.test(part))
          .join("; ");
      }

      if (!/httponly/i.test(cookieStr)) {
        cookieStr += "; HttpOnly";
      }
      if (!/path=/i.test(cookieStr)) {
        cookieStr += "; Path=/";
      }
      if (!/samesite=/i.test(cookieStr)) {
        cookieStr += "; SameSite=Lax";
      }
      if (isProd && !/secure/i.test(cookieStr)) {
        cookieStr += "; Secure";
      }

      res.append("set-cookie", cookieStr);
    }
  });
}

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    console.log("EXPRESS ROUTE: received req.body.rememberMe =", rememberMe);

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    if (!process.env.DATABASE_URL) {
      return res.status(500).json({ message: "Server Configuration Error: DATABASE_URL environment variable is missing." });
    }

    // Clean up any stale expired sessions
    try {
      await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
    } catch (_) {}

    // Inject custom header so databaseHook can read rememberMe
    if (rememberMe) {
      req.headers["x-is-extended"] = "true";
    } else {
      req.headers["x-is-extended"] = "false";
    }

    // Call Better Auth to sign in via handler to ensure context.request exists for hooks
    const requestUrl = new URL(req.originalUrl || req.url, process.env.FRONTEND_URL || "http://localhost:5005");
    requestUrl.pathname = "/api/auth/sign-in/email";
    
    const headers = fromNodeHeaders(req.headers);
    headers.delete("content-length");

    const request = new Request(requestUrl.href, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password }),
    });

    const response = await auth.handler(request);

    // Set processAndSetCookies to enforce 30-day persistence or Session Cookie policy
    processAndSetCookies(res, response.headers, !!rememberMe);

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : { message: `Server authentication error (status ${response.status})` };
    } catch {
      data = { message: text || `Server error (status ${response.status})` };
    }

    if (response.status !== 200) {
      return res.status(response.status).json(data);
    }

    // Sanitize response: do NOT expose raw session token in JSON to client JS
    if (data && typeof data === "object") {
      if (data.session && typeof data.session === "object") {
        delete data.session.token;
      }
      delete data.token;
    }

    // Load user record from db to log login event
    const dbUser = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (dbUser) {
      try {
        await prisma.user.update({
          where: { id: dbUser.id },
          data: { lastLoginAt: new Date() },
        });

        // Log audit
        await logAuditEvent({
          userEmail: dbUser.email,
          action: "USER_LOGIN",
          resource: `user:${dbUser.id}`,
          detail: "User logged in successfully",
          ip: req.ip || "127.0.0.1",
        });
      } catch (writeErr) {
        console.warn("Could not write to database during login (Vercel read-only filesystem?):", writeErr);
      }
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Login Error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.status(500).json({ message: `Server error: ${errorMessage}`, error: String(error) });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (session?.user?.id) {
      // Invalidate all active sessions & remember tokens for this user in the database immediately
      await prisma.session.deleteMany({
        where: { userId: session.user.id },
      });
    }

    const requestUrl = new URL(req.originalUrl || req.url, process.env.FRONTEND_URL || "http://localhost:5005");
    requestUrl.pathname = "/api/auth/sign-out";
    
    const request = new Request(requestUrl.href, {
      method: "POST",
      headers: fromNodeHeaders(req.headers),
    });

    const response = await auth.handler(request);

    response.headers.forEach((value, name) => {
      if (name.toLowerCase() === "set-cookie") {
        res.append("set-cookie", value);
      }
    });

    const data = await response.json().catch(() => ({ success: true }));
    return res.status(response.status || 200).json(data);
  } catch (error) {
    console.error("Logout route error:", error);
    return res.status(500).json({ message: "Internal server error during logout" });
  }
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  try {
    // Purge expired sessions
    try {
      await prisma.session.deleteMany({
        where: { expiresAt: { lt: new Date() } },
      });
    } catch (_) {}

    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });

    if (!session) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const dbUser = await prisma.user.findUnique({
      where: { id: session.user.id },
      include: {
        projects: {
          select: { projectId: true },
        },
      },
    });

    if (!dbUser) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    const { passwordHash, projects, ...profile } = dbUser;
    const projectIds = projects.map((p) => p.projectId);
    return res.json({
      ...profile,
      projectIds,
    });
  } catch (error) {
    console.error("Me route error:", error);
    return res.status(500).json({ message: "Internal server error retrieving session" });
  }
});

// POST /api/auth/change-password
router.post("/change-password", authMiddleware, async (req: AuthenticatedRequest, res) => {
  try {
    const currentPassword = req.body.currentPassword || req.body.current_password;
    const newPassword = req.body.newPassword || req.body.new_password;

    if (!newPassword) {
      return res.status(400).json({ message: "New password is required" });
    }

    // Verify current password first (if it's not the first login where they might not know it, or if required)
    // The existing screen asks for currentPassword and newPassword. Let's verify currentPassword.
    const isCurrentValid = await bcrypt.compare(currentPassword || "", req.user.passwordHash);
    if (!isCurrentValid) {
      return res.status(400).json({ message: "Invalid current password" });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: "New password must be different from current password" });
    }

    // Password strength check
    const passwordPattern = /^(?=.*[A-Z])(?=.*[0-9])/;
    if (newPassword.length < 8 || !passwordPattern.test(newPassword)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters and contain at least one uppercase letter and one number.",
      });
    }

    const saltRounds = 12;
    const newHash = await bcrypt.hash(newPassword, saltRounds);

    // Update both local user passwordHash and Better Auth credentials password
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.user.id },
        data: {
          passwordHash: newHash,
          mustChangePassword: false,
        },
      }),
      prisma.account.updateMany({
        where: { userId: req.user.id, providerId: "credential" },
        data: { password: newHash },
      }),
    ]);

    // Log audit
    await logAuditEvent({
      userEmail: req.user.email,
      action: "PASSWORD_CHANGED",
      resource: `user:${req.user.id}`,
      detail: "User changed password successfully",
      ip: req.ip || "127.0.0.1",
    });

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password route error:", error);
    return res.status(500).json({ message: "Internal server error updating password" });
  }
});

export default router;
