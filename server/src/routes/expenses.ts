import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { checkPermission, requirePermission } from "../middlewares/rbac.js";

const router = Router();

router.use(authMiddleware);

// GET /api/expenses - Retrieve expense logs
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    let expenses: any[] = [];

    const canSeeAll = await checkPermission(req.user.id, req.user.role, "Approve Expenses") ||
                      await checkPermission(req.user.id, req.user.role, "Cross-Project Visibility") ||
                      req.user.role === "super_admin" ||
                      req.user.role === "project_manager" ||
                      req.user.role === "accounts";

    if (canSeeAll) {
      expenses = await prisma.expense.findMany();
    } else {
      expenses = await prisma.expense.findMany({
        where: { consultantId: req.user.id },
      });
    }

    const formatted = expenses.map((e) => ({
      id: e.id,
      consultant: e.consultantId,
      project: e.projectId,
      category: e.category,
      description: e.description,
      amount: e.amount,
      currency: e.currency,
      date: e.date,
      status: e.status,
      receipt: e.receipt,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("GET /expenses error:", error);
    return res.status(500).json({ message: "Internal server error retrieving expenses" });
  }
});

// POST /api/expenses - Submit expense
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { project, category, description, amount, currency, date, receiptUrl } = req.body;

    if (!project || !category || !description || !amount || !currency || !date) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const lastExpense = await prisma.expense.findFirst({ orderBy: { id: "desc" } });
    const lastNum = lastExpense ? parseInt(lastExpense.id.replace("E", "") || "0", 10) : 0;
    const nextId = "E" + String(lastNum + 1).padStart(3, "0");

    // Store the real Supabase URL if provided, otherwise mark as missing
    const receiptValue = receiptUrl ? receiptUrl : null;

    const expense = await prisma.expense.create({
      data: {
        id: nextId,
        consultantId: req.user.id,
        projectId: project,
        category,
        description,
        amount: parseFloat(amount),
        currency,
        date,
        status: "pending",
        receipt: receiptValue,
      },
    });

    return res.status(201).json({
      id: expense.id,
      consultant: expense.consultantId,
      project: expense.projectId,
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      currency: expense.currency,
      date: expense.date,
      status: expense.status,
      receipt: expense.receipt,
    });
  } catch (error) {
    console.error("POST /expenses error:", error);
    return res.status(500).json({ message: "Internal server error creating expense" });
  }
});

// PATCH /api/expenses/:id - Approve or Reject expense
router.patch("/:id", requirePermission("Approve Expenses"), async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["approved", "rejected"].includes(status)) {
      return res.status(400).json({ message: "Status must be 'approved' or 'rejected'" });
    }

    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (expense.consultantId === req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({
        message: "Cannot approve your own expense"
      });
    }

    const updated = await prisma.expense.update({
      where: { id },
      data: { status },
    });

    // Log Audit
    await prisma.auditLog.create({
      data: {
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        userEmail: req.user.email,
        action: `EXPENSE_${status.toUpperCase()}`,
        resource: `expense:${id}`,
        detail: `${status.toUpperCase()} expense request for consultant ${expense.consultantId}`,
        ip: req.ip || "127.0.0.1",
      },
    });

    return res.json({
      id: updated.id,
      consultant: updated.consultantId,
      project: updated.projectId,
      category: updated.category,
      description: updated.description,
      amount: updated.amount,
      currency: updated.currency,
      date: updated.date,
      status: updated.status,
      receipt: updated.receipt,
    });
  } catch (error) {
    console.error("PATCH /expenses/:id error:", error);
    return res.status(500).json({ message: "Internal server error updating expense" });
  }
});

// DELETE /api/expenses/:id - Delete expense
router.delete("/:id", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }

    if (expense.consultantId !== req.user.id && !["super_admin", "project_manager"].includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.expense.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        timestamp: new Date().toISOString().replace("T", " ").substring(0, 19),
        userEmail: req.user.email,
        action: "EXPENSE_DELETED",
        resource: `expense:${id}`,
        detail: `Deleted expense claim ${id}`,
        ip: req.ip || "127.0.0.1",
      },
    });

    return res.json({ success: true });
  } catch (error) {
    console.error("DELETE /expenses/:id error:", error);
    return res.status(500).json({ message: "Internal server error deleting expense" });
  }
});

export default router;
