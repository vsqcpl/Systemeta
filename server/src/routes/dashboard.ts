import { Router } from "express";
import prisma from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middlewares/auth.js";
import { checkPermission } from "../middlewares/rbac.js";
import { generateDynamicInsights } from "./ai.js";
import { getCachedDashboard, setDashboardCache } from "../lib/dashboardCache.js";

const router = Router();

router.use(authMiddleware);

// GET /api/dashboard - Aggregate dashboard statistics
router.get("/", async (req: AuthenticatedRequest, res) => {
  try {
    const cacheKey = req.user.id;
    const cachedData = getCachedDashboard(cacheKey, req.user.role);
    if (cachedData) {
      return res.json(cachedData);
    }

    // AI insights are fetched from the database (non-blocking) to prevent loading latency.
    // If the database has no insights yet, trigger generation in the background.
    prisma.aIInsight.count().then((count) => {
      if (count === 0) {
        generateDynamicInsights().catch((err) => {
          console.error("Failed to generate initial insights in background:", err);
        });
      }
    }).catch(() => {});


    let projectWhere: any = { status: "active" };
    let taskWhere: any = {
      status: { in: ["todo", "inprogress", "review"] },
      dueDate: { lt: new Date().toISOString().split("T")[0] },
    };
    let milestoneWhere: any = { status: "upcoming" };
    let projectSumWhere: any = {};
    let timesheetWhere: any = { billable: true };
    let clientNames: string[] = [];

    const hasCrossProject = await checkPermission(req.user.id, req.user.role, "Cross-Project Visibility");

    if (req.user.role === "super_admin" || req.user.role === "accounts" || hasCrossProject) {
      // No extra filtering needed; keep defaults to see all projects/tasks
    } else if (req.user.role === "client_manager") {
      const clients = await prisma.client.findMany({
        where: { createdBy: req.user.id },
        select: { name: true },
      });
      clientNames = clients.map((c) => c.name);

      const clientProjects = await prisma.project.findMany({
        where: { client: { in: clientNames } },
        select: { id: true },
      });
      const clientProjectIds = clientProjects.map((p) => p.id);

      projectWhere = { status: "active", client: { in: clientNames } };
      taskWhere = {
        projectId: { in: clientProjectIds },
        status: { in: ["todo", "inprogress", "review"] },
        dueDate: { lt: new Date().toISOString().split("T")[0] },
      };
      milestoneWhere = { projectId: { in: clientProjectIds }, status: "upcoming" };
      projectSumWhere = { client: { in: clientNames } };
      timesheetWhere = { projectId: { in: clientProjectIds }, billable: true };
    } else if (req.user.role === "client_contact" && req.user.clientId) {
      const clientProjects = await prisma.project.findMany({
        where: { client: req.user.clientId },
        select: { id: true },
      });
      const clientProjectIds = clientProjects.map((p) => p.id);

      projectWhere = { status: "active", client: req.user.clientId };
      taskWhere = {
        projectId: { in: clientProjectIds },
        status: { in: ["todo", "inprogress", "review"] },
        dueDate: { lt: new Date().toISOString().split("T")[0] },
      };
      milestoneWhere = { projectId: { in: clientProjectIds }, status: "upcoming" };
      projectSumWhere = { client: req.user.clientId };
      timesheetWhere = { projectId: { in: clientProjectIds }, billable: true };
    } else {
      // PM, Senior Consultant, Consultant see only their assigned projects and tasks
      const assignments = await prisma.projectAssignment.findMany({
        where: { userId: req.user.id },
        select: { projectId: true },
      });
      const projectIds = assignments.map((a) => a.projectId);

      projectWhere = { status: "active", id: { in: projectIds } };
      taskWhere = {
        status: { in: ["todo", "inprogress", "review"] },
        dueDate: { lt: new Date().toISOString().split("T")[0] },
        OR: [
          { projectId: { in: projectIds } },
          { assigneeId: req.user.id }
        ]
      };
      milestoneWhere = { projectId: { in: projectIds }, status: "upcoming" };
      projectSumWhere = { id: { in: projectIds } };
      timesheetWhere = { projectId: { in: projectIds }, billable: true };
    }

    const [
      activeProjectsCount,
      delayedTasksCount,
      upcomingMilestonesCount,
      totalBudgetAgg,
      totalSpentAgg,
      teamMembersCount,
      billableHoursAgg,
      aiInsights,
      activities,
    ] = await Promise.all([
      prisma.project.count({ where: projectWhere }),
      prisma.task.count({ where: taskWhere }),
      prisma.milestone.count({ where: milestoneWhere }),
      prisma.project.aggregate({ where: projectSumWhere, _sum: { budget: true } }),
      prisma.project.aggregate({ where: projectSumWhere, _sum: { spent: true } }),
      prisma.user.count({ where: { role: { not: "client_contact" } } }),
      prisma.timesheetEntry.aggregate({ where: timesheetWhere, _sum: { hours: true } }),
      prisma.aIInsight.findMany(),
      prisma.activity.findMany({
        orderBy: { createdAt: "desc" }, // Sort by recent chronologically
        take: 10,
      }),
    ]);

    // Fetch all invoices to compute monthly revenue performance
    const invoices = req.user.role === "client_manager"
      ? await prisma.invoice.findMany({ where: { client: { in: clientNames } } })
      : await prisma.invoice.findMany();
    const actual = Array(12).fill(0);
    const forecast = Array(12).fill(0);
    const target = Array(12).fill(0);

    invoices.forEach((inv) => {
      const date = new Date(inv.issued);
      if (isNaN(date.getTime())) return;
      const monthIdx = date.getMonth(); // 0 to 11
      if (monthIdx >= 0 && monthIdx <= 11) {
        if (inv.status === "paid") {
          actual[monthIdx] += inv.amount;
        }
        // Forecast is all invoices (paid, outstanding, overdue, draft)
        forecast[monthIdx] += inv.amount;
      }
    });

    // Populate target from projects due dates
    const allProjects = req.user.role === "client_manager"
      ? await prisma.project.findMany({ where: { client: { in: clientNames } } })
      : await prisma.project.findMany();
    allProjects.forEach((proj) => {
      const date = new Date(proj.dueDate);
      if (isNaN(date.getTime())) return;
      const monthIdx = date.getMonth();
      if (monthIdx >= 0 && monthIdx <= 11) {
        target[monthIdx] += proj.budget;
      }
    });

    // For future months (greater than the current month), if actual is 0, make it null
    const currentMonthIdx = new Date().getMonth();
    for (let i = currentMonthIdx + 1; i < 12; i++) {
      if (actual[i] === 0) {
        actual[i] = null;
      }
    }

    const revenueData = {
      labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
      actual,
      forecast,
      target,
    };

    // Calculate resource utilization chart data from current month timesheets
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    const timesheets = await prisma.timesheet.findMany({
      include: { entries: true }
    });

    const billable = [0, 0, 0, 0];
    const nonBillable = [0, 0, 0, 0];
    
    // Each consultant works 40 hours per week. Redundant consultants fetch removed.
    const availableHoursPerWeek = Math.max(40, teamMembersCount * 40);

    timesheets.forEach((ts) => {
      const date = new Date(ts.week);
      if (isNaN(date.getTime())) return;
      if (date.getFullYear() === currentYear && date.getMonth() === currentMonth) {
        const day = date.getDate();
        let weekIdx = 0;
        if (day <= 7) weekIdx = 0;
        else if (day <= 14) weekIdx = 1;
        else if (day <= 21) weekIdx = 2;
        else weekIdx = 3;

        ts.entries.forEach((entry) => {
          if (entry.billable) {
            billable[weekIdx] += entry.hours;
          } else {
            nonBillable[weekIdx] += entry.hours;
          }
        });
      }
    });

    // Calculate percentages
    const utilizationData = {
      labels: ["Week 1", "Week 2", "Week 3", "Week 4"],
      billable: billable.map((hrs) => Math.min(100, Math.round((hrs / availableHoursPerWeek) * 100))),
      nonBillable: nonBillable.map((hrs) => Math.min(100, Math.round((hrs / availableHoursPerWeek) * 100))),
      available: [100, 100, 100, 100],
    };

    // Calculate resourceUtilization KPI
    let totalBillableCurrentMonth = 0;
    let totalAvailableCurrentMonth = availableHoursPerWeek * 4;
    billable.forEach((hrs) => {
      totalBillableCurrentMonth += hrs;
    });
    const resourceUtilization = totalAvailableCurrentMonth > 0 
      ? Math.min(100, Math.round((totalBillableCurrentMonth / totalAvailableCurrentMonth) * 100))
      : 0;

    // Construct KPIs object
    const kpis = {
      activeProjects: activeProjectsCount,
      delayedTasks: delayedTasksCount,
      upcomingMilestones: upcomingMilestonesCount,
      revenuePipeline: totalBudgetAgg._sum.budget || 0,
      resourceUtilization,
      billableHours: billableHoursAgg._sum.hours || 0,
      teamMembers: teamMembersCount,
      clientSatisfaction: null, // Requires client feedback module integrations. Set to null.
    };

    // Format activities list
    const formattedActivities = activities.map((act) => ({
      time: "Recent", // standard text mapping
      user: act.userId,
      action: act.action,
      subject: act.subject,
      project: act.projectId,
      type: act.type as any,
    }));

    const canViewInsights = await checkPermission(req.user.id, req.user.role, "View AI Insights");
    const filteredAiInsights = canViewInsights ? aiInsights : [];

    const dashboardResponse = {
      kpis,
      revenueData,
      utilizationData,
      aiInsights: filteredAiInsights,
      activities: formattedActivities,
    };

    setDashboardCache(cacheKey, req.user.role, dashboardResponse);

    return res.json(dashboardResponse);
  } catch (error) {
    console.error("GET /dashboard error:", error);
    return res.status(500).json({ message: "Internal server error calculating dashboard" });
  }
});

export default router;
