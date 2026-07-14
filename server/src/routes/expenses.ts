import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { checkPermission, requirePermission, requireRoles } from "../middlewares/rbac.js";
import { callVisionService } from "../lib/groq.service.js";
import { validateCsrf } from "../middlewares/csrf.js";
import { logAuditEvent } from "../lib/auditLogger.js";
import { invalidateDashboardCache } from "../lib/dashboardCache.js";

const router = Router();

router.use(authMiddleware);

// GET /api/expenses - Retrieve expense logs
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    let expenses: any[] = [];

    const canSeeAll = req.user.role === "super_admin" || req.user.role === "accounts";

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
      modeOfTransport: e.modeOfTransport,
      fromLocation: e.fromLocation,
      toLocation: e.toLocation,
      calculatedDistance: e.calculatedDistance,
      reimbursementStage: e.reimbursementStage,
      onHoldReason: e.onHoldReason,
    }));

    console.log(`GET /expenses requested by ${req.user.role}. Returning ${formatted.length} expenses.`);
    return res.json(formatted);
  } catch (error: any) {
    console.error("GET /expenses error:", error);
    return res.status(500).json({ message: "Internal server error retrieving expenses", error: error ? error.toString() : null });
  }
});

function evaluateExpensePolicy(expense: any): { status: string, reason?: string } {
  const { category, amount, receiptUrl, modeOfTransport, calculatedDistance, isOutsideCityMeal } = expense;
  const isOutsideCity = category === "Travel" || category === "Accommodation" || !!isOutsideCityMeal; 
  const hasBill = !!receiptUrl;

  if (category === "Accommodation") {
    return amount <= 1500 ? { status: "approved" } : { status: "pending", reason: "Exceeds auto-approval limit of ₹1500 for Accommodation." };
  }

  if (category === "Meals") {
    if (isOutsideCity) {
      if (hasBill) return amount <= 600 ? { status: "approved" } : { status: "rejected", reason: "Meals outside city with bill exceeded ₹600 limit." };
      return amount <= 300 ? { status: "approved" } : { status: "rejected", reason: "Meals outside city without bill exceeded ₹300 limit." };
    } else {
      if (hasBill) return amount <= 200 ? { status: "approved" } : { status: "rejected", reason: "Meals inside city with bill exceeded ₹200 limit." };
      return amount <= 100 ? { status: "approved" } : { status: "rejected", reason: "Meals inside city without bill exceeded ₹100 limit." };
    }
  }

  if (category === "Travel" || category === "Transport") {
    if (modeOfTransport === "Flight") return { status: "pending", reason: "Flight travel requires manual approval." };

    if (modeOfTransport === "Train" || modeOfTransport === "Metro" || modeOfTransport === "Bus") {
      return hasBill ? { status: "approved" } : { status: "rejected", reason: `${modeOfTransport} travel requires a receipt.` };
    }

    if (modeOfTransport === "Auto") {
      if (isOutsideCity) {
        if (amount <= 150) return { status: "approved" };
        if (amount <= 300) return { status: "pending", reason: "Auto outside city exceeded ₹150 auto-approval limit." };
        return { status: "rejected", reason: "Auto outside city exceeded maximum ₹300 limit." };
      } else {
        if (amount <= 100) return { status: "approved" };
        if (amount <= 150) return { status: "pending", reason: "Auto inside city exceeded ₹100 auto-approval limit." };
        return { status: "rejected", reason: "Auto inside city exceeded maximum ₹150 limit." };
      }
    }

    if (modeOfTransport === "Cab") {
      if (hasBill) {
        if (amount <= 300) return { status: "approved" };
        return { status: "pending", reason: "Cab with bill exceeded ₹300 auto-approval limit." };
      } else {
        if (isOutsideCity) {
          if (amount <= 150) return { status: "approved" };
          if (amount <= 300) return { status: "pending", reason: "Cab outside city without bill exceeded ₹150 auto-approval limit." };
          return { status: "rejected", reason: "Cab outside city without bill exceeded maximum ₹300 limit." };
        } else {
          if (amount <= 100) return { status: "approved" };
          if (amount <= 150) return { status: "pending", reason: "Cab inside city without bill exceeded ₹100 auto-approval limit." };
          return { status: "rejected", reason: "Cab inside city without bill exceeded maximum ₹150 limit." };
        }
      }
    }

    if (modeOfTransport === "Bike") {
      if (!calculatedDistance) return { status: "rejected", reason: "Calculated distance missing for Bike travel." };
      return amount <= (calculatedDistance * 4) ? { status: "approved" } : { status: "rejected", reason: "Bike expense exceeds standard rate of ₹4/km." };
    }

    if (modeOfTransport === "Car") {
      if (!calculatedDistance) return { status: "rejected", reason: "Calculated distance missing for Car travel." };
      return amount <= (calculatedDistance * 8) ? { status: "approved" } : { status: "rejected", reason: "Car expense exceeds standard rate of ₹8/km." };
    }
  }

  return { status: "pending" };
}

