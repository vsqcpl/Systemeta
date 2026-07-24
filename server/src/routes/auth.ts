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

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password, rememberMe } = req.body;
    console.log("EXPRESS ROUTE: received req.body.rememberMe =", rememberMe);

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Inject a custom header so the databaseHook can read rememberMe
    // Note: Better Auth's signInEmail Zod schema strictly strips unknown fields from the body.
    // We cannot simply pass { isExtended: true } in the body, as it will never reach the session.create hook.
    // Instead, we pass it via a custom header which is perfectly accessible in the hook's context.
    if (rememberMe) {
      req.headers["x-is-extended"] = "true";
    } else {
      req.headers["x-is-extended"] = "false";
    }

    // Call Better Auth to sign in via handler to ensure context.request exists for hooks
    const requestUrl = new URL(req.originalUrl || req.url, process.env.FRONTEND_URL || "http://localhost:5000");
    requestUrl.pathname = "/api/auth/sign-in/email";
    
    const headers = fromNodeHeaders(req.headers);
    // Delete content-length because we are modifying the body length by removing rememberMe
    headers.delete("content-length");

    const request = new Request(requestUrl.href, {
      method: "POST",
      headers,
      body: JSON.stringify({ email, password })
    });

    const response = await auth.handler(request);

    // Only copy Set-Cookie headers to Express response to avoid Vercel restricted headers errors
    response.headers.forEach((value, name) => {
      if (name.toLowerCase() === "set-cookie") {
        res.append("set-cookie", value);
      }
    });

    const data = await response.json();

    if (response.status !== 200) {
      return res.status(response.status).json(data);
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
    res.status(500).json({ message: "Internal server error during login", error: String(error) });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  try {
    const requestUrl = new URL(req.originalUrl || req.url, process.env.FRONTEND_URL || "http://localhost:5000");
    requestUrl.pathname = "/api/auth/sign-out";
    
    const request = new Request(requestUrl.href, {
      method: "POST",
      headers: fromNodeHeaders(req.headers)
    });

    const response = await auth.handler(request);

    response.headers.forEach((value, name) => {
      if (name.toLowerCase() === "set-cookie") {
        res.append("set-cookie", value);
      }
    });

    const data = await response.json();
    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Logout route error:", error);
    return res.status(500).json({ message: "Internal server error during logout" });
  }
});

// GET /api/auth/me
router.get("/me", async (req, res) => {
  try {
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
