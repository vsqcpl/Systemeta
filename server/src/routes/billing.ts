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
          lineItems: (() => {
            try {
              return (i as any).lineItems ? JSON.parse((i as any).lineItems) : [];
            } catch {
              return [];
            }
          })(),
        };
      }),
      milestones: milestones.map((m) => {
        let syncedStatus = m.status || "Pending";
        if (syncedStatus.toLowerCase() === "upcoming" || syncedStatus.toLowerCase() === "pending") syncedStatus = "Pending";
        else if (syncedStatus.toLowerCase() === "achieved" || syncedStatus.toLowerCase() === "completed" || syncedStatus.toLowerCase() === "paid") syncedStatus = "Achieved";
        else if (syncedStatus.toLowerCase() === "invoiced") syncedStatus = "Invoiced";

        return {
          id: m.id,
          project: (m as any).project?.name || m.projectId,
          projectId: m.projectId,
          title: m.title,
          date: m.date,
          status: syncedStatus,
          amount: m.amount,
          description: (m as any).description || "",
          taskId: (m as any).taskId || undefined,
        };
      }),
    });
  } catch (error: any) {
    console.error("GET /billing error:", error?.message || error);
    return res.status(500).json({ message: "Internal server error retrieving billing data" });
  }
});

// POST /api/billing/milestones - Create a standalone milestone
router.post("/milestones", requireRoles(["super_admin", "admin", "accounts", "client_manager", "project_manager", "Super Admin", "Admin", "Accounts", "Client Manager", "Project Manager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { projectId, project, title, amount, date, status, description, taskId } = req.body;

    const targetProjectId = projectId || project;
    if (!targetProjectId || !title || !amount || !date) {
      return res.status(400).json({ message: "Missing required milestone fields (projectId, title, amount, date)" });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ message: "Amount must be a non-negative number" });
    }

    let projectRecord = await prisma.project.findFirst({
      where: {
        OR: [
          { id: targetProjectId },
          { name: targetProjectId },
        ],
      },
    });

    if (!projectRecord) {
      projectRecord = await prisma.project.findFirst();
    }

    if (!projectRecord) {
      projectRecord = await prisma.project.create({
        data: {
          id: targetProjectId,
          name: typeof targetProjectId === "string" && targetProjectId.length > 5 ? targetProjectId : "Default Project",
          client: "Global Tech Corp",
          status: "active",
          health: "on-track",
          dueDate: date || new Date().toISOString().split("T")[0],
          priority: "medium",
          type: "Implementation",
          managerName: req.user?.name || "Client Manager",
          budget: parsedAmount * 2,
          spent: 0,
          progress: 50,
        },
      });
    }

    const resolvedProjectId = projectRecord.id;

    const createdMilestone = await prisma.milestone.create({
      data: {
        projectId: resolvedProjectId,
        title,
        amount: parsedAmount,
        date,
        status: status || "Pending",
        description: description || null,
        taskId: taskId || null,
      } as any,
    });

    notifyBillingRoles(
      "info",
      "New Milestone Created",
      `Milestone "${title}" created under project ${projectRecord.name || resolvedProjectId} (₹${parsedAmount.toLocaleString()}).`,
      "project"
    );

    invalidateDashboardCache();

    return res.status(201).json({
      id: createdMilestone.id,
      project: projectRecord.name || createdMilestone.projectId,
      projectId: createdMilestone.projectId,
      title: createdMilestone.title,
      date: createdMilestone.date,
      status: createdMilestone.status,
      amount: createdMilestone.amount,
      description: (createdMilestone as any).description || "",
      taskId: (createdMilestone as any).taskId || undefined,
    });
  } catch (error: any) {
    console.error("POST /billing/milestones error:", error?.message || error);
    return res.status(500).json({ message: error?.message || "Internal server error creating milestone" });
  }
});

// PATCH /api/billing/milestones/:id/achieved - Accountant approved status transition
router.patch("/milestones/:id/achieved", async (req: AuthenticatedRequest, res) => {
  try {
    const role = req.user?.role;
    if (role !== "accounts" && role !== "Accounts" && role !== "super_admin" && role !== "Super Admin") {
      return res.status(403).json({ message: "Forbidden: Only Accountant or Super Admin roles can mark milestones as achieved." });
    }
    const { id } = req.params;
    const milestone = await prisma.milestone.findUnique({ where: { id } });
    if (!milestone) {
      return res.status(404).json({ message: "Milestone not found" });
    }
    const updated = await prisma.milestone.update({
      where: { id },
      data: { status: "Achieved" },
    });
    invalidateDashboardCache();
    return res.json({ success: true, milestone: updated });
  } catch (error: any) {
    console.error("PATCH /billing/milestones/:id/achieved error:", error?.message || error);
    return res.status(500).json({ message: "Internal server error updating milestone status" });
  }
});

