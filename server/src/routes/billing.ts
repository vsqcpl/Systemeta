import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/rbac.js";
import { logAuditEvent } from "../lib/auditLogger.js";
import { invalidateDashboardCache } from "../lib/dashboardCache.js";

const router = Router();

router.use(authMiddleware);

/**
 * Helper to dispatch role notifications to Admin, Finance (Accounts), and Client Managers
 */
async function notifyBillingRoles(type: string, title: string, message: string, category: string = "general") {
  try {
    const targetUsers = await prisma.user.findMany({
      where: {
        role: {
          in: ["super_admin", "accounts", "client_manager", "Super Admin", "Accounts", "Client Manager"],
        },
      },
      select: { id: true },
    });

    if (targetUsers.length > 0) {
      await prisma.notification.createMany({
        data: targetUsers.map((u) => ({
          userId: u.id,
          type,
          title,
          message,
          category,
          createdAt: new Date().toISOString(),
        })),
      });
    }
  } catch (err) {
    console.error("Failed to notify billing roles:", err);
  }
}

// GET /api/billing - Get invoices and milestones
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    let projectsFilter: string[] = [];
    const isElevated =
      req.user.role === "super_admin" ||
      req.user.role === "accounts" ||
      req.user.role === "Super Admin" ||
      req.user.role === "Accounts";

    if (!isElevated) {
      if (req.user.role === "project_manager" || req.user.role === "Project Manager") {
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
        include: { payments: true, project: true },
        orderBy: { issued: "desc" },
      }),
      prisma.milestone.findMany({
        where: whereClause,
        include: { project: true },
        orderBy: { date: "desc" },
      }),
    ]);

    return res.json({
      invoices: invoices.map((i) => {
        const collectedAmount = i.payments.reduce((sum, p) => sum + p.amount, 0);
        const outstandingAmount = Math.round((i.amount - collectedAmount) * 100) / 100;
        const gst = 18; // Default 18% GST
        const taxAmount = Math.round((i.amount * 0.18) * 100) / 100;

        return {
          id: i.id,
          invoiceNo: i.invoiceNo || i.id,
          project: (i as any).project?.name || i.projectId,
          client: i.client,
          amount: i.amount,
          gst,
          taxAmount,
          status: i.status,
          issued: i.issued,
          due: i.due || undefined,
          paid: i.paid || undefined,
          collectedAmount,
          outstandingAmount,
          payments: i.payments,
        };
      }),
      milestones: milestones.map((m) => {
        // Derive milestone status dynamically if linked invoice status exists
        let syncedStatus = m.status || "Pending";
        if (syncedStatus === "completed") syncedStatus = "Paid";
        if (syncedStatus === "upcoming") syncedStatus = "Pending";

        return {
          id: m.id,
          project: (m as any).project?.name || m.projectId,
          projectId: m.projectId,
          title: m.title,
          date: m.date,
          status: syncedStatus,
          amount: m.amount,
        };
      }),
    });
  } catch (error: any) {
    console.error("GET /billing error:", error?.message || error);
    return res.status(500).json({ message: "Internal server error retrieving billing data" });
  }
});

