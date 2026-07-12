import { Router } from "express";
import prisma from "../lib/prisma.js";

const router = Router();

router.get("/check-user", async (req, res) => {
  try {
    const users = await prisma.user.findMany({ select: { email: true } });
    res.json({ users });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
