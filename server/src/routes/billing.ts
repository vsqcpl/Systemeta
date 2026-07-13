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
        const managedProjects = await prisma.project.findMany({
          where: { managerName: req.user.name },
          select: { id: true },
        });
        projectsFilter = managedProjects.map((p) => p.id);
      } else {
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
        include: { payments: true },
      }),
      prisma.milestone.findMany({ where: whereClause }),
    ]);

    return res.json({
      invoices: invoices.map((i) => {
        const collectedAmount = i.payments.reduce((sum, p) => sum + p.amount, 0);
        const outstandingAmount = Math.round((i.amount - collectedAmount) * 100) / 100;

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
  } catch (error: any) {
    console.error("GET /billing error:", error?.message || error);
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

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    // Verify project exists
    const projectRecord = await prisma.project.findUnique({ where: { id: project } });
    if (!projectRecord) {
      return res.status(404).json({ message: "Project not found" });
    }

    const invoice = await prisma.invoice.create({
      data: {
        projectId: project,
        client,
        amount: parsedAmount,
        status: "draft",
        issued,
        due: due || null,
      },
    });

    // Log Activity (non-critical — don't let failure block response)
    prisma.activity.create({
      data: {
        userId: req.user.id,
        action: "Generated invoice",
        subject: `${invoice.id} – ${client} ₹${(parsedAmount / 100000).toFixed(2)}L`,
        projectId: project,
        type: "invoice",
      },
    }).catch((e) => console.error("Activity log failed:", e));

    // Log Audit (non-critical)
    logAuditEvent({
      userEmail: req.user.email,
      action: "INVOICE_GENERATED",
      resource: `invoice:${invoice.id}`,
      detail: `Generated invoice ${invoice.id} for client ${client} with amount ₹${parsedAmount.toLocaleString()}`,
      ip: req.ip || "127.0.0.1",
    }).catch((e) => console.error("Audit log failed:", e));

    invalidateDashboardCache();

    return res.status(201).json({
      id: invoice.id,
      project: invoice.projectId,
      client: invoice.client,
      amount: invoice.amount,
      status: invoice.status,
      issued: invoice.issued,
      due: invoice.due || undefined,
      collectedAmount: 0,
      outstandingAmount: invoice.amount,
      payments: [],
    });
  } catch (error: any) {
    console.error("POST /billing/invoices error:", error?.message || error);
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

    // Log Audit (non-critical)
    logAuditEvent({
      userEmail: req.user.email,
      action: "MILESTONE_UPDATED",
      resource: `milestone:${id}`,
      detail: `Updated milestone ${id} — status: ${status || milestone.status}`,
      ip: req.ip || "127.0.0.1",
    }).catch((e) => console.error("Audit log failed:", e));

    invalidateDashboardCache();

    return res.json({
      id: updated.id,
      project: updated.projectId,
      title: updated.title,
      date: updated.date,
      status: updated.status,
      amount: updated.amount,
    });
  } catch (error: any) {
    console.error("PATCH /billing/milestones error:", error?.message || error);
    return res.status(500).json({ message: "Internal server error updating milestone" });
  }
});

// GET /api/billing/invoices/:id/payments - Get payments for a specific invoice
router.get("/invoices/:id/payments", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: { orderBy: { recordedAt: "asc" } } },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    return res.json(invoice.payments);
  } catch (error: any) {
    console.error("GET /billing/invoices/:id/payments error:", error?.message || error);
    return res.status(500).json({ message: "Internal server error fetching payments" });
  }
});

// POST /api/billing/invoices/:id/payments - Record a payment
router.post("/invoices/:id/payments", requireRoles(["super_admin", "accounts"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { amount, date, method, referenceNumber, transactionId, remarks, proofUrl } = req.body;

    // --- Validate amount ---
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    // --- Validate method ---
    if (!method || typeof method !== "string" || method.trim() === "") {
      return res.status(400).json({ message: "Payment method is required" });
    }

    // --- Validate/normalize date ---
    const paymentDate = date && typeof date === "string" && date.trim() !== ""
      ? date.trim()
      : new Date().toISOString().split("T")[0];

    // --- Fetch invoice ---
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    if (invoice.status === "cancelled") {
      return res.status(400).json({ message: "Cannot record payment for a cancelled invoice" });
    }

    const currentCollected = invoice.payments.reduce((sum, p) => sum + p.amount, 0);
    const outstanding = Math.round((invoice.amount - currentCollected) * 100) / 100;

    if (parsedAmount > outstanding + 0.01) {
      return res.status(400).json({
        message: `Payment amount (₹${parsedAmount.toLocaleString()}) exceeds outstanding balance (₹${outstanding.toLocaleString()})`,
      });
    }

    const nextCollected = currentCollected + parsedAmount;
    let newStatus = invoice.status;

    if (nextCollected >= invoice.amount - 0.01) {
      newStatus = "paid";
    } else if (nextCollected > 0) {
      newStatus = "partially_paid";
    }

    // --- Run the core transaction (payment + invoice status) ---
    let payment: any;
    let updatedInvoice: any;

    try {
      const txResult = await prisma.$transaction(async (tx) => {
        const p = await tx.payment.create({
          data: {
            invoiceId: id,
            amount: parsedAmount,
            date: paymentDate,
            method: method.trim(),
            referenceNumber: referenceNumber?.trim() || null,
            transactionId: transactionId?.trim() || null,
            remarks: remarks?.trim() || null,
            proofUrl: proofUrl?.trim() || null,
            recordedBy: req.user.name,
          },
        });

        const inv = await tx.invoice.update({
          where: { id },
          data: {
            status: newStatus,
            ...(newStatus === "paid" ? { paid: paymentDate } : {}),
          },
          include: { payments: true },
        });

        return { payment: p, invoice: inv };
      });

      payment = txResult.payment;
      updatedInvoice = txResult.invoice;
    } catch (txError: any) {
      console.error("Payment transaction failed:", txError?.message || txError);
      return res.status(500).json({ message: "Failed to record payment — database error" });
    }

    // --- Audit log outside transaction so it never rolls back the payment ---
    logAuditEvent({
      userEmail: req.user.email,
      action: "PAYMENT_RECORDED",
      resource: `invoice:${id}`,
      detail: `Recorded payment of ₹${parsedAmount.toLocaleString()} via ${method.trim()} for invoice ${id}. New status: ${newStatus}.`,
      ip: req.ip || "127.0.0.1",
    }).catch((e) => console.error("Audit log failed (non-critical):", e));

    invalidateDashboardCache();

    const collectedAmount = updatedInvoice.payments.reduce((sum: number, p: any) => sum + p.amount, 0);

    return res.status(201).json({
      id: updatedInvoice.id,
      project: updatedInvoice.projectId,
      client: updatedInvoice.client,
      amount: updatedInvoice.amount,
      status: updatedInvoice.status,
      issued: updatedInvoice.issued,
      due: updatedInvoice.due || undefined,
      paid: updatedInvoice.paid || undefined,
      collectedAmount: Math.round(collectedAmount * 100) / 100,
      outstandingAmount: Math.round((updatedInvoice.amount - collectedAmount) * 100) / 100,
      payments: updatedInvoice.payments,
    });
  } catch (error: any) {
    console.error("POST /billing/invoices/:id/payments error:", error?.message || error);
    return res.status(500).json({ message: "Internal server error recording payment" });
  }
});

export default router;
