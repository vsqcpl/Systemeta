import { Router, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { logAuditEvent } from "../lib/auditLogger.js";

const router = Router();

router.use(authMiddleware);
// Role enforcement is handled per-operation below

// GET /api/overrides - Get all overrides (any authenticated user can view)
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const overrides = await prisma.permissionOverride.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(overrides);
  } catch (error) {
    console.error("GET /overrides error:", error);
    return res.status(500).json({ message: "Internal server error retrieving overrides" });
  }
});

// POST /api/overrides - Create (Super Admin) or Request (Project Manager) an override
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user.role;
    if (role !== "super_admin" && role !== "project_manager") {
      return res.status(403).json({ message: "Forbidden: Only Super Admin or Project Manager can create overrides" });
    }

    const { userId, permissionKey, granted, reason, startDate, endDate } = req.body;

    if (!userId || !permissionKey || granted === undefined || !reason || !startDate || !endDate) {
      return res.status(400).json({ message: "userId, permissionKey, granted, reason, startDate, and endDate are required" });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
    });
    if (!targetUser) {
      return res.status(404).json({ message: "User not found" });
    }

    if (targetUser.role === "client_manager" && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Only Super Admins can manage overrides for Client Managers" });
    }

    const isSuperAdmin = req.user.role === "super_admin";
    const grantedBy = isSuperAdmin ? req.user.name : "Pending Approval";
    const isActive = isSuperAdmin; // active immediately for Super Admin, inactive (pending) for PM

    // Create the override in the database
    const override = await prisma.permissionOverride.create({
      data: {
        userId,
        permissionKey,
        granted: isSuperAdmin ? granted : false, // PM request starts as false (not granted yet)
        grantedBy,
        reason,
        startDate: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        endDate: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        isActive,
      },
    });

    // Load user email for audit log detail
    const recipient = await prisma.user.findUnique({ where: { id: userId } });
    const recipientEmail = recipient?.email || userId;

    // Log audit
    await logAuditEvent({
      userEmail: req.user.email,
      action: isSuperAdmin ? "PERMISSION_OVERRIDE_GRANTED" : "PERMISSION_OVERRIDE_REQUESTED",
      resource: `user:${userId}`,
      detail: isSuperAdmin
        ? `Emergency override '${permissionKey}' (${granted ? "grant" : "restrict"}) granted to ${recipientEmail} by ${req.user.email}. Reason: ${reason}. Expires: ${endDate}.`
        : `Emergency override '${permissionKey}' requested for ${recipientEmail} by Project Manager ${req.user.email}. Reason: ${reason}. Expires: ${endDate}.`,
      ip: req.ip || "127.0.0.1",
    });

    return res.status(201).json(override);
  } catch (error) {
    console.error("POST /overrides error:", error);
    return res.status(500).json({ message: "Internal server error creating override" });
  }
});

// PATCH /api/overrides/:id - Approve, revoke, or extend an override (Super Admin only)
router.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Only Super Admin can modify overrides" });
    }

    const { id } = req.params;
    const { action, endDate, reason } = req.body;

    const existingOverride = await prisma.permissionOverride.findUnique({ where: { id } });
    if (!existingOverride) {
      return res.status(404).json({ message: "Override not found" });
    }

    const recipient = await prisma.user.findUnique({ where: { id: existingOverride.userId } });
    const recipientEmail = recipient?.email || existingOverride.userId;

    let updatedOverride;
    let auditAction = "";
    let auditDetail = "";

    if (action === "approve") {
      updatedOverride = await prisma.permissionOverride.update({
        where: { id },
        data: {
          granted: true,
          isActive: true,
          grantedBy: req.user.name,
          updatedAt: new Date(),
        },
      });
      auditAction = "PERMISSION_OVERRIDE_APPROVED";
      auditDetail = `Emergency override '${existingOverride.permissionKey}' for ${recipientEmail} approved by ${req.user.email}. Reason: ${existingOverride.reason}.`;
    } else if (action === "revoke") {
      updatedOverride = await prisma.permissionOverride.update({
        where: { id },
        data: {
          isActive: false,
          updatedAt: new Date(),
        },
      });
      auditAction = "PERMISSION_OVERRIDE_REVOKED";
      auditDetail = `Emergency override '${existingOverride.permissionKey}' for ${recipientEmail} revoked by ${req.user.email}.`;
    } else if (action === "extend") {
      if (!endDate || !reason) {
        return res.status(400).json({ message: "endDate and reason are required to extend an override" });
      }
      updatedOverride = await prisma.permissionOverride.update({
        where: { id },
        data: {
          endDate: new Date(new Date(endDate).setHours(23, 59, 59, 999)),
          reason,
          grantedBy: req.user.name,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      auditAction = "PERMISSION_OVERRIDE_EXTENDED";
      auditDetail = `Emergency override '${existingOverride.permissionKey}' for ${recipientEmail} extended to ${endDate} by ${req.user.email}. Reason: ${reason}.`;
    } else {
      return res.status(400).json({ message: "Invalid action. Must be 'approve', 'revoke', or 'extend'" });
    }

    // Log audit
    await logAuditEvent({
      userEmail: req.user.email,
      action: auditAction,
      resource: `user:${existingOverride.userId}`,
      detail: auditDetail,
      ip: req.ip || "127.0.0.1",
    });

    return res.json(updatedOverride);
  } catch (error) {
    console.error("PATCH /overrides/:id error:", error);
    return res.status(500).json({ message: "Internal server error modifying override" });
  }
});

export default router;
