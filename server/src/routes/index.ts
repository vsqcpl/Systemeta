import { Router } from "express";
import authRoutes from "./auth.js";
import userRoutes from "./users.js";
import projectRoutes from "./projects.js";
import taskRoutes from "./tasks.js";
import timesheetRoutes from "./timesheets.js";
import leaveRoutes from "./leave.js";
import expenseRoutes from "./expenses.js";
import billingRoutes from "./billing.js";
import dashboardRoutes from "./dashboard.js";
import auditRoutes from "./audit.js";
import notificationRoutes from "./notifications.js";
import overridesRoutes from "./overrides.js";
import clientManagerRoutes from "./clientManager.js";
import aiRoutes from "./ai.js";
import brandingRoutes from "./branding.js";
import officeRoutes from "./offices.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", userRoutes);
router.use("/projects", projectRoutes);
router.use("/tasks", taskRoutes);
router.use("/timesheets", timesheetRoutes);
router.use("/leave", leaveRoutes);
router.use("/expenses", expenseRoutes);
router.use("/billing", billingRoutes);
router.use("/dashboard", dashboardRoutes);
router.use("/audit", auditRoutes);
router.use("/notifications", notificationRoutes);
router.use("/overrides", overridesRoutes);
router.use("/client-manager", clientManagerRoutes);
router.use("/ai", aiRoutes);
router.use("/branding", brandingRoutes);
router.use("/offices", officeRoutes);

export default router;