// POST /api/billing/milestones - Create a milestone and automatically generate invoice
router.post("/milestones", requireRoles(["super_admin", "accounts", "project_manager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, project, title, amount, date, status } = req.body;

    const targetProjectId = projectId || project;
    if (!targetProjectId || !title || !amount || !date) {
      return res.status(400).json({ message: "Missing required milestone fields (projectId, title, amount, date)" });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const projectRecord = await prisma.project.findUnique({ where: { id: targetProjectId } });
    if (!projectRecord) {
      return res.status(404).json({ message: "Project not found" });
    }

    const clientName = projectRecord.client || "Client";

    // Perform transaction: Create Milestone & Generate Invoice
    const year = new Date().getFullYear();
    const invoicePrefix = `INV-${year}-`;

    const { milestone, invoice } = await prisma.$transaction(async (tx) => {
      const createdMilestone = await tx.milestone.create({
        data: {
          projectId: targetProjectId,
          title,
          amount: parsedAmount,
          date,
          status: status || "Invoice Generated",
        },
      });

      // Generate invoice number
      const lastInvoice = await tx.invoice.findFirst({
        where: { invoiceNo: { startsWith: invoicePrefix } },
        orderBy: { invoiceNo: "desc" },
      });

      let nextSeq = 1;
      if (lastInvoice && lastInvoice.invoiceNo) {
        const parts = lastInvoice.invoiceNo.split("-");
        const seq = parseInt(parts[parts.length - 1], 10);
        if (!isNaN(seq)) nextSeq = seq + 1;
      }

      const invoiceNo = `${invoicePrefix}${String(nextSeq).padStart(3, "0")}`;

      const createdInvoice = await tx.invoice.create({
        data: {
          projectId: targetProjectId,
          client: clientName,
          amount: parsedAmount,
          status: "pending",
          issued: new Date().toISOString().split("T")[0],
          due: date || null,
          invoiceNo,
        },
      });

      return { milestone: createdMilestone, invoice: createdInvoice };
    });

    // Notify role stakeholders
    notifyBillingRoles(
      "info",
      "Invoice Generated from Milestone",
      `Invoice ${invoice.invoiceNo || invoice.id} for ₹${parsedAmount.toLocaleString()} generated automatically for milestone "${title}".`,
      "project"
    );

    invalidateDashboardCache();

    return res.status(201).json({
      milestone: {
        id: milestone.id,
        project: projectRecord.name || milestone.projectId,
        projectId: milestone.projectId,
        title: milestone.title,
        date: milestone.date,
        status: milestone.status,
        amount: milestone.amount,
        invoiceId: invoice.id,
        invoiceNo: invoice.invoiceNo,
      },
      invoice: {
        id: invoice.id,
        invoiceNo: invoice.invoiceNo,
        project: projectRecord.name || invoice.projectId,
        client: invoice.client,
        amount: invoice.amount,
        gst: 18,
        taxAmount: Math.round((invoice.amount * 0.18) * 100) / 100,
        status: invoice.status,
        issued: invoice.issued,
        due: invoice.due || undefined,
        collectedAmount: 0,
        outstandingAmount: invoice.amount,
        payments: [],
      },
    });
  } catch (error: any) {
    console.error("POST /billing/milestones error:", error?.message || error);
    return res.status(500).json({ message: "Internal server error creating milestone and invoice" });
  }
});

// POST /api/billing/invoices - Generate an invoice
router.post("/invoices", requireRoles(["super_admin", "accounts"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { project, client, amount, issued, due, milestoneId } = req.body;

    if (!project || !client || !amount || !issued) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }

    const projectRecord = await prisma.project.findUnique({ where: { id: project } });
    if (!projectRecord) {
      return res.status(404).json({ message: "Project not found" });
    }

    const year = new Date().getFullYear();
    const invoicePrefix = `INV-${year}-`;

    const invoice = await prisma.$transaction(async (tx) => {
      const lastInvoice = await tx.invoice.findFirst({
        where: { invoiceNo: { startsWith: invoicePrefix } },
        orderBy: { invoiceNo: "desc" },
      });

      let nextNumber = 1;
      if (lastInvoice && lastInvoice.invoiceNo) {
        const lastParts = lastInvoice.invoiceNo.split("-");
        const lastSequence = parseInt(lastParts[lastParts.length - 1], 10);
        if (!isNaN(lastSequence)) nextNumber = lastSequence + 1;
      }

      const invoiceNo = `${invoicePrefix}${String(nextNumber).padStart(3, "0")}`;

      return await tx.invoice.create({
        data: {
          projectId: project,
          client,
          amount: parsedAmount,
          status: "pending",
          issued,
          due: due || null,
          invoiceNo,
        },
      });
    });

    // Role Notification
    notifyBillingRoles(
      "info",
      "Invoice Generated",
      `Invoice ${invoice.invoiceNo || invoice.id} generated for client ${client} (₹${parsedAmount.toLocaleString()}).`,
      "general"
    );

    invalidateDashboardCache();

    return res.status(201).json({
      id: invoice.id,
      invoiceNo: invoice.invoiceNo,
      project: projectRecord.name || invoice.projectId,
      client: invoice.client,
      amount: invoice.amount,
      gst: 18,
      taxAmount: Math.round((invoice.amount * 0.18) * 100) / 100,
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

// PATCH /api/billing/invoices/:id - Update invoice status
router.patch("/invoices/:id", requireRoles(["super_admin", "accounts"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status, due } = req.body;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: true, project: true },
    });

    if (!invoice) {
      return res.status(404).json({ message: "Invoice not found" });
    }

    const updated = await prisma.invoice.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(due !== undefined && { due }),
      },
      include: { payments: true, project: true },
    });

    // Notify roles
    notifyBillingRoles(
      "info",
      "Invoice Status Updated",
      `Invoice ${updated.invoiceNo || updated.id} status updated to "${updated.status}".`,
      "general"
    );

    invalidateDashboardCache();

    const collectedAmount = updated.payments.reduce((sum, p) => sum + p.amount, 0);

    return res.json({
      id: updated.id,
      invoiceNo: updated.invoiceNo,
      project: (updated as any).project?.name || updated.projectId,
      client: updated.client,
      amount: updated.amount,
      status: updated.status,
      issued: updated.issued,
      due: updated.due || undefined,
      paid: updated.paid || undefined,
      collectedAmount,
      outstandingAmount: Math.round((updated.amount - collectedAmount) * 100) / 100,
      payments: updated.payments,
    });
  } catch (error: any) {
    console.error("PATCH /billing/invoices/:id error:", error?.message || error);
    return res.status(500).json({ message: "Failed to update invoice status" });
  }
});

