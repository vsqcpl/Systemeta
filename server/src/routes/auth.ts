import { Router } from "express";
import bcrypt from "bcrypt";
import { fromNodeHeaders } from "better-auth/node";
import { auth } from "../lib/auth.js";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";

const router = Router();

// POST /api/auth/login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required" });
    }

    // Call Better Auth to sign in
    const response = await auth.api.signInEmail({
      body: { email, password },
      asResponse: true,
    });

    // Copy Set-Cookie headers to Express response
    response.headers.forEach((value, name) => {
      if (name.toLowerCase() === "set-cookie") {
        res.append(name, value);
      } else {
        res.setHeader(name, value);
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
        await prisma.auditLog.create({
          data: {
            timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
            userEmail: dbUser.email,
            action: "USER_LOGIN",
            resource: `user:${dbUser.id}`,
            detail: "User logged in successfully",
            ip: req.ip || "127.0.0.1",
          },
        });
      } catch (writeErr) {
        console.warn("Could not write to database during login (Vercel read-only filesystem?):", writeErr);
      }
    }

    return res.status(response.status).json(data);
  } catch (error) {
    console.error("Login route error:", error);
    return res.status(500).json({ message: "Internal server error during login" });
  }
});

// POST /api/auth/logout
router.post("/logout", async (req, res) => {
  try {
    const response = await auth.api.signOut({
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    });

    response.headers.forEach((value, name) => {
      if (name.toLowerCase() === "set-cookie") {
        res.append(name, value);
      } else {
        res.setHeader(name, value);
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

    // Password strength check
    const passwordPattern = /^(?=.*[A-Z])(?=.*[0-9])/;
    if (newPassword.length < 8 || !passwordPattern.test(newPassword)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters and contain at least one uppercase letter and one number.",
      });
    }

    const saltRounds = 10;
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
    await prisma.auditLog.create({
      data: {
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        userEmail: req.user.email,
        action: "PASSWORD_CHANGED",
        resource: `user:${req.user.id}`,
        detail: "User changed password successfully",
        ip: req.ip || "127.0.0.1",
      },
    });

    return res.json({ success: true, message: "Password updated successfully" });
  } catch (error) {
    console.error("Change password route error:", error);
    return res.status(500).json({ message: "Internal server error updating password" });
  }
});

export default router;
