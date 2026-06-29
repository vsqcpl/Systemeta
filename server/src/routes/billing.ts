import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/rbac.js";

const router = Router();

router.use(authMiddleware);

// GET /api/billing - Get invoices and milestones
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    let projectsFilter: string[] = [];
    const isElevated = req.user.role === "super_admin" || req.user.role === "accounts";

    if (!isElevated) {
      if (req.user.role === "project_manager") {
        // PM sees invoices/milestones for their managed projects
        const managedProjects = await prisma.project.findMany({
          where: { managerName: req.user.name },
          select: { id: true },
        });
        projectsFilter = managedProjects.map((p) => p.id);
      } else {
        // Other roles see only assigned projects
        const assignments = await prisma.projectAssignment.findMany({
          where: { userId: req.user.id },
          select: { projectId: true },
        });
        projectsFilter = assignments.map((a) => a.projectId);
      }
    }

    const whereClause = !isElevated ? { projectId: { in: projectsFilter } } : {};

    const [invoices, milestones] = await Promise.all([
      prisma.invoice.findMany({ where: whereClause }),
      prisma.milestone.findMany({ where: whereClause }),
    ]);

    return res.json({
      invoices: invoices.map((i) => ({
        id: i.id,
        project: i.projectId,
        client: i.client,
        amount: i.amount,
        status: i.status,
        issued: i.issued,
        due: i.due || undefined,
        paid: i.paid || undefined,
      })),
      milestones: milestones.map((m) => ({
        id: m.id,
        project: m.projectId,
        title: m.title,
        date: m.date,
        status: m.status,
        amount: m.amount,
      })),
    });
  } catch (error) {
    console.error("GET /billing error:", error);
    return res.status(500).json({ message: "Internal server error retrieving billing data" });
  }
});


// POST /api/billing/invoices - Generate an invoice
router.post("/invoices", requireRoles(["super_admin", "accounts"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { project, client, amount, issued, due } = req.body;

    if (!project || !client || !amount || !issued) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    const lastInvoice = await prisma.invoice.findFirst({ orderBy: { id: "desc" } });
    // Extract numeric portion: INV-2026-041 → 41
    const lastNum = lastInvoice
      ? parseInt(lastInvoice.id.split("-").pop() || "40", 10)
      : 40;
    const nextId = `INV-2026-${String(lastNum + 1).padStart(3, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        id: nextId,
        projectId: project,
        client,
        amount: parseFloat(amount),
        status: "draft",
        issued,
        due: due || null,
      },
    });

    // Log Activity
    await prisma.activity.create({
      data: {
        userId: req.user.id,
        action: "Approved invoice",
        subject: `${nextId} – ${client} ₹${(parseFloat(amount) / 100000).toFixed(2)}L`,
        projectId: project,
        type: "invoice",
      },
    });

    // Log Audit
    await prisma.auditLog.create({
      data: {
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        userEmail: req.user.email,
        action: "INVOICE_GENERATED",
        resource: `invoice:${nextId}`,
        detail: `Generated invoice ${nextId} for client ${client} with amount ${amount}`,
        ip: req.ip || "127.0.0.1",
      },
    });

    return res.status(201).json({
      id: invoice.id,
      project: invoice.projectId,
      client: invoice.client,
      amount: invoice.amount,
      status: invoice.status,
      issued: invoice.issued,
      due: invoice.due || undefined,
    });
  } catch (error) {
    console.error("POST /billing/invoices error:", error);
    return res.status(500).json({ message: "Internal server error generating invoice" });
  }
});

// PATCH /api/billing/milestones/:id - Update a milestone
router.patch("/milestones/:id", requireRoles(["super_admin", "accounts", "project_manager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, title, amount, date } = req.body;

    const milestone = await prisma.milestone.findUnique({ where: { id } });
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }

    const updated = await prisma.milestone.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(title !== undefined && { title }),
        ...(amount !== undefined && { amount: parseFloat(amount) }),
        ...(date !== undefined && { date }),
      },
    });

    // Log Audit
    await prisma.auditLog.create({
      data: {
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        userEmail: req.user.email,
        action: "MILESTONE_UPDATED",
        resource: `milestone:${id}`,
        detail: `Updated milestone ${id} status to ${status || milestone.status}`,
        ip: req.ip || "127.0.0.1",
      },
    });

    return res.json({
      id: updated.id,
      project: updated.projectId,
      title: updated.title,
      date: updated.date,
      status: updated.status,
      amount: updated.amount,
    });
  } catch (error) {
    console.error("PATCH /billing/milestones error:", error);
    return res.status(500).json({ message: "Internal server error updating milestone" });
  }
});

export default router;