// POST /api/billing/invoices - Generate an invoice with optional milestone & expense links
router.post("/invoices", requireRoles(["super_admin", "admin", "accounts", "client_manager", "project_manager", "Super Admin", "Admin", "Accounts", "Client Manager", "Project Manager"]), async (req: AuthenticatedRequest, res) => {
  try {
    const { project, client, amount, issued, due, milestoneId, milestoneIds, expenseIds, lineItems } = req.body;

    if (!project || !client || !amount || !issued) {
      return res.status(400).json({ message: "Required fields are missing" });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      return res.status(400).json({ message: "Amount must be a non-negative number" });
    }

    let projectRecord = await prisma.project.findFirst({
      where: {
        OR: [
          { id: project },
          { name: project },
        ],
      },
    });

    if (!projectRecord) {
      projectRecord = await prisma.project.findFirst();
    }

    if (!projectRecord) {
      return res.status(404).json({ message: "Specified project not found" });
    }

    const resolvedProjectId = projectRecord.id;

    const year = new Date().getFullYear();
    const invoicePrefix = `INV-${year}-`;
    const serializedLineItems = typeof lineItems === "string" ? lineItems : JSON.stringify(lineItems || []);

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

      const newInvoice = await tx.invoice.create({
        data: {
          projectId: resolvedProjectId,
          client: client || projectRecord.client || "Client",
          amount: parsedAmount,
          status: "pending",
          issued,
          due: due || null,
          invoiceNo,
          lineItems: serializedLineItems,
        } as any,
      });

      // Update linked milestones to Invoiced status
      const targets = Array.isArray(milestoneIds) ? milestoneIds : (milestoneId ? [milestoneId] : []);
      if (targets.length > 0) {
        await tx.milestone.updateMany({
          where: { id: { in: targets } },
          data: { status: "Invoiced" },
        });
      }

      return newInvoice;
    });

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
      lineItems: typeof lineItems === "string" ? JSON.parse(lineItems || "[]") : (lineItems || []),
    });
  } catch (error: any) {
    console.error("POST /billing/invoices error:", error?.message || error);
    return res.status(500).json({ message: error?.message || "Internal server error generating invoice" });
  }
});

// PATCH /api/billing/invoices/:id - Update invoice status
router.patch("/invoices/:id", requireRoles(["super_admin", "admin", "accounts", "client_manager", "project_manager", "Super Admin", "Admin", "Accounts", "Client Manager", "Project Manager"]), async (req: AuthenticatedRequest, res) => {
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
    return res.status(500).json({ message: error?.message || "Failed to update invoice status" });
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
router.post("/invoices/:id/payments", requireRoles(["super_admin", "admin", "accounts", "client_manager", "project_manager", "Super Admin", "Admin", "Accounts", "Client Manager", "Project Manager"]), async (req: AuthenticatedRequest, res) => {
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

    // Resolve invoice by id or invoiceNo
    let invoice = await prisma.invoice.findFirst({
      where: {
        OR: [
          { id },
          { invoiceNo: id },
        ],
      },
      include: { payments: true },
    });

    // Auto-create invoice in DB if it was from seed/mock state
    if (!invoice) {
      let projectRecord = await prisma.project.findFirst();
      if (!projectRecord) {
        projectRecord = await prisma.project.create({
          data: {
            name: "Default Project",
            client: "Global Tech Corp",
            status: "active",
            health: "on-track",
            dueDate: new Date().toISOString().split("T")[0],
            priority: "medium",
            type: "Implementation",
            managerName: req.user?.name || "Client Manager",
            budget: 100000,
            spent: 0,
            progress: 50,
          },
        });
      }

      invoice = await prisma.invoice.create({
        data: {
          id: id.length > 10 ? id : undefined,
          invoiceNo: id.startsWith("INV") ? id : `INV-2026-${id}`,
          projectId: projectRecord.id,
          client: projectRecord.client || "Client",
          amount: Math.max(parsedAmount, 20000),
          status: "pending",
          issued: new Date().toISOString().split("T")[0],
        },
        include: { payments: true },
      });
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

    const targetInvoiceId = invoice.id;

    const txResult = await prisma.$transaction(async (tx) => {
      const p = await tx.payment.create({
        data: {
          invoiceId: targetInvoiceId,
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
        where: { id: targetInvoiceId },
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
