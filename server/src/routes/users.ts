import { Router } from "express";
import bcrypt from "bcrypt";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/rbac.js";

const router = Router();

// Apply auth middleware to all user routes
router.use(authMiddleware);

// GET /api/users - Return all users. Accessible by any authenticated user.
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const users = await prisma.user.findMany({
      include: {
        projects: true,
      },
    });

    // Format profiles to match what Next.js frontend expects (flat projectIds list)
    const profiles = users.map((u) => {
      const { passwordHash, projects, ...profile } = u;
      return {
        ...profile,
        lastLogin: u.lastLoginAt ? u.lastLoginAt.toISOString().split("T")[0] : "—",
        projectIds: projects.map((p) => p.projectId),
      };
    });

    return res.json(profiles);
  } catch (error) {
    console.error("GET /users error:", error);
    return res.status(500).json({ message: "Internal server error retrieving users" });
  }
});

// POST /api/users - Create user. Accessible by super_admin (or override).
router.post("/", requirePermission("Admin Panel Access"), async (req: AuthenticatedRequest, res) => {
  try {
    const { name, email, password, role, project_ids, client_id, reportee_of } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ message: "Name, email, password and role are required" });
    }

    if (role === "client_manager" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Only Super Admins can manage Client Managers" });
    }

    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return res.status(400).json({ message: "Email address is already in use" });
    }

    // Password strength check
    const passwordPattern = /^(?=.*[A-Z])(?=.*[0-9])/;
    if (password.length < 8 || !passwordPattern.test(password)) {
      return res.status(400).json({
        message: "Password must be at least 8 characters and contain at least one uppercase letter and one number.",
      });
    }

    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Generate unique ID using max existing ID to avoid collisions on deletion
    const lastUser = await prisma.user.findFirst({ orderBy: { id: "desc" } });
    const lastNum = lastUser ? parseInt(lastUser.id.replace("U", "") || "0", 10) : 0;
    const nextId = "U" + String(lastNum + 1).padStart(3, "0");

    // Perform database operations in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id: nextId,
          name,
          email: email.toLowerCase(),
          passwordHash,
          role,
          status: "active",
          mfa: false,
          mustChangePassword: true,
          clientId: client_id || null,
          reporteeOfId: reportee_of || null,
        },
      });

      // Create Better Auth account
      await tx.account.create({
        data: {
          id: `account-${nextId}`,
          accountId: nextId,
          providerId: "credential",
          userId: nextId,
          password: passwordHash,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      });

      // Assign projects
      if (project_ids && project_ids.length > 0) {
        await tx.projectAssignment.createMany({
          data: project_ids.map((pId: string) => ({
            userId: nextId,
            projectId: pId,
          })),
        });
      }

      // Create Audit Log
      await tx.auditLog.create({
        data: {
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
          userEmail: req.user.email,
          action: "USER_CREATED",
          resource: `user:${nextId}`,
          detail: `Created user ${name} with role ${role}`,
          ip: req.ip || "127.0.0.1",
        },
      });

      return user;
    });

    const { passwordHash: _, ...profile } = newUser;
    return res.status(201).json({
      ...profile,
      lastLogin: "—",
      projectIds: project_ids || [],
    });
  } catch (error) {
    console.error("POST /users error:", error);
    return res.status(500).json({ message: "Internal server error creating user" });
  }
});

