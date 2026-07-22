import { Router, Response, NextFunction } from "express";
import { PrismaClient } from "@prisma/client";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";

const prisma = new PrismaClient();
const router = Router();

const requireSuperAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (req.user?.role !== "super_admin" && req.user?.role !== "Super Admin") {
    return res.status(403).json({ error: "Forbidden: Super Admin only" });
  }
  next();
};

router.use(authMiddleware);

router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const offices = await prisma.office.findMany({
      orderBy: { name: 'asc' }
    });
    res.json(offices);
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch offices" });
  }
});

router.post("/", requireSuperAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { name, address } = req.body;
    if (!name || !address) return res.status(400).json({ error: "Name and address required" });
    
    const office = await prisma.office.create({
      data: { name, address }
    });
    res.json(office);
  } catch (err) {
    res.status(500).json({ error: "Failed to create office" });
  }
});

router.put("/:id", requireSuperAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, address } = req.body;
    
    const office = await prisma.office.update({
      where: { id },
      data: { name, address }
    });
    res.json(office);
  } catch (err) {
    res.status(500).json({ error: "Failed to update office" });
  }
});

router.delete("/:id", requireSuperAdmin as any, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.office.delete({ where: { id } });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to delete office" });
  }
});

export default router;
