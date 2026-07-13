import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/rbac.js";
import { logAuditEvent } from "../lib/auditLogger.js";
import { invalidateDashboardCache } from "../lib/dashboardCache.js";

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
      prisma.invoice.findMany({ 
        where: whereClause,
        include: { payments: true }
      }),
      prisma.milestone.findMany({ where: whereClause }),
    ]);

    return res.json({
      invoices: invoices.map((i) => {
        const collectedAmount = i.payments.reduce((sum, p) => sum + p.amount, 0);
        const outstandingAmount = i.amount - collectedAmount;

        return {
          id: i.id,
          project: i.projectId,
          client: i.client,
          amount: i.amount,
          status: i.status,
          issued: i.issued,
          due: i.due || undefined,
          paid: i.paid || undefined,
          collectedAmount,
          outstandingAmount,
          payments: i.payments,
        };
      }),
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

    const invoice = await prisma.invoice.create({
      data: {
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
        subject: `${invoice.id} – ${client} ₹${(parseFloat(amount) / 100000).toFixed(2)}L`,
        projectId: project,
        type: "invoice",
      },
    });

    // Log Audit
    await logAuditEvent({
      userEmail: req.user.email,
      action: "INVOICE_GENERATED",
      resource: `invoice:${invoice.id}`,
      detail: `Generated invoice ${invoice.id} for client ${client} with amount ${amount}`,
      ip: req.ip || "127.0.0.1",
    });

    invalidateDashboardCache();

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
    await logAuditEvent({
      userEmail: req.user.email,
      action: "MILESTONE_UPDATED",
      resource: `milestone:${id}`,
      detail: `Updated milestone ${id} status to ${status || milestone.status}`,
      ip: req.ip || "127.0.0.1",
    });

    invalidateDashboardCache();

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

// POST /api/billing/invoices/:id/payments - Record a payment
router.post("/invoices/:id/payments", requireRoles(["super_admin", "accounts"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { amount, date, method, referenceNumber, transactionId, remarks, proofUrl } = req.body;

    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || parsedAmount <= 0) {
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const currentCollected = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = invoice.amount - currentCollected;

    if (parsedAmount > outstanding) {
      return res.status(400).json({ message: "Payment amount exceeds outstanding balance" });
    }

    const nextCollected = currentCollected + parsedAmount;
    let newStatus = invoice.status;

    if (nextCollected >= invoice.amount) {
      newStatus = "paid";
    } else if (nextCollected > 0) {
      newStatus = "partially_paid";
    }

    const result = await prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          invoiceId: id,
          amount: parsedAmount,
          date,
          method,
          referenceNumber,
          transactionId,
          remarks,
          proofUrl,
          recordedBy: req.user.name,
        },
      });

      const updatedInvoice = await tx.invoice.update({
        where: { id },
        data: {
          status: newStatus,
          ...(newStatus === "paid" ? { paid: date } : {}),
        },
        include: { payments: true },
      });

      // Log Audit
      await tx.auditLog.create({
        data: {
          timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
          userEmail: req.user.email,
          action: "PAYMENT_RECORDED",
          resource: `invoice:${id}`,
          detail: `Recorded payment of ${parsedAmount} via ${method} for invoice ${id}`,
          ip: req.ip || "127.0.0.1",
        },
      });

      return updatedInvoice;
    });

    const collectedAmount = result.payments.reduce((sum, p) => sum + p.amount, 0);
    
    return res.status(201).json({
      id: result.id,
      project: result.projectId,
      client: result.client,
      amount: result.amount,
      status: result.status,
      issued: result.issued,
      due: result.due || undefined,
      paid: result.paid || undefined,
      collectedAmount,
      outstandingAmount: result.amount - collectedAmount,
      payments: result.payments,
    });
  } catch (error) {
    console.error("POST /billing/invoices/:id/payments error:", error);
    return res.status(500).json({ message: "Internal server error recording payment" });
  }
});

export default router;
