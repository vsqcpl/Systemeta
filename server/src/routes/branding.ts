import express, { Router, Response } from "express";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { requireRoles } from "../middlewares/rbac.js";
import prisma from "../lib/prisma.js";
import { logAuditEvent } from "../lib/auditLogger.js";

const router: Router = express.Router();

// GET /api/branding - Get company branding
router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const branding = await prisma.companyBranding.findFirst();
    return res.status(200).json(branding || {});
  } catch (error: any) {
    console.error("GET /branding error:", error?.message || error);
    return res.status(500).json({ message: "Failed to fetch branding settings" });
  }
});

// PUT /api/branding - Update company branding
router.put("/", authMiddleware, requireRoles(["super_admin", "accounts"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { logoUrl, companyName, address, taxId, bankDetails, projectTypes } = req.body;


    if (!companyName) {
      return res.status(400).json({ message: "Company Name is required" });
    }

    const existing = await prisma.companyBranding.findFirst();
    let branding;

    if (existing) {
      branding = await prisma.companyBranding.update({
        where: { id: existing.id },
        data: { logoUrl, companyName, address, taxId, bankDetails, projectTypes },
      });
    } else {
      branding = await prisma.companyBranding.create({
        data: { logoUrl, companyName, address, taxId, bankDetails, projectTypes },
      });
    }

    // Log Audit
    logAuditEvent({
      userEmail: req.user.email,
      action: "BRANDING_UPDATED",
      resource: `company_branding`,
      detail: `Updated company branding settings`,
      ip: req.ip || "127.0.0.1",
    }).catch((e) => console.error("Audit log failed:", e));

    return res.status(200).json(branding);
  } catch (error: any) {
    console.error("PUT /branding error:", error?.message || error);
    return res.status(500).json({ message: "Failed to update branding settings" });
  }
});

// PATCH /api/branding/maintenance - Toggle maintenance mode
router.patch("/maintenance", authMiddleware, requireRoles(["super_admin"]), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { enabled } = req.body;

    if (typeof enabled !== "boolean") {
      return res.status(400).json({ message: "enabled must be a boolean" });
    }

    const existing = await prisma.companyBranding.findFirst();
    let branding;

    if (existing) {
      branding = await prisma.companyBranding.update({
        where: { id: existing.id },
        data: { maintenanceMode: enabled },
      });
    } else {
      branding = await prisma.companyBranding.create({
        data: { companyName: "Systemeta", maintenanceMode: enabled },
      });
    }

    // Log Audit
    logAuditEvent({
      userEmail: req.user.email,
      action: enabled ? "MAINTENANCE_ENABLED" : "MAINTENANCE_DISABLED",
      resource: `system`,
      detail: enabled ? `Enabled global maintenance mode` : `Disabled global maintenance mode`,
      ip: req.ip || "127.0.0.1",
    }).catch((e) => console.error("Audit log failed:", e));

    return res.status(200).json(branding);
  } catch (error: any) {
    console.error("PATCH /branding/maintenance error:", error?.message || error);
    return res.status(500).json({ message: "Failed to update maintenance settings" });
  }
});

export default router;