// PATCH /api/users/:id - Update user details. Accessible by super_admin (or override).
router.patch("/:id", requirePermission("Admin Panel Access"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { name, email, role, status, project_ids, client_id, reportee_of, password, reason, mfa } = req.body;

    const existingUser = await prisma.user.findUnique({
      where: { id },
    });

    if (!existingUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if ((role === "client_manager" || existingUser.role === "client_manager") && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Only Super Admins can manage Client Managers" });
    }

    let nextPasswordHash = existingUser.passwordHash;
    let mustForceChange = existingUser.mustChangePassword;

    if (password) {
      const saltRounds = 10;
      nextPasswordHash = await bcrypt.hash(password, saltRounds);
      mustForceChange = true;
    }

    if (email && email.toLowerCase() !== existingUser.email.toLowerCase()) {
      const duplicate = await prisma.user.findUnique({
        where: { email: email.toLowerCase() },
      });
      if (duplicate) {
        return res.status(400).json({ message: "Email address is already in use" });
      }
    }

    let auditAction = "USER_EDITED";
    let auditDetail = `Updated details for user ${existingUser.name}`;

    if (status !== undefined && status !== existingUser.status) {
      if (status === "inactive") {
        auditAction = "USER_DEACTIVATED";
        auditDetail = `Deactivated user ${existingUser.name}${reason ? `. Reason: ${reason}` : ""}`;
      } else {
        auditAction = "USER_ACTIVATED";
        auditDetail = `Reactivated user ${existingUser.name}`;
      }
    }

    if (password) {
      auditDetail += `. Password reset forced`;
    }

    // Perform database operations in a transaction
    const updatedUser = await prisma.$transaction(async (tx) => {
      const user = await tx.user.update({
        where: { id },
        data: {
          name: name || undefined,
          email: email ? email.toLowerCase() : undefined,
          role: role || undefined,
          status: status || undefined,
          mfa: mfa !== undefined ? mfa : undefined,
          passwordHash: nextPasswordHash,
          mustChangePassword: mustForceChange,
          clientId: client_id !== undefined ? (client_id || null) : undefined,
          reporteeOfId: reportee_of !== undefined ? (reportee_of || null) : undefined,
        },
      });

      if (password) {
        await tx.account.updateMany({
          where: { userId: id, providerId: "credential" },
          data: { password: nextPasswordHash },
        });
      }

      if (project_ids) {
        // Clear old assignments and recreate
        await tx.projectAssignment.deleteMany({
          where: { userId: id },
        });
        if (project_ids.length > 0) {
          await tx.projectAssignment.createMany({
            data: project_ids.map((pId: string) => ({
              userId: id,
              projectId: pId,
            })),
          });
        }
      }

      // Create Audit Log
      await tx.auditLog.create({
        data: {
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
          userEmail: req.user.email,
          action: auditAction,
          resource: `user:${id}`,
          detail: auditDetail,
          ip: req.ip || "127.0.0.1",
        },
      });

      return user;
    });

    const { passwordHash: _, ...profile } = updatedUser;
    return res.json({
      ...profile,
      lastLogin: updatedUser.lastLoginAt ? updatedUser.lastLoginAt.toISOString().split("T")[0] : "—",
      projectIds: project_ids || [],
    });
  } catch (error) {
    console.error("PATCH /users/:id error:", error);
    return res.status(500).json({ message: "Internal server error updating user" });
  }
});

// DELETE /api/users/:id
router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    if (req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Insufficient permissions to delete users" });
    }

    if (req.user.id === id) {
      return res.status(400).json({ message: "Bad Request: You cannot delete your own account" });
    }

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === "client_manager" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Only Super Admins can manage Client Managers" });
    }

    await prisma.$transaction(async (tx) => {
      // Set reporteeOfId to null for all reportees of this user
      await tx.user.updateMany({
        where: { reporteeOfId: id },
        data: { reporteeOfId: null },
      });

      // Delete the user
      await tx.user.delete({
        where: { id },
      });
    });

    // Log Audit
    await prisma.auditLog.create({
      data: {
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        userEmail: req.user.email,
        action: "USER_DELETED",
        resource: `user:${id}`,
        detail: `Deleted user ${user.name} (${user.email})`,
        ip: req.ip || "127.0.0.1",
      },
    });

    return res.json({ success: true, message: "User deleted successfully" });
  } catch (error) {
    console.error("DELETE /users/:id error:", error);
    return res.status(500).json({ message: "Internal server error deleting user" });
  }
});

export default router;
