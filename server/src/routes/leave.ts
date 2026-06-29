import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { checkPermission, requirePermission } from "../middlewares/rbac.js";

const router = Router();

router.use(authMiddleware);

// GET /api/leave - Retrieve leave requests
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    let requests: any[] = [];

    const canSeeAll = await checkPermission(req.user.id, req.user.role, "Approve Leave") ||
                      await checkPermission(req.user.id, req.user.role, "Cross-Project Visibility") ||
                      req.user.role === "super_admin" ||
                      req.user.role === "project_manager" ||
                      req.user.role === "senior_consultant";

    if (canSeeAll) {
      requests = await prisma.leaveRequest.findMany();
    } else {
      requests = await prisma.leaveRequest.findMany({
        where: { consultantId: req.user.id },
      });
    }

    const formatted = requests.map((r) => ({
      id: r.id,
      consultant: r.consultantId,
      type: r.type,
      start: r.start,
      end: r.end,
      days: r.days,
      status: r.status,
      reason: r.reason,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("GET /leave error:", error);
    return res.status(500).json({ message: "Internal server error retrieving leave requests" });
  }
});

// POST /api/leave - Submit leave request
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { type, start, end, days, reason } = req.body;

    if (!type || !start || !end || !days || !reason) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        consultantId: req.user.id,
        status: { not: "rejected" },
        OR: [
          { start: { lte: end }, end: { gte: start } }
        ]
      }
    });
    if (overlap) {
      return res.status(409).json({ 
        message: "You already have a leave request for overlapping dates" 
      });
    }

    const lastLeave = await prisma.leaveRequest.findFirst({ orderBy: { id: "desc" } });
    const lastNum = lastLeave ? parseInt(lastLeave.id.replace("L", "") || "0", 10) : 0;
    const nextId = "L" + String(lastNum + 1).padStart(3, "0");

    const leave = await prisma.leaveRequest.create({
      data: {
        id: nextId,
        consultantId: req.user.id,
        type,
        start,
        end,
        days: parseInt(days),
        status: "pending",
        reason,
      },
    });

    // Create Activity log
    await prisma.activity.create({
      data: {
        userId: req.user.id,
        action: "Submitted leave request",
        subject: `${start} to ${end} (${days} days)`,
        projectId: null,
        type: "leave",
      },
    });

    return res.status(201).json({
      id: leave.id,
      consultant: leave.consultantId,
      type: leave.type,
      start: leave.start,
      end: leave.end,
      days: leave.days,
      status: leave.status,
      reason: leave.reason,
    });
  } catch (error) {
    console.error("POST /leave error:", error);
    return res.status(500).json({ message: "Internal server error creating leave request" });
  }
});

// PATCH /api/leave/:id - Approve or Reject leave request
router.patch("/:id", requirePermission("Approve Leave"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
    }

    const leave = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    if (leave.consultantId === req.user.id) {
      return res.status(403).json({
        message: "Cannot approve your own leave request"
      });
    }

    const updated = await prisma.leaveRequest.update({
      where: { id },
      data: { status },
    });

    // Log Audit
    await prisma.auditLog.create({
      data: {
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        userEmail: req.user.email,
        action: `LEAVE_${status.toUpperCase()}`,
        resource: `leave:${id}`,
        detail: `${status.toUpperCase()} leave request for consultant ${leave.consultantId}`,
        ip: req.ip || "127.0.0.1",
      },
    });

    return res.json({
      id: updated.id,
      consultant: updated.consultantId,
      type: updated.type,
      start: updated.start,
      end: updated.end,
      days: updated.days,
      status: updated.status,
      reason: updated.reason,
    });
  } catch (error) {
    console.error("PATCH /leave/:id error:", error);
    return res.status(500).json({ message: "Internal server error updating leave request" });
  }
});

// DELETE /api/leave/:id - Withdraw or delete a leave request
router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const leave = await prisma.leaveRequest.findUnique({ where: { id } });
    if (!leave) {
      return res.status(404).json({ message: "Leave request not found" });
    }

    // Only the owner of the leave request can delete/withdraw it, OR a super admin
    if (req.user.role !== "super_admin" && leave.consultantId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden: You cannot delete another user's leave request" });
    }

    // Only pending leave requests can be deleted/withdrawn by non-admins
    if (req.user.role !== "super_admin" && leave.status !== "pending") {
      return res.status(400).json({ message: "Bad Request: Only pending leave requests can be withdrawn" });
    }

    await prisma.leaveRequest.delete({
      where: { id },
    });

    // Create Activity log
    await prisma.activity.create({
      data: {
        userId: req.user.id,
        action: "Withdrew leave request",
        subject: `${leave.start} to ${leave.end} (${leave.days} days)`,
        projectId: null,
        type: "leave",
      },
    });

    // Log Audit
    await prisma.auditLog.create({
      data: {
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        userEmail: req.user.email,
        action: "LEAVE_WITHDRAWN",
        resource: `leave:${id}`,
        detail: `Withdrew leave request for consultant ${leave.consultantId} (${leave.type})`,
        ip: req.ip || "127.0.0.1",
      },
    });

    return res.json({ success: true, message: "Leave request withdrawn successfully" });
  } catch (error) {
    console.error("DELETE /leave/:id error:", error);
    return res.status(500).json({ message: "Internal server error deleting leave request" });
  }
});

export default router;