// GET /api/billing/invoices/:id/download-data
router.get("/invoices/:id/download-data", requireRoles(["super_admin", "accounts"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { project: { select: { name: true } } },
    });

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    const branding = await prisma.companyBranding.findFirst();

    return res.status(200).json({ invoice, branding: branding || {} });
  } catch (error: any) {
    console.error("GET /billing/invoices/:id/download-data error:", error);
    return res.status(500).json({ message: "Failed to fetch invoice download data" });
  }
});

// GET /api/billing/invoices/:id/payments
router.get("/invoices/:id/payments", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: { orderBy: { recordedAt: "asc" } } },
    });
    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
    return res.json(invoice.payments);
  } catch (error: any) {
    console.error("GET /billing/invoices/:id/payments error:", error);
    return res.status(500).json({ message: "Internal server error fetching payments" });
  }
});

// POST /api/billing/invoices/:id/payments - Record a payment
router.post("/invoices/:id/payments", requireRoles(["super_admin", "accounts"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { amount, date, method, referenceNumber, transactionId, remarks, proofUrl } = req.body;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    if (!method || typeof method !== "string" || method.trim() === "") {
      return res.status(400).json({ message: "Payment method is required" });
    }

    const paymentDate = date && typeof date === "string" && date.trim() !== ""
      ? date.trim()
      : new Date().toISOString().split("T")[0];

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: true },
    });

    if (!invoice) return res.status(404).json({ message: "Invoice not found" });
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
          recordedBy: req.user?.name || req.user?.email || "System",
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

    // Notify roles
    notifyBillingRoles(
      "success",
      "Payment Recorded",
      `Payment of ₹${parsedAmount.toLocaleString()} recorded for invoice ${invoice.invoiceNo || invoice.id}. New status: ${newStatus}.`,
      "general"
    );

    invalidateDashboardCache();

    const collectedAmount = txResult.invoice.payments.reduce((sum: number, p: any) => sum + p.amount, 0);

    return res.status(201).json({
      id: txResult.invoice.id,
      project: txResult.invoice.projectId,
      client: txResult.invoice.client,
      amount: txResult.invoice.amount,
      status: txResult.invoice.status,
      issued: txResult.invoice.issued,
      due: txResult.invoice.due || undefined,
      paid: txResult.invoice.paid || undefined,
      collectedAmount: Math.round(collectedAmount * 100) / 100,
      outstandingAmount: Math.round((txResult.invoice.amount - collectedAmount) * 100) / 100,
      payments: txResult.invoice.payments,
    });
  } catch (error: any) {
    console.error("POST /billing/invoices/:id/payments error:", error?.message || error);
    return res.status(500).json({ message: error?.message || "Internal server error recording payment" });
  }
});

export default router;
