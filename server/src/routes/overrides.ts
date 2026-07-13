import { Router, Response } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { logAuditEvent } from "../lib/auditLogger.js";

const router = Router();

router.use(authMiddleware);

// ─── GET /api/overrides ───────────────────────────────────────────────────────
// Any authenticated user can view overrides.
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const overrides = await prisma.permissionOverride.findMany({
      orderBy: { createdAt: "desc" },
    });
    return res.json(overrides);
  } catch (error: any) {
    console.error("GET /overrides error:", error?.message || error);
    return res.status(500).json({ message: "Internal server error retrieving overrides" });
  }
});

// ─── POST /api/overrides ──────────────────────────────────────────────────────
// Super Admin: immediately active. Project Manager: pending approval.
router.post("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const role = req.user.role;
    if (role !== "super_admin" && role !== "project_manager") {
      return res.status(403).json({
        message: "Forbidden: Only Super Admin or Project Manager can create overrides",
      });
    }

    const { userId, permissionKey, granted, reason, startDate, endDate } = req.body;

    // --- Validate required fields ---
    const missing: string[] = [];
    if (!userId)                     missing.push("userId");
    if (!permissionKey)              missing.push("permissionKey");
    if (granted === undefined)       missing.push("granted");
    if (!reason || !reason.trim())   missing.push("reason");
    if (!startDate)                  missing.push("startDate");
    if (!endDate)                    missing.push("endDate");

    if (missing.length > 0) {
      return res.status(400).json({
        message: `Missing required fields: ${missing.join(", ")}`,
      });
    }

    // --- Validate date logic ---
    const start = new Date(startDate);
    const end   = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "startDate and endDate must be valid dates" });
    }
    if (end <= start) {
      return res.status(400).json({ message: "endDate must be after startDate" });
    }

    // --- Validate target user exists ---
    const targetUser = await prisma.user.findUnique({ where: { id: userId } });
    if (!targetUser) {
      return res.status(404).json({ message: "Target user not found" });
    }

    // --- Permission escalation guard ---
    if (targetUser.role === "client_manager" && role !== "super_admin") {
      return res.status(403).json({
        message: "Forbidden: Only Super Admins can manage overrides for Client Managers",
      });
    }

    // --- Prevent self-override by non-super-admins ---
    if (role !== "super_admin" && userId === req.user.id) {
      return res.status(403).json({ message: "You cannot create an override for yourself" });
    }

    // --- Check for duplicate active override on same permission ---
    const now = new Date();
    const existingActive = await prisma.permissionOverride.findFirst({
      where: {
        userId,
        permissionKey,
        isActive: true,
        endDate: { gt: now },
      },
    });
    if (existingActive) {
      return res.status(409).json({
        message: `An active override for permission "${permissionKey}" already exists for this user. Revoke it first.`,
      });
    }

    const isSuperAdmin = role === "super_admin";
    const grantedBy    = isSuperAdmin ? req.user.name : "Pending Approval";
    const isActive     = isSuperAdmin;

    const override = await prisma.permissionOverride.create({
      data: {
        userId,
        permissionKey,
        granted: isSuperAdmin ? Boolean(granted) : false,
        grantedBy,
        reason: reason.trim(),
        startDate: new Date(new Date(startDate).setHours(0, 0, 0, 0)),
        endDate:   new Date(new Date(endDate).setHours(23, 59, 59, 999)),
        isActive,
      },
    });

    // Audit log (non-critical)
    logAuditEvent({
      userEmail: req.user.email,
      action: isSuperAdmin ? "PERMISSION_OVERRIDE_GRANTED" : "PERMISSION_OVERRIDE_REQUESTED",
      resource: `user:${userId}`,
      detail: isSuperAdmin
        ? `Emergency override '${permissionKey}' (${granted ? "grant" : "restrict"}) granted to ${targetUser.email} by ${req.user.email}. Reason: ${reason.trim()}. Expires: ${endDate}.`
        : `Emergency override '${permissionKey}' requested for ${targetUser.email} by PM ${req.user.email}. Reason: ${reason.trim()}. Expires: ${endDate}.`,
      ip: req.ip || "127.0.0.1",
    }).catch((e) => console.error("Audit log failed:", e));

    return res.status(201).json(override);
  } catch (error: any) {
    console.error("POST /overrides error:", error?.message || error);
    return res.status(500).json({ message: "Internal server error creating override" });
  }
});

// ─── PATCH /api/overrides/:id ─────────────────────────────────────────────────
// Super Admin only — approve, revoke, or extend an override.
router.patch("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Only Super Admin can modify overrides" });
    }

    const { id } = req.params;
    const { action, endDate, reason } = req.body;

    if (!action) {
      return res.status(400).json({ message: "action is required (approve, revoke, or extend)" });
    }

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
      if (!endDate) {
        return res.status(400).json({ message: "endDate is required to extend an override" });
      }
      const newEnd = new Date(endDate);
      if (isNaN(newEnd.getTime())) {
        return res.status(400).json({ message: "Invalid endDate format" });
      }
      if (newEnd <= new Date()) {
        return res.status(400).json({ message: "endDate must be in the future" });
      }

      updatedOverride = await prisma.permissionOverride.update({
        where: { id },
        data: {
          endDate: new Date(newEnd.setHours(23, 59, 59, 999)),
          reason: reason?.trim() || existingOverride.reason,
          grantedBy: req.user.name,
          isActive: true,
          updatedAt: new Date(),
        },
      });
      auditAction = "PERMISSION_OVERRIDE_EXTENDED";
      auditDetail = `Emergency override '${existingOverride.permissionKey}' for ${recipientEmail} extended to ${endDate} by ${req.user.email}. Reason: ${reason?.trim() || existingOverride.reason}.`;

    } else {
      return res.status(400).json({ message: "Invalid action. Must be 'approve', 'revoke', or 'extend'" });
    }

    // Audit log (non-critical)
    logAuditEvent({
      userEmail: req.user.email,
      action: auditAction,
      resource: `user:${existingOverride.userId}`,
      detail: auditDetail,
      ip: req.ip || "127.0.0.1",
    }).catch((e) => console.error("Audit log failed:", e));

    return res.json(updatedOverride);
  } catch (error: any) {
    console.error("PATCH /overrides/:id error:", error?.message || error);
    return res.status(500).json({ message: "Internal server error modifying override" });
  }
});

// ─── DELETE /api/overrides/:id ────────────────────────────────────────────────
// Super Admin only — permanently delete an override record.
router.delete("/:id", async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden: Only Super Admin can delete overrides" });
    }

    const { id } = req.params;
    const existingOverride = await prisma.permissionOverride.findUnique({ where: { id } });
    if (!existingOverride) {
      return res.status(404).json({ message: "Override not found" });
    }

    await prisma.permissionOverride.delete({ where: { id } });

    // Audit log (non-critical)
    logAuditEvent({
      userEmail: req.user.email,
      action: "PERMISSION_OVERRIDE_DELETED",
      resource: `override:${id}`,
      detail: `Override '${existingOverride.permissionKey}' for user ${existingOverride.userId} deleted by ${req.user.email}.`,
      ip: req.ip || "127.0.0.1",
    }).catch((e) => console.error("Audit log failed:", e));

    return res.json({ success: true, message: "Override deleted successfully" });
  } catch (error: any) {
    console.error("DELETE /overrides/:id error:", error?.message || error);
    return res.status(500).json({ message: "Internal server error deleting override" });
  }
});

export default router;
