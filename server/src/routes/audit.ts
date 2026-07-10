import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { requirePermission } from "../middlewares/rbac.js";
import { logAuditEvent } from "../lib/auditLogger.js";

const router = Router();

router.use(authMiddleware);

// GET /api/audit - Get all audit logs.
router.get("/", requirePermission("Admin Panel Access"), async (req: AuthenticatedRequest, res) => {
  try {
    const logs = await prisma.auditLog.findMany({
      orderBy: { id: "desc" },
    });

    const formatted = logs.map((log) => ({
      timestamp: log.timestamp,
      user: log.userEmail,
      action: log.action,
      resource: log.resource,
      detail: log.detail,
      ip: log.ip,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("GET /audit error:", error);
    return res.status(500).json({ message: "Internal server error retrieving audit logs" });
  }
});

// POST /api/audit - Log audit action
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { action, target_id, target_type, reason } = req.body;

    if (!action || !target_id) {
      return res.status(400).json({ message: "Action and target_id are required" });
    }

    const detail = `Admin operation on ${target_type || "resource"} ${target_id}${reason ? `. Reason: ${reason}` : ""}`;

    await logAuditEvent({
      userEmail: req.user.email,
      action: action,
      resource: target_id,
      detail: detail,
      ip: req.ip || "127.0.0.1",
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("POST /audit error:", error);
    return res.status(500).json({ message: "Internal server error creating audit entry" });
  }
});

export default router;
