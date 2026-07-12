import { Router } from "express";
import prisma from "../lib/prisma.js";
import bcrypt from "bcrypt";

const router = Router();

router.get("/check-user", async (req, res) => {
  try {
    const user = await prisma.user.findUnique({ where: { email: "admin@vsqc.com" } });
    if (!user) return res.json({ exists: false });
    
    // Test bcrypt
    let bcryptWorks = false;
    let bcryptError = null;
    let passwordMatches = false;
    try {
      passwordMatches = await bcrypt.compare("Admin123", user.passwordHash);
      bcryptWorks = true;
    } catch (e: any) {
      bcryptError = e.message;
    }

    res.json({ 
      exists: true, 
      hashPrefix: user.passwordHash.substring(0, 10),
      bcryptWorks,
      bcryptError,
      passwordMatches
    });
  } catch (e: any) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