// POST /api/expenses - Submit expense
router.post("/", validateCsrf, async (req: AuthenticatedRequest, res) => {
  try {
    const { project, category, description, amount, currency, date, receiptUrl, modeOfTransport, fromLocation, toLocation, calculatedDistance, isOutsideCity } = req.body;

    if (!project || !category || !description || !amount || !currency || !date) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const receiptValue = receiptUrl ? receiptUrl : null;
    const parsedAmount = parseFloat(amount);
    const parsedDist = calculatedDistance ? parseFloat(calculatedDistance) : null;
    let finalDescription = description;
    
    // Prefix description if it's an outside city meal so it's visible in UI
    if (category === "Meals" && isOutsideCity) {
      finalDescription = "[Outside City] " + finalDescription;
    }
    
    const policyResult = evaluateExpensePolicy({
      category,
      amount: parsedAmount,
      receiptUrl: receiptValue,
      modeOfTransport,
      calculatedDistance: parsedDist,
      isOutsideCityMeal: isOutsideCity
    });

    let autoStatus = policyResult.status;
    if (policyResult.reason) {
      finalDescription = `[Policy: ${policyResult.reason}] ` + finalDescription;
    }

    if (receiptValue) {
      const visionResult = await callVisionService(receiptValue, {
        category,
        amount: parsedAmount,
        description,
        date
      });

      if (!visionResult.is_valid) {
        autoStatus = "rejected";
        finalDescription = `[AI Rejected: ${visionResult.reason || "The receipt does not match the entered details."}] ` + finalDescription;
      }
    }

    const expense = await prisma.expense.create({
      data: {
        consultantId: req.user.id,
        projectId: project,
        category,
        description: finalDescription,
        amount: parsedAmount,
        currency,
        date,
        status: autoStatus,
        receipt: receiptValue,
        modeOfTransport: modeOfTransport || null,
        fromLocation: fromLocation || null,
        toLocation: toLocation || null,
        calculatedDistance: parsedDist,
      },
    });

    invalidateDashboardCache();

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
      modeOfTransport: expense.modeOfTransport,
      fromLocation: expense.fromLocation,
      toLocation: expense.toLocation,
      calculatedDistance: expense.calculatedDistance,
    });
  } catch (error) {
    console.error("POST /expenses error:", error);
    return res.status(500).json({ message: "Internal server error creating expense" });
  }
});

// PATCH /api/expenses/:id - Approve or Reject expense
router.patch("/:id", requirePermission("Approve Expenses"), validateCsrf, async (req: AuthenticatedRequest, res) => {
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

    if (req.user.role !== "super_admin" && expense.consultantId !== req.user.id) {
      return res.status(403).json({ message: "Forbidden" });
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
    await logAuditEvent({
      userEmail: req.user.email,
      action: `EXPENSE_${status.toUpperCase()}`,
      resource: `expense:${id}`,
      detail: `${status.toUpperCase()} expense request for consultant ${expense.consultantId}`,
      ip: req.ip || "127.0.0.1",
    });

    invalidateDashboardCache();

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
      modeOfTransport: updated.modeOfTransport,
      fromLocation: updated.fromLocation,
      toLocation: updated.toLocation,
      calculatedDistance: updated.calculatedDistance,
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

    if (expense.consultantId !== req.user.id && req.user.role !== "super_admin") {
      return res.status(403).json({ message: "Forbidden" });
    }

    await prisma.expense.delete({ where: { id } });

    await logAuditEvent({
      userEmail: req.user.email,
      action: "EXPENSE_DELETED",
      resource: `expense:${id}`,
      detail: `Deleted expense claim ${id}`,
      ip: req.ip || "127.0.0.1",
    });

    invalidateDashboardCache();

    return res.json({ success: true });
  } catch (error) {
    console.error("DELETE /expenses/:id error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

// PATCH /api/expenses/:id/stage - Update reimbursement stage (Accounts / Super Admin only)
router.patch("/:id/stage", requireRoles(["super_admin", "accounts"]), async (req: AuthenticatedRequest, res) => {
  const { id } = req.params;
  const { stage, reason } = req.body;

  if (!["Pending", "Payment Queued", "Paid", "On Hold"].includes(stage)) {
    return res.status(400).json({ message: "Invalid stage" });
  }

  try {
    const expense = await prisma.expense.findUnique({ where: { id } });
    if (!expense) return res.status(404).json({ message: "Expense not found" });

    const updated = await prisma.expense.update({
      where: { id },
      data: {
        reimbursementStage: stage,
        onHoldReason: reason || null,
      }
    });

    await logAuditEvent({
      userEmail: req.user.email,
      action: "UPDATE_EXPENSE_STAGE",
      resource: `Expense:${id}`,
      detail: `Changed from ${expense.reimbursementStage} to ${stage}${reason ? ' Reason: ' + reason : ''}`,
      ip: req.ip || "127.0.0.1"
    });

    return res.json({ message: "Stage updated successfully", expense: updated });
  } catch (error: any) {
    console.error("PATCH /expenses/:id/stage error:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
