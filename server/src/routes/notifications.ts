import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { invalidateDashboardCache } from "../lib/dashboardCache.js";

const router = Router();

router.use(authMiddleware);

// GET /api/notifications - Get all notifications for user
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: { id: "desc" },
    });

    const formatted = notifications.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      time: n.createdAt,
      read: n.read,
      category: n.category || undefined,
    }));

    return res.json(formatted);
  } catch (error) {
    console.error("GET /notifications error:", error);
    return res.status(500).json({ message: "Internal server error retrieving notifications" });
  }
});

// POST /api/notifications - Create a notification
router.post("/", async (req: AuthenticatedRequest, res) => {
  try {
    const { id, userId, type, title, message, category } = req.body;
    if (!userId || !type || !title || !message) {
      return res.status(400).json({ message: "Missing required notification fields" });
    }

    const notification = await prisma.notification.create({
      data: {
        ...(id && { id }),
        userId,
        type,
        title,
        message,
        category: category || "general",
        createdAt: new Date().toISOString()
      }
    });

    invalidateDashboardCache();

    return res.status(201).json(notification);
  } catch (error) {
    console.error("POST /notifications error:", error);
    return res.status(500).json({ message: "Internal server error creating notification" });
  }
});

// POST /api/notifications/:id/read - Mark notification as read
router.post("/:id/read", async (req: AuthenticatedRequest, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, userId: req.user.id },
    });

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    await prisma.notification.update({
      where: { id },
      data: { read: true },
    });

    invalidateDashboardCache();

    return res.json({ success: true });
  } catch (error) {
    console.error("POST /notifications/:id/read error:", error);
    return res.status(500).json({ message: "Internal server error marking notification read" });
  }
});

export default router;
